'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { HistoryEntry, TodayResponse, Workout } from '@/lib/types';
import { notesApi, workoutLogsApi, workoutsApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/auth-context';
import { useCurrentProgram } from '@/lib/programs/use-current-program';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import {
  collectCompletedDayKeys,
  describeExerciseCount,
  describeLastCompletion,
  findLastCompletionByWorkoutId,
  greetingForHour,
  longWeekdayLabel,
  shortWeekdayLabel,
  workoutLetter,
} from '@/lib/trainee/workout-history';
import { AppHeader } from '@/components/layout/app-header';
import { ConnectionStatus } from '@/components/layout/connection-status';
import { PwaInstallBanner } from '@/components/layout/pwa-install-banner';
import { PushOptIn } from '@/components/layout/push-opt-in';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { WeekStrip } from '@/components/trainee/week-strip';
import { SectionTitle } from '@/components/trainee/section-title';
import { Pill, WorkoutListItem } from '@/components/trainee/workout-list-item';
import { WorkoutTile } from '@/components/trainee/workout-tile';
import { ProgramHeroCard } from '@/components/trainee/program-hero-card';
import {
  type RecommendedWorkout,
  RecommendedWorkoutCard,
} from '@/components/trainee/recommended-workout-card';
import { ChallengeCompletedCelebration } from '@/components/programs/challenge-completed-celebration';

type HomeTab = 'program' | 'others';

const TODAY_LABEL = () =>
  new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

/**
 * Tela inicial do aluno: o treino recomendado do dia e a escolha do que fazer.
 * Em desafio/mesociclo há duas abas (o programa e os treinos avulsos); no treino
 * contínuo, um card com o recomendado e os outros treinos em grade.
 */
export default function TraineeHomePage() {
  const { user } = useAuth();
  const [todayResponse, setTodayResponse] = useState<TodayResponse | null>(null);
  const [assignedWorkouts, setAssignedWorkouts] = useState<Workout[] | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<HomeTab>('program');
  const {
    currentProgram,
    celebration,
    loadCurrentProgram,
    openAchievementOfCurrentProgram,
    closeCelebration,
  } = useCurrentProgram();

  useEffect(() => {
    workoutsApi
      .today(new Date().getDay())
      .then(setTodayResponse)
      .catch(() => setErrorMessage('Sem conexão — não foi possível carregar seus treinos.'));
    workoutsApi
      .mine()
      .then(setAssignedWorkouts)
      .catch(() => setAssignedWorkouts([]));
    workoutLogsApi.myHistory().then(setHistoryEntries).catch(() => {});
    notesApi
      .mine()
      .then((notesResponse) => setUnreadNotesCount(notesResponse.unread))
      .catch(() => {});
    void loadCurrentProgram();
  }, [loadCurrentProgram]);

  const completedDayKeys = useMemo(() => collectCompletedDayKeys(historyEntries), [historyEntries]);
  const lastCompletionByWorkoutId = useMemo(
    () => findLastCompletionByWorkoutId(historyEntries),
    [historyEntries],
  );

  const activeWorkouts = (assignedWorkouts ?? []).filter((workout) => workout.active);
  const programWorkoutIds = new Set(currentProgram?.program.workouts.map((workout) => workout.id) ?? []);
  const isInProgramWithDeadline = Boolean(currentProgram?.hasDeadline);
  const programWorkouts = activeWorkouts.filter((workout) => programWorkoutIds.has(workout.id));
  const otherWorkouts = activeWorkouts.filter((workout) => !programWorkoutIds.has(workout.id));

  const todayWorkout = todayResponse?.workout ?? null;
  const findWorkout = (workoutId: string) => activeWorkouts.find((workout) => workout.id === workoutId);

  /** No desafio, o recomendado precisa ser do desafio; senão vale o primeiro dele. */
  function buildRecommendedWorkout(candidateWorkouts: Workout[]): RecommendedWorkout | null {
    const todayWorkoutIsCandidate =
      todayWorkout && candidateWorkouts.some((workout) => workout.id === todayWorkout.id);
    if (todayWorkout && todayWorkoutIsCandidate) {
      const assignedWorkout = findWorkout(todayWorkout.id);
      return {
        id: todayWorkout.id,
        name: todayWorkout.name,
        exerciseCountLabel: assignedWorkout ? describeExerciseCount(assignedWorkout) : '',
        status: todayResponse?.status ?? 'nao_iniciado',
      };
    }
    const firstCandidate = candidateWorkouts[0];
    return firstCandidate
      ? {
          id: firstCandidate.id,
          name: firstCandidate.name,
          exerciseCountLabel: describeExerciseCount(firstCandidate),
          status: 'nao_iniciado',
        }
      : null;
  }

  const firstName = user?.name.split(' ')[0] ?? '';
  const isLoading = assignedWorkouts === null || (todayResponse === null && !errorMessage);
  const programTabLabel = currentProgram
    ? `${PROGRAM_TYPE_RULES[currentProgram.program.type].icon} ${PROGRAM_TYPE_RULES[currentProgram.program.type].label}`
    : '';

  function describeWorkoutBadge(workout: Workout, recommendedWorkoutId: string | undefined) {
    if (workout.id === recommendedWorkoutId) return <Pill tone="brand">Hoje</Pill>;
    const lastCompletion = lastCompletionByWorkoutId.get(workout.id);
    const daysSinceLastCompletion = lastCompletion
      ? (Date.now() - lastCompletion.getTime()) / (24 * 60 * 60 * 1000)
      : Infinity;
    if (lastCompletion && daysSinceLastCompletion < 7) {
      return <Pill tone="done">✓ {shortWeekdayLabel(lastCompletion.getDay())}</Pill>;
    }
    if (workout.dayOfWeek != null) return <Pill>{shortWeekdayLabel(workout.dayOfWeek)}</Pill>;
    return <Pill>Livre</Pill>;
  }

  return (
    <>
      <AppHeader eyebrow={TODAY_LABEL()} title={`${greetingForHour(new Date().getHours())}, ${firstName} 👋`} />
      <ConnectionStatus />
      <PwaInstallBanner />

      <div className="space-y-3.5 p-5 pb-28">
        {unreadNotesCount > 0 && (
          <Link
            href="/treino/recados"
            className="block rounded-2xl border border-brand bg-card px-4 py-2.5 text-sm font-bold text-ink"
          >
            📝 {unreadNotesCount} recado{unreadNotesCount > 1 ? 's' : ''} novo{unreadNotesCount > 1 ? 's' : ''} do
            seu personal →
          </Link>
        )}

        <WeekStrip completedDayKeys={completedDayKeys} />

        {errorMessage && (
          <p className="rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold text-brand">
            {errorMessage}
          </p>
        )}
        {isLoading && !errorMessage && <p className="py-10 text-center text-muted2">Carregando…</p>}

        {!isLoading && activeWorkouts.length === 0 && (
          <div className="py-14 text-center text-muted2">
            <p className="text-4xl">🛌</p>
            <p className="mt-2 font-semibold">Nenhum treino atribuído a você.</p>
            <p className="mt-1 text-sm">Quando seu personal direcionar um treino, ele aparece aqui.</p>
          </div>
        )}

        {!isLoading && activeWorkouts.length > 0 && isInProgramWithDeadline && currentProgram && (
          <>
            <SegmentedControl<HomeTab>
              options={[
                { value: 'program', label: programTabLabel },
                { value: 'others', label: '📋 Outros treinos' },
              ]}
              selectedValue={selectedTab}
              onChange={setSelectedTab}
            />

            {selectedTab === 'program' && (
              <ProgramTabContent
                recommendedWorkout={buildRecommendedWorkout(programWorkouts)}
                programWorkouts={programWorkouts}
                currentProgram={currentProgram}
                onOpenAchievement={openAchievementOfCurrentProgram}
                describeWorkoutBadge={describeWorkoutBadge}
              />
            )}

            {selectedTab === 'others' && (
              <div className="space-y-2">
                <p className="rounded-2xl bg-chip px-3 py-2.5 text-xs font-bold text-muted">
                  ℹ️ Estes treinos não contam para o {PROGRAM_TYPE_RULES[currentProgram.program.type].label.toLowerCase()}.
                  Use quando quiser treinar algo extra.
                </p>
                {otherWorkouts.length === 0 && (
                  <p className="py-6 text-center text-sm font-semibold text-muted2">
                    Nenhum treino extra por enquanto.
                  </p>
                )}
                {otherWorkouts.map((workout, workoutIndex) => (
                  <WorkoutListItem
                    key={workout.id}
                    href={`/treino/sessao/${workout.id}`}
                    letter={workoutLetter(programWorkouts.length + workoutIndex)}
                    title={workout.name}
                    subtitle={describeExerciseCount(workout)}
                    badge={describeWorkoutBadge(workout, undefined)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {!isLoading && activeWorkouts.length > 0 && !isInProgramWithDeadline && (
          <ContinuousContent
            recommendedWorkout={buildRecommendedWorkout(activeWorkouts)}
            programName={currentProgram?.program.name ?? null}
            activeWorkouts={activeWorkouts}
            describeLastCompletionOf={(workoutId) => {
              const lastCompletion = lastCompletionByWorkoutId.get(workoutId);
              return lastCompletion ? `Último: ${describeLastCompletion(lastCompletion)}` : 'Nunca feito';
            }}
          />
        )}

        {activeWorkouts.length > 0 && <PushOptIn />}
      </div>

      {celebration && (
        <ChallengeCompletedCelebration programReport={celebration.programReport} onClose={closeCelebration} />
      )}
    </>
  );
}

function ProgramTabContent({
  recommendedWorkout,
  programWorkouts,
  currentProgram,
  onOpenAchievement,
  describeWorkoutBadge,
}: {
  recommendedWorkout: RecommendedWorkout | null;
  programWorkouts: Workout[];
  currentProgram: NonNullable<ReturnType<typeof useCurrentProgram>['currentProgram']>;
  onOpenAchievement: () => void;
  describeWorkoutBadge: (workout: Workout, recommendedWorkoutId: string | undefined) => ReactNode;
}) {
  return (
    <>
      <ProgramHeroCard
        currentProgram={currentProgram}
        recommendedWorkout={recommendedWorkout}
        onOpenAchievement={onOpenAchievement}
      />
      {programWorkouts.length > 0 && (
        <div>
          <SectionTitle
            action={
              <Link href="/treino/meus" className="text-[12.5px] font-extrabold text-brand">
                Ver tudo
              </Link>
            }
          >
            Sequência do {PROGRAM_TYPE_RULES[currentProgram.program.type].label.toLowerCase()}
          </SectionTitle>
          <div className="space-y-2">
            {programWorkouts.map((workout, workoutIndex) => (
              <WorkoutListItem
                key={workout.id}
                href={`/treino/sessao/${workout.id}`}
                letter={workoutLetter(workoutIndex)}
                title={workout.name}
                subtitle={describeExerciseCount(workout)}
                badge={describeWorkoutBadge(workout, recommendedWorkout?.id)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ContinuousContent({
  recommendedWorkout,
  programName,
  activeWorkouts,
  describeLastCompletionOf,
}: {
  recommendedWorkout: RecommendedWorkout | null;
  programName: string | null;
  activeWorkouts: Workout[];
  describeLastCompletionOf: (workoutId: string) => string;
}) {
  const otherWorkouts = activeWorkouts.filter((workout) => workout.id !== recommendedWorkout?.id);
  return (
    <>
      {recommendedWorkout && (
        <RecommendedWorkoutCard
          recommendedWorkout={recommendedWorkout}
          programName={programName}
          weekdayLabel={longWeekdayLabel(new Date().getDay())}
        />
      )}
      {otherWorkouts.length > 0 && (
        <div>
          <SectionTitle
            action={
              <Link href="/treino/meus" className="text-[12.5px] font-extrabold text-brand">
                Ver todos
              </Link>
            }
          >
            Prefere outro hoje?
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2.5">
            {otherWorkouts.map((workout) => (
              <WorkoutTile
                key={workout.id}
                href={`/treino/sessao/${workout.id}`}
                letter={workoutLetter(activeWorkouts.indexOf(workout))}
                title={workout.name}
                caption={describeLastCompletionOf(workout.id)}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
