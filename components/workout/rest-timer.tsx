'use client';

import { useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '@/lib/haptics';
import { playTimerDoneSound, unlockAudio } from '@/lib/audio';

/**
 * Timer de descanso mobile multitarefa:
 * - Conta a partir de um instante absoluto (continua certo em background/tela bloqueada).
 * - Suporta modo expandido e modo minimizado (pill flutuante) para a aluna navegar pelos exercícios sem fechar o timer.
 * - Vibração tátil + som rítmico otimizado para iOS e Android ao zerar.
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
  label?: string;
  terminaEm?: number;
  onAlvo?: (terminaEm: number | null) => void;
  onDone?: () => void;
  onClose: () => void;
}) {
  const [target, setTarget] = useState(() => terminaEm ?? Date.now() + seconds * 1000);
  const [left, setLeft] = useState(seconds);
  const [minimized, setMinimized] = useState(false);
  const firedRef = useRef(false);

  useEffect(() => {
    // Destrava áudio na montagem
    unlockAudio();

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((target - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !firedRef.current) {
        firedRef.current = true;
        triggerHaptic('success');
        playTimerDoneSound();
        // Se estiver minimizado, expande automaticamente para avisar que o descanso acabou!
        setMinimized(false);
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

  useEffect(() => {
    onAlvo?.(target);
  }, [target, onAlvo]);

  const add = (s: number) => {
    firedRef.current = false;
    triggerHaptic('light');
    setTarget((t) => Math.max(Date.now(), t) + s * 1000);
  };

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const pct = seconds > 0 ? Math.min(100, ((seconds - left) / seconds) * 100) : 100;

  // Modo Minimizado: Pill flutuante no canto da tela (permite navegar pela ficha de treino)
  if (minimized) {
    return (
      <div className="fixed bottom-20 right-4 z-40 max-w-xs animate-in fade-in zoom-in-90 duration-150">
        <button
          onClick={() => {
            triggerHaptic('light');
            setMinimized(false);
          }}
          className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-2xl border border-line ${
            left === 0 ? 'bg-brand text-white animate-pulse' : 'bg-inverse text-on-inverse'
          }`}
          aria-label="Expandir cronômetro"
        >
          <span className="text-base">⏱️</span>
          <span className="font-display text-lg font-extrabold tabular-nums">
            {mm}:{ss}
          </span>
          <span className="text-xs font-semibold text-on-inverse-muted truncate max-w-[80px]">
            {label}
          </span>
        </button>
      </div>
    );
  }

  // Modo Expandido
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md p-3 pb-[max(env(safe-area-inset-bottom),12px)] animate-in slide-in-from-bottom duration-200">
      <div className="rounded-3xl border border-line bg-inverse p-4 text-on-inverse shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">⏱️</span>
            <p className="truncate text-[11px] font-extrabold uppercase tracking-[0.18em] text-on-inverse-muted">
              {label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                triggerHaptic('light');
                setMinimized(true);
              }}
              title="Minimizar para continuar olhando o treino"
              className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold transition active:scale-95"
            >
              Minimizar
            </button>
            <button
              onClick={() => {
                triggerHaptic('light');
                onClose();
              }}
              className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold transition active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        <p
          className={`my-1 text-center font-display text-[58px] font-extrabold leading-none tabular-nums tracking-tight ${
            left === 0 ? 'text-brand animate-bounce' : 'text-on-inverse'
          }`}
          aria-live="polite"
        >
          {mm}:{ss}
        </p>

        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className={`h-full transition-[width] duration-300 ${
              left === 0 ? 'bg-brand' : 'bg-brand'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Botões rápidos ergonomicamente espaçados */}
        <div className="flex gap-2">
          <button
            onClick={() => add(15)}
            className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-extrabold transition active:scale-95"
          >
            +15s
          </button>
          <button
            onClick={() => add(30)}
            className="flex-1 rounded-xl bg-white/10 py-2.5 text-sm font-extrabold transition active:scale-95"
          >
            +30s
          </button>
          <button
            onClick={() => {
              triggerHaptic('medium');
              onClose();
            }}
            className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white transition active:scale-95 shadow-brand"
          >
            {left === 0 ? 'Bora! 💪' : 'Pular →'}
          </button>
        </div>
      </div>
    </div>
  );
}
