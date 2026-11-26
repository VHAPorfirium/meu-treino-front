'use client';

import { useEffect, useState } from 'react';
import type { Exercise } from '@/lib/types';
import { exercisesApi } from '@/lib/api/endpoints';
import { PageHead } from '@/components/dashboard/page-head';
import { ExerciseBrowser } from '@/components/dashboard/exercise-browser';
import { AddToWorkoutModal } from '@/components/dashboard/add-to-workout-modal';

/** Catálogo: busca, grupos musculares, favoritos e "+ Treino" direto do card. */
export default function ExerciciosPage() {
  const [favoriteExercises, setFavoriteExercises] = useState<Exercise[]>([]);
  const [isShowingOnlyFavorites, setIsShowingOnlyFavorites] = useState(false);
  const [exerciseToAdd, setExerciseToAdd] = useState<Exercise | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  useEffect(() => {
    exercisesApi.favorites().then(setFavoriteExercises).catch(() => {});
  }, []);

  const favoriteExerciseIds = new Set(favoriteExercises.map((favoriteExercise) => favoriteExercise.id));

  async function toggleFavorite(exercise: Exercise) {
    const willBeFavorite = !favoriteExerciseIds.has(exercise.id);
    setFavoriteExercises((currentFavorites) =>
      willBeFavorite
        ? [exercise, ...currentFavorites]
        : currentFavorites.filter((favoriteExercise) => favoriteExercise.id !== exercise.id),
    );
    try {
      if (willBeFavorite) await exercisesApi.favorite(exercise.id);
      else await exercisesApi.unfavorite(exercise.id);
    } catch {
      exercisesApi.favorites().then(setFavoriteExercises).catch(() => {});
    }
  }

  return (
    <>
      <PageHead
        eyebrow="Programação"
        title="Catálogo de exercícios"
        actions={
          <button
            type="button"
            onClick={() => setIsShowingOnlyFavorites((isShowing) => !isShowing)}
            aria-pressed={isShowingOnlyFavorites}
            className={`rounded-xl px-4 py-2.5 text-sm font-extrabold ${
              isShowingOnlyFavorites ? 'bg-gold-bg text-gold' : 'bg-chip text-ink'
            }`}
          >
            {isShowingOnlyFavorites ? '★' : '☆'} Favoritos · {favoriteExercises.length}
          </button>
        }
      />
      <div className="mx-auto max-w-6xl space-y-3 p-4 sm:p-6 md:p-8">
        {confirmationMessage && (
          <p className="rounded-2xl border border-done bg-done-bg p-3 text-sm font-bold text-done-ink">
            ✓ {confirmationMessage}{' '}
            <button onClick={() => setConfirmationMessage(null)} className="ml-2 underline">
              fechar
            </button>
          </p>
        )}
        {isShowingOnlyFavorites && favoriteExercises.length === 0 && (
          <p className="rounded-2xl bg-chip p-4 text-center text-sm font-bold text-muted">
            Nenhum favorito ainda. Toque na ☆ de um exercício para salvar aqui.
          </p>
        )}
        <ExerciseBrowser
          onlyTheseExercises={isShowingOnlyFavorites ? favoriteExercises : null}
          cardActions={(exercise) => {
            const isFavorite = favoriteExerciseIds.has(exercise.id);
            return (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setExerciseToAdd(exercise)}
                  className="rounded-full bg-brand px-2.5 py-1 text-[11px] font-extrabold text-white"
                >
                  ＋ Treino
                </button>
                <button
                  type="button"
                  onClick={() => toggleFavorite(exercise)}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                  className={`ml-auto rounded-full px-2 py-1 text-[13px] font-extrabold ${
                    isFavorite ? 'bg-gold-bg text-gold' : 'bg-chip text-muted2'
                  }`}
                >
                  {isFavorite ? '★' : '☆'}
                </button>
              </div>
            );
          }}
        />
      </div>

      {exerciseToAdd && (
        <AddToWorkoutModal
          exercise={exerciseToAdd}
          onClose={() => setExerciseToAdd(null)}
          onAdded={(workoutName) => {
            setConfirmationMessage(`Adicionado ao treino “${workoutName}”.`);
            setExerciseToAdd(null);
          }}
        />
      )}
    </>
  );
}
