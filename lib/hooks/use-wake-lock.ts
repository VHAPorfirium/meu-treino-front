'use client';

import { useEffect } from 'react';

/**
 * E13 — mantém a tela acesa enquanto o treino está em andamento.
 *
 * Isto ataca a **causa**, não o sintoma: quando a tela apaga e o app vai pro
 * segundo plano, o iOS tende a matar o PWA — e é aí que se perde o estado. Com a
 * tela acesa entre uma série e outra, isso deixa de acontecer na maior parte das
 * vezes. O rascunho continua sendo a rede de segurança pra quando acontecer.
 *
 * `wakeLock` não existe em todo navegador (Safari só a partir do iOS 16.4) e o
 * sistema pode revogar a qualquer momento — por isso tudo aqui é best-effort e
 * silencioso. O `visibilitychange` repede o bloqueio ao voltar, porque o
 * navegador o solta sozinho quando a aba sai de vista.
 */
export function useWakeLock(ativo: boolean): void {
  useEffect(() => {
    if (!ativo || typeof navigator === 'undefined') return;

    type Sentinela = { release: () => Promise<void> };
    const api = (
      navigator as unknown as {
        wakeLock?: { request: (t: 'screen') => Promise<Sentinela> };
      }
    ).wakeLock;
    if (!api) return;

    let sentinela: Sentinela | null = null;
    let descartado = false;

    const pedir = async () => {
      if (descartado || document.visibilityState !== 'visible') return;
      try {
        sentinela = await api.request('screen');
      } catch {
        /* negado ou sem suporte — o treino segue normal */
      }
    };

    const aoVoltar = () => {
      if (document.visibilityState === 'visible') void pedir();
    };

    void pedir();
    document.addEventListener('visibilitychange', aoVoltar);

    return () => {
      descartado = true;
      document.removeEventListener('visibilitychange', aoVoltar);
      void sentinela?.release().catch(() => {});
    };
  }, [ativo]);
}
