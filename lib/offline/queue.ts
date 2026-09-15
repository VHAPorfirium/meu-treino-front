'use client';

import { openDB, type IDBPDatabase } from 'idb';
import { ApiError, replay } from '../api/client';

/**
 * E5 — Fila offline ("outbox") das escritas da aluna.
 *
 * Toda operação passa por `enqueueAndSend`: tenta enviar na hora; se falhar por
 * REDE (offline/timeout), fica guardada no IndexedDB e é reenviada em ordem quando
 * a conexão volta (`online`), quando o app volta ao foreground, ou manualmente.
 *
 * Isso só é seguro porque as escritas da aluna são IDEMPOTENTES no backend
 * (PATCH por chave natural + `sets[]` com semântica replace) — reenviar = mesmo estado.
 *
 * Erros HTTP (4xx/5xx) NÃO entram na fila: já chegaram no servidor e foram rejeitados.
 * iOS/Safari não tem Background Sync → o flush por evento é o caminho principal.
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

const DB_NAME = 'ritmo-offline';
const STORE = 'outbox';
/** E13 — rascunho da sessão em andamento (ver `lib/offline/rascunho.ts`). */
export const STORE_RASCUNHO = 'rascunho';
const DB_VERSION = 2;
const MAX_TRIES = 20;

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Banco local compartilhado. O `upgrade` cria cada store **só se ainda não existir**:
 * quem já usa o app tem a v1 com o `outbox` cheio, e recriar apagaria a fila
 * pendente de quem estava offline.
 */
export function db() {
  if (typeof indexedDB === 'undefined') return null;
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains(STORE)) {
        const s = d.createObjectStore(STORE, { keyPath: 'id' });
        s.createIndex('createdAt', 'createdAt');
      }
      if (!d.objectStoreNames.contains(STORE_RASCUNHO)) {
        d.createObjectStore(STORE_RASCUNHO, { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

type Listener = (pending: number) => void;
const listeners = new Set<Listener>();
async function notify() {
  const n = await pendingCount();
  listeners.forEach((l) => l(n));
}

/** Observa a quantidade de operações pendentes (pra badge "⏳ pendente"). */
export function onPendingChange(l: Listener) {
  listeners.add(l);
  void pendingCount().then(l);
  return () => listeners.delete(l);
}

export async function pendingCount(): Promise<number> {
  const d = await db();
  if (!d) return 0;
  return d.count(STORE);
}

function isNetworkError(e: unknown) {
  // fetch lança TypeError em falha de rede; ApiError significa que o servidor respondeu
  return !(e instanceof ApiError);
}

async function put(op: OutboxOp) {
  const d = await db();
  if (!d) return;
  if (op.key) {
    // colapsa: remove ops anteriores com a mesma chave (a nova é o estado final)
    const all = (await d.getAll(STORE)) as OutboxOp[];
    await Promise.all(
      all.filter((o) => o.key === op.key).map((o) => d.delete(STORE, o.id)),
    );
  }
  await d.put(STORE, op);
  await notify();
}

/**
 * Tenta enviar agora. Em falha de REDE, enfileira e resolve com `{ queued: true }`.
 * Em erro HTTP, propaga (o chamador mostra o erro).
 */
export async function enqueueAndSend<T>(
  op: Omit<OutboxOp, 'id' | 'createdAt' | 'tries'>,
): Promise<{ queued: false; result: T } | { queued: true }> {
  try {
    const result = await replay<T>(op.method, op.path, op.body);
    return { queued: false, result };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
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
/** Reenvia a fila em ordem. Para no primeiro erro de rede; descarta erros HTTP (já rejeitados). */
export async function flush(): Promise<{ sent: number; left: number }> {
  const d = await db();
  if (!d || flushing) return { sent: 0, left: await pendingCount() };
  flushing = true;
  let sent = 0;
  try {
    const ops = ((await d.getAllFromIndex(STORE, 'createdAt')) as OutboxOp[]);
    for (const op of ops) {
      try {
        await replay(op.method, op.path, op.body);
        await d.delete(STORE, op.id);
        sent++;
      } catch (e) {
        if (isNetworkError(e)) {
          op.tries++;
          if (op.tries >= MAX_TRIES) await d.delete(STORE, op.id);
          else await d.put(STORE, op);
          break; // ainda offline: tenta o resto depois
        }
        // servidor respondeu com erro → não adianta repetir
        await d.delete(STORE, op.id);
      }
    }
  } finally {
    flushing = false;
    await notify();
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
