'use client';

import { useEffect, useState } from 'react';
import { flush, onPendingChange } from '@/lib/offline/queue';
import { triggerHaptic } from '@/lib/haptics';

export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOnline(navigator.onLine);

    const handleOnline = () => {
      setOnline(true);
      void handleFlush();
    };
    const handleOffline = () => {
      setOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    const unbind = onPendingChange((count) => {
      setPending(count);
      if (count === 0 && syncing) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 2500);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unbind();
    };
  }, [syncing]);

  async function handleFlush() {
    if (syncing) return;
    triggerHaptic('light');
    setSyncing(true);
    try {
      await flush();
    } finally {
      setSyncing(false);
    }
  }

  if (online && pending === 0 && !justSynced) {
    return null;
  }

  return (
    <div className="sticky top-0 z-30 w-full animate-in slide-in-from-top duration-200">
      {!online ? (
        <div className="flex items-center justify-between bg-skip px-4 py-2 text-xs font-bold text-white shadow-md">
          <div className="flex items-center gap-2">
            <span className="animate-pulse text-sm">⚡</span>
            <span>
              Modo Offline · {pending} altera{pending === 1 ? 'ção' : 'ções'} salva{pending === 1 ? '' : 's'} no aparelho
            </span>
          </div>
          <button
            onClick={handleFlush}
            disabled={syncing}
            className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-white transition active:scale-95"
          >
            {syncing ? 'Verificando…' : 'Tentar agora'}
          </button>
        </div>
      ) : pending > 0 ? (
        <div className="flex items-center justify-between bg-brand px-4 py-2 text-xs font-bold text-white shadow-md">
          <div className="flex items-center gap-2">
            <span className="animate-spin text-sm">🔄</span>
            <span>Sincronizando {pending} marcações com o servidor…</span>
          </div>
          <button
            onClick={handleFlush}
            disabled={syncing}
            className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-white transition active:scale-95"
          >
            Sincronizar
          </button>
        </div>
      ) : justSynced ? (
        <div className="flex items-center justify-center gap-1.5 bg-done px-4 py-1.5 text-xs font-bold text-white shadow-sm">
          <span>✓</span>
          <span>Tudo sincronizado! Treino atualizado.</span>
        </div>
      ) : null}
    </div>
  );
}
