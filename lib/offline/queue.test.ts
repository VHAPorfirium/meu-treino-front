import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../types';

const { mockReplay, mockNotifyUnauthorized, mockGetUser } = vi.hoisted(() => ({
  mockReplay: vi.fn(),
  mockNotifyUnauthorized: vi.fn(),
  mockGetUser: vi.fn<() => AuthUser | null>(),
}));

vi.mock('../api/client', () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    ApiError,
    replay: mockReplay,
    notifyUnauthorized: mockNotifyUnauthorized,
  };
});

vi.mock('../auth/storage', () => ({
  getUser: mockGetUser,
}));

import { ApiError } from '../api/client';
import { db, STORE_OUTBOX } from './db';
import {
  enqueueAndSend,
  flush,
  limparFilaOffline,
  limparSeOutroUsuario,
  pendingCount,
  type OutboxOp,
} from './queue';
import { carregarRascunho, salvarExercicio } from './rascunho';

const USER_A: AuthUser = { userId: 'user-a', name: 'Aluna A', username: 'aluna.a', role: 'TRAINEE', mustChangePassword: false };
const USER_B: AuthUser = { userId: 'user-b', name: 'Aluna B', username: 'aluna.b', role: 'TRAINEE', mustChangePassword: false };

async function readAllOutbox(): Promise<OutboxOp[]> {
  const d = await db();
  if (!d) return [];
  return (await d.getAll(STORE_OUTBOX)) as OutboxOp[];
}

describe('lib/offline/queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue(USER_A);
    await limparFilaOffline();
  });

  it('enfileira em erro de rede, vincula userId e colapsa operações repetidas da mesma key', async () => {
    mockReplay.mockRejectedValue(new TypeError('Failed to fetch'));

    const first = await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { status: 'DONE', loadUsed: 20 },
      key: 'patch:log-1:we-1',
    });
    const second = await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { status: 'DONE', loadUsed: 25 },
      key: 'patch:log-1:we-1',
    });

    expect(first).toEqual({ queued: true });
    expect(second).toEqual({ queued: true });
    expect(await pendingCount()).toBe(1);

    const ops = await readAllOutbox();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      userId: 'user-a',
      key: 'patch:log-1:we-1',
      body: { status: 'DONE', loadUsed: 25 },
    });
  });

  it('remove operação antiga da fila com a mesma key quando um envio direto tem sucesso', async () => {
    mockReplay.mockRejectedValueOnce(new TypeError('offline'));
    await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { loadUsed: 20 },
      key: 'patch:log-1:we-1',
    });
    expect(await pendingCount()).toBe(1);

    mockReplay.mockResolvedValueOnce({ ok: true });
    const res = await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { loadUsed: 30 },
      key: 'patch:log-1:we-1',
    });

    expect(res).toEqual({ queued: false, result: { ok: true } });
    expect(await pendingCount()).toBe(0);
  });

  it('preserva operações no IndexedDB em HTTP 401 (antes do redirect) e 503, e descarta apenas 4xx definitivos', async () => {
    // 401 no enqueueAndSend usa deferUnauthorizedRedirect e só chama notifyUnauthorized DEPOIS do commit no IDB
    let pendingWhenRedirected = -1;
    mockNotifyUnauthorized.mockImplementationOnce(() => {
      void pendingCount().then((n) => {
        pendingWhenRedirected = n;
      });
    });
    mockReplay.mockRejectedValueOnce(new ApiError(401, 'Não autenticado'));
    const queuedOn401 = await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { loadUsed: 40 },
      key: 'patch:log-1:we-1',
    });
    expect(queuedOn401).toEqual({ queued: true });
    expect(mockReplay).toHaveBeenLastCalledWith(
      'PATCH',
      '/workout-logs/log-1/exercises/we-1',
      { loadUsed: 40 },
      { deferUnauthorizedRedirect: true },
    );
    expect(mockNotifyUnauthorized).toHaveBeenCalledTimes(1);
    expect(await pendingCount()).toBe(1);
    await vi.waitFor(() => expect(pendingWhenRedirected).toBe(1));

    // 401 no flush para sem deletar a operação e só então chama notifyUnauthorized
    mockReplay.mockRejectedValueOnce(new ApiError(401, 'Não autenticado'));
    const flush401 = await flush();
    expect(flush401).toEqual({ sent: 0, left: 1 });
    expect(mockNotifyUnauthorized).toHaveBeenCalledTimes(2);

    // 503 no flush preserva a operação e incrementa tries
    mockReplay.mockRejectedValueOnce(new ApiError(503, 'Indisponível'));
    const flush503 = await flush();
    expect(flush503).toEqual({ sent: 0, left: 1 });
    expect((await readAllOutbox())[0]?.tries).toBe(1);

    // 400 definitivo no flush descarta a operação inválida
    mockReplay.mockRejectedValueOnce(new ApiError(400, 'Payload inválido'));
    const flush400 = await flush();
    expect(flush400).toEqual({ sent: 0, left: 0 });
  });

  it('limparSeOutroUsuario preserva fila e rascunho ao relogar com o mesmo usuário após 401 e limpa se mudar de usuário', async () => {
    mockReplay.mockRejectedValue(new TypeError('offline'));
    await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { loadUsed: 35 },
      key: 'patch:log-1:we-1',
    });
    await salvarExercicio('log-1', 'we-1', { nota: 'subir carga' });

    // Mesmo usuário relogando após 401 → preserva tudo
    const clearedSame = await limparSeOutroUsuario('user-a');
    expect(clearedSame).toBe(false);
    expect(await pendingCount()).toBe(1);
    expect(await carregarRascunho('log-1', 'user-a')).toMatchObject({
      userId: 'user-a',
      exercicios: { 'we-1': { nota: 'subir carga' } },
    });

    // Outro usuário logando no mesmo aparelho → limpa outbox e rascunho
    const clearedOther = await limparSeOutroUsuario('user-b');
    expect(clearedOther).toBe(true);
    expect(await pendingCount()).toBe(0);
    expect(await carregarRascunho('log-1', 'user-b')).toBeNull();
  });

  it('flush não regrava operação após logout concorrente (contador de geração) nem reenvia ops de outro usuário', async () => {
    mockReplay.mockRejectedValueOnce(new TypeError('offline'));
    await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { loadUsed: 50 },
      key: 'patch:log-1:we-1',
    });

    let rejectInFlight!: (err: Error) => void;
    mockReplay.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectInFlight = reject;
        }),
    );

    const flushPromise = flush('user-a');
    // Aguarda flush entrar no replay
    await vi.waitFor(() => expect(mockReplay).toHaveBeenCalledTimes(2));

    // Logout limpa a fila enquanto o replay ainda está em voo
    await limparFilaOffline();
    rejectInFlight(new TypeError('aborted'));
    await flushPromise;

    // A fila precisa permanecer vazia (não regravar a op antiga)
    expect(await pendingCount()).toBe(0);

    // Se houver uma op de user-a e flush rodar autenticado como user-b, nunca envia ao servidor
    mockReplay.mockRejectedValueOnce(new TypeError('offline'));
    await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-2/exercises/we-2',
      body: { loadUsed: 15 },
      userId: 'user-a',
    });
    mockReplay.mockClear();
    mockGetUser.mockReturnValue(USER_B);

    const res = await flush('user-b');
    expect(mockReplay).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, left: 0 });
  });

  it('flush não regrava op antiga que falhou se enqueueAndSend mais novo já a substituiu na fila', async () => {
    mockReplay.mockRejectedValueOnce(new TypeError('offline-1'));
    await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { loadUsed: 20 },
      key: 'patch:log-1:we-1',
    });

    let rejectOldFlush!: (err: Error) => void;
    mockReplay.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectOldFlush = reject;
        }),
    );
    const flushPromise = flush('user-a');
    await vi.waitFor(() => expect(mockReplay).toHaveBeenCalledTimes(2));

    // Enquanto o flush da op antiga (20kg) está pendente, um novo PATCH (40kg) falha e substitui a mesma key
    mockReplay.mockRejectedValueOnce(new TypeError('offline-2'));
    await enqueueAndSend({
      method: 'PATCH',
      path: '/workout-logs/log-1/exercises/we-1',
      body: { loadUsed: 40 },
      key: 'patch:log-1:we-1',
    });

    rejectOldFlush(new TypeError('timeout-1'));
    await flushPromise;

    const ops = await readAllOutbox();
    expect(ops).toHaveLength(1);
    expect(ops[0]?.body).toEqual({ loadUsed: 40 });
  });
});
