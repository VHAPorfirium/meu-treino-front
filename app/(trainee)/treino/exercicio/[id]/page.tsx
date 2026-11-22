'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { equipamentoExercicio, musculoExercicio, nomeExercicio } from '@/lib/exercicios/modo';
import type { AlternativeExercise, Exercise, ExerciseStats } from '@/lib/types';
import { exercisesApi, workoutLogsApi } from '@/lib/api/endpoints';
import { triggerHaptic } from '@/lib/haptics';
import { SectionTitle } from '@/components/trainee/section-title';
import { StatTile } from '@/components/trainee/stat-tile';

const STRIPE = 'repeating-linear-gradient(135deg,#EFE7DC 0 8px,#E5DBCE 8px 16px)';
const COLLAPSED_STEPS_COUNT = 3;

/** Quebra as instruções em passos (uma linha ou frase por passo). */
function splitInstructionSteps(instructions: string): string[] {
  const lines = instructions
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)-]\s*/, '').trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  return instructions
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/** Detalhe do exercício: GIF, chips, os números do aluno e o passo a passo. */
export default function ExercicioDetailPage() {
  const { id: exerciseId } = useParams<{ id: string }>();
  const router = useRouter();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeExercise[]>([]);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [areAllStepsVisible, setAreAllStepsVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciseId) return;
    Promise.all([exercisesApi.get(exerciseId), exercisesApi.alternatives(exerciseId)])
      .then(([loadedExercise, loadedAlternatives]) => {
        setExercise(loadedExercise);
        setAlternatives(loadedAlternatives);
      })
      .catch(() => setErrorMessage('Não foi possível carregar o exercício.'));
    workoutLogsApi.exerciseStats(exerciseId).then(setExerciseStats).catch(() => {});
    exercisesApi
      .favorites()
      .then((favoriteExercises) =>
        setIsFavorite(favoriteExercises.some((favoriteExercise) => favoriteExercise.id === exerciseId)),
      )
      .catch(() => {});
  }, [exerciseId]);

  async function toggleFavorite() {
    triggerHaptic('light');
    const willBeFavorite = !isFavorite;
    setIsFavorite(willBeFavorite); // otimista
    try {
      if (willBeFavorite) await exercisesApi.favorite(exerciseId);
      else await exercisesApi.unfavorite(exerciseId);
    } catch {
      setIsFavorite(!willBeFavorite);
    }
  }

  const instructionSteps = exercise?.instructions ? splitInstructionSteps(exercise.instructions) : [];
  const visibleSteps = areAllStepsVisible ? instructionSteps : instructionSteps.slice(0, COLLAPSED_STEPS_COUNT);
  const evolution = exerciseStats?.evolutionLast30DaysPercentage;

  return (
    <>
      <header className="safe-top sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Voltar"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-chip text-lg font-extrabold text-ink"
        >
          ←
        </button>
        <button
          type="button"
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition active:scale-95 ${
            isFavorite ? 'bg-gold-bg text-gold' : 'bg-chip text-muted'
          }`}
        >
          {isFavorite ? '★ Favorito' : '☆ Favoritar'}
        </button>
      </header>

      <div className="space-y-4 p-5 pb-28">
        {errorMessage && <p className="py-10 text-center text-brand">{errorMessage}</p>}
        {!exercise && !errorMessage && <p className="py-10 text-center text-muted2">Carregando…</p>}

        {exercise && (
          <>
            <div className="overflow-hidden rounded-3xl border border-line bg-white">
              {exercise.gifUrl ? (
                <Image
                  src={exercise.gifUrl}
                  alt={nomeExercicio(exercise)}
                  width={400}
                  height={320}
                  className="h-[240px] w-full object-contain"
                  unoptimized
                />
              ) : (
                <div className="h-[240px]" style={{ background: STRIPE }} />
              )}
            </div>

            <div>
              <h1 className="font-display text-[28px] font-extrabold capitalize leading-tight tracking-tight text-ink">
                {nomeExercicio(exercise)}
              </h1>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[exercise.bodyPart, musculoExercicio(exercise), equipamentoExercicio(exercise)]
                  .filter(Boolean)
                  .map((chipLabel) => (
                    <span key={chipLabel} className="rounded-full bg-chip px-3 py-1.5 text-xs font-extrabold capitalize text-muted">
                      {chipLabel}
                    </span>
                  ))}
              </div>
            </div>

            {exerciseStats && exerciseStats.timesPerformed > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <StatTile
                  value={exerciseStats.bestWeight != null ? `${exerciseStats.bestWeight} kg` : '–'}
                  label="melhor carga"
                />
                <StatTile value={exerciseStats.timesPerformed} label="vezes feito" />
                <StatTile
                  value={evolution == null ? '–' : `${evolution >= 0 ? '+' : ''}${evolution}%`}
                  label="em 30 dias"
                  valueClassName={evolution != null && evolution > 0 ? '!text-done' : ''}
                />
              </div>
            )}

            {instructionSteps.length > 0 && (
              <section>
                <SectionTitle>Como fazer</SectionTitle>
                <div className="space-y-1.5 rounded-2xl border border-line bg-card p-4 text-sm font-semibold leading-relaxed text-ink2">
                  {visibleSteps.map((instructionStep, stepIndex) => (
                    <p key={stepIndex}>
                      <span className="font-extrabold text-brand">{stepIndex + 1}.</span> {instructionStep}
                    </p>
                  ))}
                  {instructionSteps.length > COLLAPSED_STEPS_COUNT && (
                    <button
                      type="button"
                      onClick={() => setAreAllStepsVisible((isVisible) => !isVisible)}
                      className="text-sm font-extrabold text-brand"
                    >
                      {areAllStepsVisible ? 'ver menos' : 'ver mais'}
                    </button>
                  )}
                </div>
              </section>
            )}

            {alternatives.length > 0 && (
              <section>
                <SectionTitle>Alternativas ({alternatives.length})</SectionTitle>
                <div className="space-y-2">
                  {alternatives.map((alternative) => (
                    <button
                      key={alternative.id}
                      type="button"
                      onClick={() => router.push(`/treino/exercicio/${alternative.id}`)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3 text-left"
                    >
                      {alternative.thumbnailUrl ? (
                        <Image
                          src={alternative.thumbnailUrl}
                          alt={alternative.name}
                          width={48}
                          height={48}
                          className="h-12 w-12 rounded-xl bg-white object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl" style={{ background: STRIPE }} />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-extrabold capitalize text-ink">
                          {nomeExercicio(alternative)}
                        </span>
                        <span className="block text-xs font-semibold capitalize text-muted2">
                          {equipamentoExercicio(alternative)}
                        </span>
                      </span>
                      <span className="text-muted2">›</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {exercise.attribution && <p className="text-center text-[10px] text-faint">{exercise.attribution}</p>}
          </>
        )}
      </div>
    </>
  );
}
