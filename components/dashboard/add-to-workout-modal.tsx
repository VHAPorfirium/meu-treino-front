'use client';

import { useEffect, useState } from 'react';
import type { Exercise, ExerciseMode, Workout } from '@/lib/types';
import { workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { modoSugerido, nomeExercicio } from '@/lib/exercicios/modo';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';

const INPUT_CLASS_NAME =
  'w-full rounded-xl border border-line bg-paper px-3 py-2 text-center text-base font-bold text-ink focus:border-brand focus:outline-none';

/** "+ Treino" do catálogo: escolhe o treino e a prescrição e adiciona o exercício no fim. */
export function AddToWorkoutModal({
  exercise,
  onClose,
  onAdded,
}: {
  exercise: Exercise;
  onClose: () => void;
  onAdded: (workoutName: string) => void;
}) {
  const [workouts, setWorkouts] = useState<Workout[] | null>(null);
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(null);
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode>(() => modoSugerido(exercise));
  const [setsCount, setSetsCount] = useState('3');
  const [repetitions, setRepetitions] = useState('10-12');
  const [durationMinutes, setDurationMinutes] = useState('20');
  const [restSeconds, setRestSeconds] = useState('60');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    workoutsApi
      .list()
      .then(setWorkouts)
      .catch(() => setWorkouts([]));
  }, []);

  async function confirmAddition() {
    const selectedWorkout = workouts?.find((workout) => workout.id === selectedWorkoutId);
    if (!selectedWorkout) return setErrorMessage('Escolha um treino.');
    setIsSaving(true);
    setErrorMessage(null);
    const parsedRestSeconds = Number(restSeconds);
    const restSecondsOrUndefined =
      Number.isFinite(parsedRestSeconds) && parsedRestSeconds >= 0 ? parsedRestSeconds : undefined;
    try {
      await workoutsApi.addExercisesBatch(selectedWorkout.id, [
        exerciseMode === 'TIME'
          ? {
              exerciseId: exercise.id,
              mode: 'TIME',
              durationSeconds: Math.round((Number(durationMinutes) > 0 ? Number(durationMinutes) : 20) * 60),
              restSeconds: restSecondsOrUndefined,
            }
          : {
              exerciseId: exercise.id,
              mode: 'REPS',
              sets: Number(setsCount) > 0 ? Number(setsCount) : 3,
              reps: repetitions.trim() || '10-12',
              restSeconds: restSecondsOrUndefined,
            },
      ]);
      onAdded(selectedWorkout.name);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Não foi possível adicionar');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 md:items-center">
      <div className="flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-paper md:rounded-3xl">
        <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">Adicionar a um treino</p>
            <h2 className="truncate font-display text-[20px] font-extrabold capitalize">{nomeExercicio(exercise)}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted">
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          <div className="space-y-1.5">
            {workouts === null && <p className="text-sm text-muted2">Carregando treinos…</p>}
            {workouts?.length === 0 && <p className="text-sm text-muted2">Crie um treino primeiro.</p>}
            {workouts?.map((workout) => (
              <button
                key={workout.id}
                type="button"
                onClick={() => setSelectedWorkoutId(workout.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left ${
                  selectedWorkoutId === workout.id ? 'border-2 border-brand bg-card' : 'border-line bg-card'
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{workout.name}</span>
                  <span className="block truncate text-xs font-bold text-muted2">
                    {workout.program ? `${PROGRAM_TYPE_RULES[workout.program.type].icon} ${workout.program.name}` : 'Avulso'}
                    {workout._count ? ` · ${workout._count.exercises} exercícios` : ''}
                  </span>
                </span>
                {selectedWorkoutId === workout.id && <span className="font-extrabold text-brand">✓</span>}
              </button>
            ))}
          </div>

          <div className="space-y-2 rounded-2xl border border-line bg-card p-3">
            {exerciseMode === 'TIME' ? (
              <div className="grid grid-cols-2 gap-2">
                <PrescriptionField label="Minutos" value={durationMinutes} onChange={setDurationMinutes} />
                <PrescriptionField label="Descanso (s)" value={restSeconds} onChange={setRestSeconds} />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <PrescriptionField label="Séries" value={setsCount} onChange={setSetsCount} />
                <PrescriptionField label="Reps" value={repetitions} onChange={setRepetitions} isText />
                <PrescriptionField label="Descanso (s)" value={restSeconds} onChange={setRestSeconds} />
              </div>
            )}
            <button
              type="button"
              onClick={() => setExerciseMode((currentMode) => (currentMode === 'TIME' ? 'REPS' : 'TIME'))}
              className="text-[11px] font-bold text-muted2 underline"
            >
              {exerciseMode === 'TIME' ? 'medir por séries e repetições' : 'medir por tempo'}
            </button>
          </div>
          {errorMessage && <p className="text-sm font-semibold text-brand">{errorMessage}</p>}
        </div>

        <div className="border-t border-line p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          <button
            type="button"
            onClick={confirmAddition}
            disabled={isSaving || !selectedWorkoutId}
            className="w-full rounded-2xl bg-brand py-3 text-sm font-extrabold text-white shadow-brand disabled:opacity-50"
          >
            {isSaving ? 'Adicionando…' : 'Adicionar ao treino'}
          </button>
        </div>
      </div>
    </div>
  );
}

function PrescriptionField({
  label,
  value,
  onChange,
  isText = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isText?: boolean;
}) {
  return (
    <label className="block text-[11px] font-extrabold uppercase tracking-wide text-muted2">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={isText ? 'text' : 'numeric'}
        className={`mt-1 ${INPUT_CLASS_NAME}`}
      />
    </label>
  );
}
