'use client';

import { useEffect, useState } from 'react';
import { pushApi } from '@/lib/api/endpoints';

type State = 'unsupported' | 'disabled' | 'prompt' | 'subscribed' | 'denied' | 'busy';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const SYNC_SESSION_KEY = 'ritmo:push-synced';

function serializeSubscription(sub: PushSubscription) {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

/**
 * E6 — opt-in de notificações (Web Push). Some sozinho quando não faz sentido:
 * navegador sem suporte, push desabilitado no servidor, ou já inscrito.
 * iOS: só funciona com o app instalado na tela inicial (16.4+).
 */
export function PushOptIn() {
  const [state, setState] = useState<State>('busy');

  useEffect(() => {
    (async () => {
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setState('unsupported');
        return;
      }
      try {
        const { enabled } = await pushApi.publicKey();
        if (!enabled) return setState('disabled');
        if (Notification.permission === 'denied') return setState('denied');
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) {
          setState('subscribed');
          // Re-sincroniza 1x por sessão (idempotente) para recuperar dispositivos
          // inscritos localmente que falharam no servidor antes da correção do DTO.
          const payload = serializeSubscription(existing);
          let alreadySynced = false;
          try {
            alreadySynced = sessionStorage.getItem(SYNC_SESSION_KEY) === '1';
          } catch {
            /* Safari privado */
          }
          if (payload && !alreadySynced) {
            pushApi
              .subscribe(payload)
              .then(() => {
                try {
                  sessionStorage.setItem(SYNC_SESSION_KEY, '1');
                } catch {
                  /* ignore */
                }
              })
              .catch(() => {});
          }
          return;
        }
        setState('prompt');
      } catch {
        setState('disabled');
      }
    })();
  }, []);

  async function enable() {
    setState('busy');
    let createdSub: PushSubscription | null = null;
    try {
      const { publicKey } = await pushApi.publicKey();
      if (!publicKey) return setState('disabled');
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') return setState('denied');
      const reg = await navigator.serviceWorker.ready;
      createdSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const payload = serializeSubscription(createdSub);
      if (!payload) {
        await createdSub.unsubscribe().catch(() => {});
        setState('prompt');
        return;
      }
      await pushApi.subscribe(payload);
      try {
        sessionStorage.setItem(SYNC_SESSION_KEY, '1');
      } catch {
        /* ignore */
      }
      setState('subscribed');
    } catch {
      // Se o registro no backend falhou, desfaz a inscrição local do navegador
      // para não esconder o opt-in em um dispositivo sem inscrição no servidor.
      if (createdSub) await createdSub.unsubscribe().catch(() => {});
      setState('prompt');
    }
  }

  if (state !== 'prompt') return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-xs font-semibold text-muted">
        🔔 Receber aviso de treino novo e recados do personal?
      </p>
      <button
        onClick={enable}
        className="shrink-0 rounded-full bg-inverse px-3 py-1.5 text-xs font-extrabold text-on-inverse"
      >
        Ativar
      </button>
    </div>
  );
}
