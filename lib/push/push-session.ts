'use client';

import { pushApi } from '@/lib/api/endpoints';

export const PUSH_SYNC_SESSION_KEY = 'ritmo:push-synced';

export function clearPushSyncFlag(): void {
  try {
    sessionStorage.removeItem(PUSH_SYNC_SESSION_KEY);
  } catch {
    /* Safari privado / storage indisponível */
  }
}

/**
 * Desvincula a inscrição Web Push no backend (antes do logout limpar o cookie
 * httpOnly) e limpa a flag da sessão para evitar notificações cruzadas ou
 * omissão de re-sincronização quando outro usuário logar no mesmo aparelho.
 */
export async function revokePushSubscription(): Promise<void> {
  clearPushSyncFlag();
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    if (sub?.endpoint) {
      await pushApi.unsubscribe(sub.endpoint).catch(() => {});
    }
  } catch {
    /* push indisponível não pode travar o logout */
  }
}
