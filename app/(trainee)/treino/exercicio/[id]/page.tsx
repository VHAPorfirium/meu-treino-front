'use client';

import { useEffect, useState } from 'react';
import {
  equipamentoExercicio,
  musculoExercicio,
  nomeExercicio,
} from '@/lib/exercicios/modo';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import type { AlternativeExercise, Exercise } from '@/lib/types';
import { exercisesApi } from '@/lib/api/endpoints';

const STRIPE =
  'repeating-linear-gradient(135deg,#EFE7DC 0 8px,#E5DBCE 8px 16px)';

export default function ExercicioDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ex, setEx] = useState<Exercise | null>(null);
  const [alts, setAlts] = useState<AlternativeExercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([exercisesApi.get(id), exercisesApi.alternatives(id)])
      .then(([e, a]) => {
        setEx(e);
        setAlts(a);
      })
      .catch(() => setError('Não foi possível carregar o exercício.'));
  }, [id]);

  return (
    <div className="app-shell">
      <header className="safe-top sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
        <button
          onClick={() => router.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-chip text-xl font-extrabold"
        >
          ‹
        </button>
        <span className="text-sm font-extrabold text-muted2">Exercício</span>
        <span className="w-10" />
      </header>

      <div className="space-y-4 p-5 pb-24">
        {error && <p className="py-10 text-center text-brand">{error}</p>}
        {!ex && !error && (
          <p className="py-10 text-center text-muted2">Carregando…</p>
        )}

        {ex && (
          <>
            <div className="relative overflow-hidden rounded-3xl border border-line bg-white">
              {ex.gifUrl ? (
                <Image
                  src={ex.gifUrl}
                  alt={nomeExercicio(ex)}
                  width={400}
                  height={320}
                  className="h-[240px] w-full object-contain"
                  unoptimized
                />
              ) : (
                <div className="h-[240px]" style={{ background: STRIPE }} />
              )}
              <span className="absolute left-3.5 top-3.5 rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-paper">
                {ex.bodyPart}
              </span>
            </div>

            <div>
              <h1 className="font-display text-[30px] font-extrabold capitalize leading-tight tracking-tight">
                {nomeExercicio(ex)}
              </h1>
              <p className="mt-1 text-sm font-semibold capitalize text-muted2">
                {equipamentoExercicio(ex)} · {musculoExercicio(ex)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <InfoTile label="Grupo" value={ex.bodyPart} />
              <InfoTile label="Alvo" value={musculoExercicio(ex)} />
            </div>

            {ex.instructions && (
              <div className="rounded-2xl border border-line bg-card p-4">
                <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted2">
                  Como fazer
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-ink2">
                  {ex.instructions}
                </p>
              </div>
            )}

            {alts.length > 0 && (
              <div>
                <h2 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted2">
                  Alternativas ({alts.length})
                </h2>
                <div className="space-y-2">
                  {alts.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3"
                    >
                      {a.thumbnailUrl ? (
                        <Image
                          src={a.thumbnailUrl}
                          alt={a.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-xl bg-white object-cover"
                          unoptimized
                        />
                      ) : (
                        <div
                          className="h-12 w-12 rounded-xl"
                          style={{ background: STRIPE }}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-extrabold capitalize">
                          {a.name}
                        </p>
                        <p className="text-xs font-semibold capitalize text-muted2">
                          {equipamentoExercicio(a)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ex.attribution && (
              <p className="text-center text-[10px] text-faint">{ex.attribution}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3 text-center">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-extrabold capitalize">
        {value}
      </p>
    </div>
  );
}
