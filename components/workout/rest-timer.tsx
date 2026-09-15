'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * E3 — timer de descanso. Conta a partir de um INSTANTE-ALVO (Date.now() + s),
 * não de um setInterval acumulado: assim continua certo se o app for pro background
 * e voltar. Ao zerar: vibra (se suportado) + beep curto (Web Audio, sem arquivo).
 */
export function RestTimer({
  seconds,
  label = 'Descanso',
  terminaEm,
  onAlvo,
  onDone,
  onClose,
}: {
  seconds: number;
  /** E10 — o mesmo cronômetro serve pro descanso e pro bloco de cardio. */
  label?: string;
  /**
   * E13 — instante absoluto do fim, quando o timer está sendo RETOMADO depois de
   * o app ter sido fechado. Sem isso, voltar pro app reiniciava a contagem.
   */
  terminaEm?: number;
  /** E13 — avisa o alvo atual pra quem persiste o rascunho (muda no +15s/+30s). */
  onAlvo?: (terminaEm: number | null) => void;
  onDone?: () => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(() => terminaEm ?? Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        try {
          navigator.vibrate?.([200, 100, 200]);
        } catch {
          /* ignore */
        }
        beep();
        onDone?.();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    const onVis = () => document.visibilityState === 'visible' && tick();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [target, onDone]);

  // avisa o alvo (inicial e a cada +15s/+30s) pra ele ser gravado no rascunho
  useEffect(() => {
    onAlvo?.(target);
  }, [target, onAlvo]);

  const add = (s: number) => {
    firedRef.current = false;
    setTarget((t) => Math.max(Date.now(), t) + s * 1000);
  };

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const pct = seconds > 0 ? Math.min(100, ((seconds - left) / seconds) * 100) : 100;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3 pb-[max(env(safe-area-inset-bottom),12px)]">
      <div className="rounded-3xl border border-line bg-ink p-4 text-white shadow-2xl">
        <div className="flex items-center justify-between">
          <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/60">
            {label}
          </p>
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold"
          >
            Fechar
          </button>
        </div>
        <p
          className={`my-1 text-center font-display text-[56px] font-extrabold leading-none tabular-nums ${
            left === 0 ? 'text-brand' : ''
          }`}
          aria-live="polite"
        >
          {mm}:{ss}
        </p>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div className="h-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => add(15)}
            className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-extrabold"
          >
            +15s
          </button>
          <button
            onClick={() => add(30)}
            className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-extrabold"
          >
            +30s
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white"
          >
            {left === 0 ? 'Bora! →' : 'Pular'}
          </button>
        </div>
      </div>
    </div>
  );
}

function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => void ctx.close();
  } catch {
    /* sem áudio, sem problema */
  }
}
