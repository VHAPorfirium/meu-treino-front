'use client';

import { ApiError, replay } from '../api/client';
import { clearOfflineStores, db, STORE_OUTBOX, STORE_RASCUNHO } from './db';

export { db, STORE_RASCUNHO };

/**
 * E5 — Fila offline ("outbox") das escritas da aluna.
 *
 * Toda operação passa por `enqueueAndSend`: tenta enviar na hora; se falhar por
 * REDE/timeout, fica guardada no IndexedDB e é reenviada em ordem quando a
 * conexão volta (`online`), quando o app volta ao foreground, ou manualmente.
 *
 * Isso só é seguro porque as escritas da aluna são IDEMPOTENTES no backend
 * (PATCH por chave natural + `sets[]` com semântica replace) — reenviar = mesmo estado.
 *
 * Erros definitivos de cliente (4xx, exceto 401/408/429) são descartados no flush;
 * falhas transitórias (rede, timeout, 408, 429, 5xx) e 401 preservam a fila para
 * evitar perda de dados durante deploys ou instabilidade de rede.
 */

export interface OutboxOp {
  id: string;
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  createdAt: number;
  tries: number;
  /** chave lógica pra "colapsar" ops repetidas (ex: mesmo exercício) — a última vence */
  key?: string;
}

const MAX_TRIES = 20;

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();

async function notify() {
  const n = await pendingCount();
  listeners.forEach((l) => l(n));
}

/** Observa a quantidade de operações pendentes (pra badge "⏳ pendente"). */
export function onPendingChange(l: Listener) {
  listeners.add(l);
  void pendingCount()
    .then(l)
    .catch(() => l(0));
  return () => listeners.delete(l);
}

export async function pendingCount(): Promise<number> {
  try {
    const d = await db();
    if (!d) return 0;
    return await d.count(STORE_OUTBOX);
  } catch {
    return 0;
  }
}

function isNetworkError(e: unknown): boolean {
  // fetch/timeout lança TypeError/AbortError; ApiError significa que o servidor respondeu
  return !(e instanceof ApiError);
}

function isRetryableFlushError(e: unknown): boolean {
  if (isNetworkError(e)) return true;
  if (!(e instanceof ApiError)) return true;
  return e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500;
}

/** Remove operações pendentes com a mesma chave lógica numa única transação. */
async function removeByKey(key: string): Promise<void> {
  try {
    const d = await db();
    if (!d) return;
    const tx = d.transaction(STORE_OUTBOX, 'readwrite');
    const store = tx.objectStore(STORE_OUTBOX);
    const all = (await store.getAll()) as OutboxOp[];
    for (const existing of all) {
      if (existing.key === key) {
        await store.delete(existing.id);
      }
    }
    await tx.done;
    await notify();
  } catch {
    /* melhor esforço */
  }
}

async function put(op: OutboxOp) {
  const d = await db();
  if (!d) return;
  const tx = d.transaction(STORE_OUTBOX, 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);
  if (op.key) {
    // colapsa atomicamente: remove ops anteriores com a mesma chave (a nova é o estado final)
    const all = (await store.getAll()) as OutboxOp[];
    for (const existing of all) {
      if (existing.key === op.key) {
        await store.delete(existing.id);
      }
    }
  }
  await store.put(op);
  await tx.done;
  if (flushing) needsReflush = true;
  await notify();
}

/** Limpa outbox e rascunho no logout/troca de usuário e zera os observadores. */
export async function limparFilaOffline(): Promise<void> {
  needsReflush = false;
  await clearOfflineStores();
  await notify();
}

/**
 * Tenta enviar agora. Em falha de REDE/timeout ou 5xx transitório, enfileira e
 * resolve com `{ queued: true }`. Em sucesso, descarta qualquer operação antiga
 * na fila com a mesma `key` (evita sobrescrita fora de ordem num flush futuro).
 */
export async function enqueueAndSend<T>(
  op: Omit<OutboxOp, 'id' | 'createdAt' | 'tries'>,
): Promise<{ queued: false; result: T } | { queued: true }> {
  try {
    const result = await replay<T>(op.method, op.path, op.body);
    if (op.key) {
      await removeByKey(op.key);
    }
    return { queued: false, result };
  } catch (e) {
    const shouldQueue =
      isNetworkError(e) ||
      (e instanceof ApiError && (e.status === 408 || e.status === 429 || e.status >= 500));
    if (!shouldQueue) throw e;
    await put({
      ...op,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      tries: 0,
    });
    return { queued: true };
  }
}

let flushing = false;
let needsReflush = false;

/**
 * Reenvia a fila em ordem. Para no primeiro erro de rede, 5xx ou 401 (sem
 * apagar o registro do aluno); descarta apenas erros 4xx definitivos.
 */
export async function flush(): Promise<{ sent: number; left: number }> {
  let d;
  try {
    d = await db();
  } catch {
    return { sent: 0, left: 0 };
  }
  if (!d || flushing) {
    if (flushing) needsReflush = true;
    return { sent: 0, left: await pendingCount() };
  }
  flushing = true;
  needsReflush = false;
  let sent = 0;
  let stoppedOnTransient = false;
  try {
    const ops = (await d.getAllFromIndex(STORE_OUTBOX, 'createdAt')) as OutboxOp[];
    for (const op of ops) {
      try {
        await replay(op.method, op.path, op.body);
        await d.delete(STORE_OUTBOX, op.id);
        sent++;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // Sessão expirada: não deleta silenciosamente aqui (o handler global de 401 trata a sessão)
          stoppedOnTransient = true;
          break;
        }
        if (isRetryableFlushError(e)) {
          op.tries++;
          if (op.tries >= MAX_TRIES) await d.delete(STORE_OUTBOX, op.id);
          else await d.put(STORE_OUTBOX, op);
          stoppedOnTransient = true;
          break; // ainda offline ou servidor reiniciando: preserva a ordem e tenta depois
        }
        // Erro 4xx definitivo (400/403/404/409/422) → não adianta repetir
        await d.delete(STORE_OUTBOX, op.id);
      }
    }
  } finally {
    flushing = false;
    await notify();
  }

  if (needsReflush && !stoppedOnTransient && typeof navigator !== 'undefined' && navigator.onLine) {
    const followUp = await flush();
    return { sent: sent + followUp.sent, left: followUp.left };
  }

  return { sent, left: await pendingCount() };
}

let wired = false;
/** Liga o flush automático a `online` e ao retorno do app pro foreground. Chamar 1x. */
export function wireAutoFlush() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('online', () => void flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && navigator.onLine) void flush();
  });
  if (navigator.onLine) void flush();
}
