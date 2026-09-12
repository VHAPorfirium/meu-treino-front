'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { AlternativeExercise } from '@/lib/types';
import { exercisesApi } from '@/lib/api/endpoints';

const STRIPE =
  'repeating-linear-gradient(135deg,#EFE7DC 0 6px,#E5DBCE 6px 12px)';

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

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55">
      <div className="app-shell safe-bottom max-h-[82vh] overflow-y-auto rounded-t-3xl bg-paper p-5">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line3" />
        <div className="mb-4">
          <h2 className="font-display text-[26px] font-extrabold tracking-tight">
            Trocar por outro
          </h2>
          <p className="mt-1 text-sm text-muted2">
            no lugar de{' '}
            <span className="font-extrabold capitalize text-ink">
              {exerciseName}
            </span>
          </p>
        </div>

        {error && <p className="text-sm font-semibold text-brand">{error}</p>}
        {!alts && !error && (
          <p className="py-8 text-center text-muted2">Carregando…</p>
        )}
        {alts && alts.length === 0 && (
          <p className="py-8 text-center text-muted2">
            Sem alternativas cadastradas para este exercício.
          </p>
        )}

        <div className="space-y-3">
          {alts?.map((alt) => (
            <button
              key={alt.id}
              onClick={() => onPick(alt)}
              className="flex w-full items-center gap-3 rounded-2xl border-2 border-line bg-card p-3 text-left transition active:scale-[0.99]"
            >
              {alt.thumbnailUrl ? (
                <Image
                  src={alt.thumbnailUrl}
                  alt={alt.name}
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-[14px] bg-white object-cover"
                  unoptimized
                />
              ) : (
                <div
                  className="h-16 w-16 rounded-[14px]"
                  style={{ background: STRIPE }}
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-extrabold capitalize leading-tight">
                  {alt.name}
                </p>
                <p className="mt-1 text-[13px] font-semibold capitalize text-muted2">
                  {alt.equipment ?? '—'}
                </p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-replace text-replace">
                ⇄
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
