'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { flush, onPendingChange } from '@/lib/offline/queue';
import { triggerHaptic } from '@/lib/haptics';

export function ConnectionStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const syncingRef = useRef(false);
  const syncedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleFlush = useCallback(async () => {
    if (syncingRef.current) return;
    triggerHaptic('light');
    syncingRef.current = true;
    setSyncing(true);
    try {
      await flush();
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, []);

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
      if (count === 0 && syncingRef.current) {
        setJustSynced(true);
        if (syncedTimerRef.current) clearTimeout(syncedTimerRef.current);
        syncedTimerRef.current = setTimeout(() => {
          syncedTimerRef.current = null;
          setJustSynced(false);
        }, 2500);
      }
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unbind();
      if (syncedTimerRef.current) {
        clearTimeout(syncedTimerRef.current);
        syncedTimerRef.current = null;
      }
    };
  }, [handleFlush]);

  if (online && pending === 0 && !justSynced) {
    return null;
  }

  return (
    <div className="w-full">
      {!online ? (
        <div className="flex items-center justify-between gap-2 bg-skip px-4 py-2 text-xs font-bold text-on-skip shadow-md">
          <div className="flex min-w-0 items-center gap-2">
            <span className="animate-pulse text-sm">⚡</span>
            <span className="truncate">
              Modo Offline · {pending} altera{pending === 1 ? 'ção' : 'ções'} salva{pending === 1 ? '' : 's'} no aparelho
            </span>
          </div>
          <button
            type="button"
            onClick={handleFlush}
            disabled={syncing}
            className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-on-skip transition active:scale-95"
          >
            {syncing ? 'Verificando…' : 'Tentar agora'}
          </button>
        </div>
      ) : pending > 0 ? (
        <div className="flex items-center justify-between gap-2 bg-brand px-4 py-2 text-xs font-bold text-white shadow-md">
          <div className="flex min-w-0 items-center gap-2">
            <span className="animate-spin text-sm">🔄</span>
            <span className="truncate">
              Sincronizando {pending} marcaç{pending === 1 ? 'ão' : 'ões'} com o servidor…
            </span>
          </div>
          <button
            type="button"
            onClick={handleFlush}
            disabled={syncing}
            className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-white transition active:scale-95"
          >
            Sincronizar
          </button>
        </div>
      ) : justSynced ? (
        <div className="flex items-center justify-center gap-1.5 bg-done px-4 py-1.5 text-xs font-bold text-on-done shadow-sm">
          <span>✓</span>
          <span>Tudo sincronizado! Treino atualizado.</span>
        </div>
      ) : null}
    </div>
  );
}
