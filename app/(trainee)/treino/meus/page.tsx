'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { HistoryEntry, Workout } from '@/lib/types';
import { workoutLogsApi, workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useCurrentProgram } from '@/lib/programs/use-current-program';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import {
  describeExerciseCount,
  findLastCompletionByWorkoutId,
  shortWeekdayLabel,
  workoutLetter,
} from '@/lib/trainee/workout-history';
import { AppHeader } from '@/components/layout/app-header';
import { SectionTitle } from '@/components/trainee/section-title';
import { Pill, WorkoutListItem } from '@/components/trainee/workout-list-item';

/** Aba "Treinos": os do programa (com o progresso no topo) e os avulsos separados. */
export default function TreinosDoAlunoPage() {
  const [assignedWorkouts, setAssignedWorkouts] = useState<Workout[] | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { currentProgram, loadCurrentProgram } = useCurrentProgram();

  useEffect(() => {
    workoutsApi
      .mine()
      .then(setAssignedWorkouts)
      .catch((error) => setErrorMessage(error instanceof ApiError ? error.message : 'Sem conexão'));
    workoutLogsApi.myHistory().then(setHistoryEntries).catch(() => {});
    void loadCurrentProgram();
  }, [loadCurrentProgram]);

  const lastCompletionByWorkoutId = useMemo(
    () => findLastCompletionByWorkoutId(historyEntries),
    [historyEntries],
  );

  const programWorkoutIds = new Set(currentProgram?.program.workouts.map((workout) => workout.id) ?? []);
  const programWorkouts = (assignedWorkouts ?? []).filter((workout) => programWorkoutIds.has(workout.id));
  const otherWorkouts = (assignedWorkouts ?? []).filter((workout) => !programWorkoutIds.has(workout.id));
  const programTypeRule = currentProgram ? PROGRAM_TYPE_RULES[currentProgram.program.type] : null;

  function describeWorkoutBadge(workout: Workout) {
    if (!workout.active) return <Pill>Inativo</Pill>;
    const lastCompletion = lastCompletionByWorkoutId.get(workout.id);
    if (lastCompletion && Date.now() - lastCompletion.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return <Pill tone="done">✓ {shortWeekdayLabel(lastCompletion.getDay())}</Pill>;
    }
    if (workout.dayOfWeek != null) return <Pill>{shortWeekdayLabel(workout.dayOfWeek)}</Pill>;
    return <Pill>Livre</Pill>;
  }

  return (
    <>
      <AppHeader eyebrow="Sua programação" title="Treinos" />
      <div className="space-y-3.5 p-5 pb-28">
        {assignedWorkouts === null && !errorMessage && (
          <p className="py-10 text-center text-muted2">Carregando…</p>
        )}
        {errorMessage && <p className="py-10 text-center text-brand-ink">{errorMessage}</p>}

        {currentProgram && programTypeRule && programWorkouts.length > 0 && (
          <section>
            {currentProgram.hasDeadline && currentProgram.progress ? (
              <div className="mb-2.5 rounded-2xl bg-gradient-to-br from-amber-700 to-amber-900 px-4 py-3 text-white">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] font-extrabold uppercase tracking-wider text-amber-50">
                    {programTypeRule.icon} {programTypeRule.label} · {currentProgram.program.name}
                  </p>
                  <span className="shrink-0 text-[13px] font-extrabold">
                    {currentProgram.progress.currentDayNumber}/{currentProgram.progress.totalDays}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/30">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${currentProgram.progress.progressPercentage}%` }}
                  />
                </div>
              </div>
            ) : (
              <SectionTitle>
                {programTypeRule.icon} {currentProgram.program.name}
              </SectionTitle>
            )}
            <div className="space-y-2">
              {programWorkouts.map((workout, workoutIndex) => (
                <WorkoutListItem
                  key={workout.id}
                  href={`/treino/sessao/${workout.id}`}
                  letter={workoutLetter(workoutIndex)}
                  title={workout.name}
                  subtitle={describeExerciseCount(workout)}
                  badge={describeWorkoutBadge(workout)}
                />
              ))}
            </div>
          </section>
        )}

        {otherWorkouts.length > 0 && (
          <section>
            <SectionTitle
              action={
                currentProgram?.hasDeadline ? (
                  <span className="text-xs font-bold text-muted2">não contam no {programTypeRule?.label.toLowerCase()}</span>
                ) : undefined
              }
            >
              {programWorkouts.length > 0 ? 'Outros treinos' : 'Seus treinos'}
            </SectionTitle>
            <div className="space-y-2">
              {otherWorkouts.map((workout, workoutIndex) => (
                <WorkoutListItem
                  key={workout.id}
                  href={`/treino/sessao/${workout.id}`}
                  letter={workoutLetter(programWorkouts.length + workoutIndex)}
                  title={workout.name}
                  subtitle={describeExerciseCount(workout)}
                  badge={describeWorkoutBadge(workout)}
                />
              ))}
            </div>
          </section>
        )}

        {assignedWorkouts?.length === 0 && (
          <div className="py-14 text-center text-muted2">
            <p className="text-4xl">📋</p>
            <p className="mt-2 font-semibold">Nenhum treino atribuído ainda.</p>
          </div>
        )}

        <Link
          href="/treino/historico"
          className="flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3.5 transition active:scale-[.99]"
        >
          <span className="text-2xl">📅</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-ink">Seu histórico</span>
            <span className="block text-xs font-bold text-muted2">Calendário do mês e todas as sessões</span>
          </span>
          <span className="text-muted2">›</span>
        </Link>
      </div>
    </>
  );
}
