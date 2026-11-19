'use client';

import { useEffect, useState } from 'react';
import { triggerHaptic } from '@/lib/haptics';

export function PwaInstallBanner() {
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Se já estiver em modo standalone (app instalado), não exibe
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) return;

    // Se a usuária já fechou recentemente
    const dismissed = localStorage.getItem('pwa_banner_dismissed');
    if (dismissed && Date.now() - Number(dismissed) < 7 * 24 * 60 * 60 * 1000) {
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const isApple = /iphone|ipad|ipod/.test(ua);
    setIsIos(isApple);

    // Mostra após 3 segundos da primeira visita
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  function dismiss() {
    triggerHaptic('light');
    setShow(false);
    localStorage.setItem('pwa_banner_dismissed', String(Date.now()));
  }

  if (!show) return null;

  return (
    <div className="relative mx-4 my-3 rounded-2xl border border-line bg-card p-4 shadow-md animate-in fade-in slide-in-from-bottom duration-300">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl text-white font-display font-extrabold shadow-brand">
            R
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-ink">
              Instale o Ritmo no celular
            </h3>
            <p className="text-xs text-muted leading-tight mt-0.5">
              Abra em tela cheia, use offline e treine sem distrações do navegador.
            </p>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-chip text-xs font-bold text-muted2"
        >
          ✕
        </button>
      </div>

      <div className="mt-3 rounded-xl bg-chip/60 px-3 py-2 text-[11px] font-semibold text-muted">
        {isIos ? (
          <span>
            👉 No Safari: toque em <b>Compartilhar</b> (ícone do meio) e escolha{' '}
            <b>"Adicionar à Tela de Início"</b>.
          </span>
        ) : (
          <span>
            👉 No Chrome: toque nos <b>três pontinhos</b> e escolha{' '}
            <b>"Instalar aplicativo"</b>.
          </span>
        )}
      </div>
    </div>
  );
}
