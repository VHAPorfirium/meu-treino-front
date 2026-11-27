'use client';

import { useEffect, useState } from 'react';
import { equipamentoExercicio, nomeExercicio } from '@/lib/exercicios/modo';
import Image from 'next/image';
import type { AlternativeExercise } from '@/lib/types';
import { exercisesApi } from '@/lib/api/endpoints';
import { triggerHaptic } from '@/lib/haptics';

const STRIPE =
  'repeating-linear-gradient(135deg,rgb(var(--color-chip)) 0 6px,rgb(var(--color-line)) 6px 12px)';

export function AlternativesModal({
  exerciseId,
  exerciseName,
  onPick,
  onClose,
}: {
  exerciseId: string;
  exerciseName: string;
  onPick: (alt: AlternativeExercise) => void;
  onClose: () => void;
}) {
  const [alts, setAlts] = useState<AlternativeExercise[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    exercisesApi
      .alternatives(exerciseId)
      .then(setAlts)
      .catch(() => setError('Não foi possível carregar alternativas'));
  }, [exerciseId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trocar exercício"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic('light');
          onClose();
        }
      }}
    >
      <div className="flex max-h-[85dvh] w-full max-w-[440px] flex-col rounded-t-3xl border-t border-line bg-paper p-5 pb-[calc(env(safe-area-inset-bottom,0px)+20px)] shadow-2xl">
        {/* Barra de arrasto (drag handle) */}
        <div className="mx-auto mb-3 h-1.5 w-12 shrink-0 rounded-full bg-line3" />

        <div className="mb-3 flex shrink-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-tight">
              Trocar exercício
            </h2>
            <p className="mt-0.5 text-xs text-muted2">
              Substituir <span className="font-bold capitalize text-ink">{exerciseName}</span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-chip text-sm font-bold text-muted2"
          >
            ✕
          </button>
        </div>

        {error && <p className="text-sm font-semibold text-brand-ink py-4 text-center">{error}</p>}
        {!alts && !error && (
          <p className="py-12 text-center text-sm font-semibold text-muted2">Buscando alternativas compatíveis…</p>
        )}
        {alts && alts.length === 0 && (
          <div className="py-10 text-center text-muted2">
            <p className="text-3xl">🔍</p>
            <p className="mt-2 text-sm font-semibold">Sem alternativas diretas cadastradas.</p>
          </div>
        )}

        <div className="overflow-y-auto space-y-2.5 pr-0.5">
          {alts?.map((alt) => (
            <button
              key={alt.id}
              onClick={() => {
                triggerHaptic('medium');
                onPick(alt);
              }}
              className="flex w-full items-center gap-3.5 rounded-2xl border border-line bg-card p-3 text-left transition active:scale-[0.98]"
            >
              {alt.thumbnailUrl ? (
                <Image
                  src={alt.thumbnailUrl}
                  alt={nomeExercicio(alt)}
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0 rounded-xl bg-card object-cover"
                  unoptimized
                />
              ) : (
                <div
                  className="h-14 w-14 shrink-0 rounded-xl"
                  style={{ background: STRIPE }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-extrabold capitalize leading-tight text-ink">
                  {nomeExercicio(alt)}
                </p>
                <p className="mt-1 text-xs font-semibold capitalize text-muted2">
                  {equipamentoExercicio(alt)}
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-replace-bg text-sm font-bold text-replace">
                ⇄
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
