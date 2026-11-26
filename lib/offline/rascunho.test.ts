import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../types';

const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn<() => AuthUser | null>(),
}));

vi.mock('../auth/storage', () => ({
  getUser: mockGetUser,
}));

import { limparFilaOffline } from './queue';
import {
  carregarRascunho,
  descartarRascunho,
  salvarExercicio,
  salvarExerciciosEmLote,
  salvarTimer,
} from './rascunho';

const USER_A: AuthUser = { userId: 'user-a', name: 'Aluna A', role: 'TRAINEE' };
const USER_B: AuthUser = { userId: 'user-b', name: 'Aluna B', role: 'TRAINEE' };

describe('lib/offline/rascunho', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetUser.mockReturnValue(USER_A);
    await limparFilaOffline();
  });

  it('salva e recupera exercícios, timer e userId da mesma sessão', async () => {
    const terminaEm = Date.now() + 60_000;
    await salvarExercicio('log-1', 'we-1', {
      linhas: [{ weight: '42,5', reps: '10' }],
      nota: 'boa execução',
    });
    await salvarTimer('log-1', terminaEm, 'Descanso · Série 1/3');

    const loaded = await carregarRascunho('log-1');
    expect(loaded).not.toBeNull();
    expect(loaded).toMatchObject({
      workoutLogId: 'log-1',
      userId: 'user-a',
      timerTerminaEm: terminaEm,
      timerRotulo: 'Descanso · Série 1/3',
      exercicios: {
        'we-1': {
          linhas: [{ weight: '42,5', reps: '10' }],
          nota: 'boa execução',
        },
      },
    });
  });

  it('serializa gravações paralelas sem perder alterações entre exercícios e timer', async () => {
    const terminaEm = Date.now() + 90_000;
    await Promise.all([
      salvarExercicio('log-1', 'we-1', { linhas: [{ weight: '20', reps: '12' }] }),
      salvarExercicio('log-1', 'we-2', { minutos: '15' }),
      salvarExercicio('log-1', 'we-1', { nota: 'sentiu leve' }),
      salvarTimer('log-1', terminaEm, 'Descanso'),
    ]);

    const loaded = await carregarRascunho('log-1');
    expect(loaded?.exercicios['we-1']).toEqual({
      linhas: [{ weight: '20', reps: '12' }],
      nota: 'sentiu leve',
    });
    expect(loaded?.exercicios['we-2']).toEqual({ minutos: '15' });
    expect(loaded?.timerTerminaEm).toBe(terminaEm);
  });

  it('mescla múltiplos exercícios com salvarExerciciosEmLote sem sobrescrever os existentes', async () => {
    await salvarExercicio('log-1', 'we-1', { nota: 'primeira nota' });
    await salvarExerciciosEmLote('log-1', {
      'we-2': { linhas: [{ weight: '30', reps: '8' }] },
      'we-3': { minutos: '20' },
    });

    const loaded = await carregarRascunho('log-1');
    expect(loaded?.exercicios).toEqual({
      'we-1': { nota: 'primeira nota' },
      'we-2': { linhas: [{ weight: '30', reps: '8' }] },
      'we-3': { minutos: '20' },
    });
  });

  it('descarta rascunho de outra sessão ou de outro usuário', async () => {
    await salvarExercicio('log-1', 'we-1', { nota: 'treino anterior' });

    // Outro workoutLogId → descarta e retorna null
    expect(await carregarRascunho('log-2')).toBeNull();
    expect(await carregarRascunho('log-1')).toBeNull();

    // Mesmo workoutLogId, mas dono diferente → descarta e retorna null
    await salvarExercicio('log-3', 'we-1', { nota: 'privado da aluna A' });
    mockGetUser.mockReturnValue(USER_B);
    expect(await carregarRascunho('log-3')).toBeNull();
  });

  it('descartarRascunho limpa a sessão após gravações enfileiradas', async () => {
    const p1 = salvarExercicio('log-1', 'we-1', { nota: 'em andamento' });
    const p2 = descartarRascunho();
    await Promise.all([p1, p2]);

    expect(await carregarRascunho('log-1')).toBeNull();
  });
});
