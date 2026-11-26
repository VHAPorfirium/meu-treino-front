'use client';

import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'ritmo-offline';
const DB_VERSION = 2;

export const STORE_OUTBOX = 'outbox';
/** E13 — rascunho da sessão em andamento (ver `lib/offline/rascunho.ts`). */
export const STORE_RASCUNHO = 'rascunho';

let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Banco local compartilhado. O `upgrade` cria cada store **só se ainda não existir**:
 * quem já usa o app tem a v1 com o `outbox` cheio, e recriar apagaria a fila
 * pendente de quem estava offline.
 *
 * Se `openDB` falhar uma vez (ex.: quota ou bloqueio transitório), limpa o
 * singleton para não envenenar chamadas futuras.
 */
export function db(): Promise<IDBPDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE_OUTBOX)) {
          const s = d.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
          s.createIndex('createdAt', 'createdAt');
        }
        if (!d.objectStoreNames.contains(STORE_RASCUNHO)) {
          d.createObjectStore(STORE_RASCUNHO, { keyPath: 'id' });
        }
      },
    }).catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

/** Limpa fila offline e rascunho local (logout ou expiração de sessão). */
export async function clearOfflineStores(): Promise<void> {
  try {
    const d = await db();
    if (!d) return;
    const tx = d.transaction([STORE_OUTBOX, STORE_RASCUNHO], 'readwrite');
    await Promise.all([
      tx.objectStore(STORE_OUTBOX).clear(),
      tx.objectStore(STORE_RASCUNHO).clear(),
      tx.done,
    ]);
  } catch {
    /* armazenamento indisponível não pode travar o logout */
  }
}
