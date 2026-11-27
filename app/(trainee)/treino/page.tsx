'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type {
  HistoryEntry,
  TodayResponse,
  TrainerTraineeLink,
  Workout,
} from '@/lib/types';
import {
  linksApi,
  notesApi,
  workoutLogsApi,
  workoutsApi,
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { copyText } from '@/lib/clipboard';
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
 * Tela inicial do aluno: convites de vínculo, treino recomendado do dia e gestão do personal.
 */
export default function TraineeHomePage() {
  const { user } = useAuth();
  const [todayResponse, setTodayResponse] = useState<TodayResponse | null>(null);
  const [assignedWorkouts, setAssignedWorkouts] = useState<Workout[] | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [unreadNotesCount, setUnreadNotesCount] = useState(0);
  const [pendingLinks, setPendingLinks] = useState<TrainerTraineeLink[]>([]);
  const [currentLink, setCurrentLink] = useState<TrainerTraineeLink | null>(null);
  const [linkLoaded, setLinkLoaded] = useState(false);
  const [linkBusyId, setLinkBusyId] = useState<string | null>(null);
  const [confirmEndLink, setConfirmEndLink] = useState(false);
  const [linkFeedback, setLinkFeedback] = useState<string | null>(null);
  const [copiedHandle, setCopiedHandle] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<HomeTab>('program');
  const {
    currentProgram,
    celebration,
    loadCurrentProgram,
    openAchievementOfCurrentProgram,
    closeCelebration,
  } = useCurrentProgram();

  const reloadWorkoutsAndProgram = useCallback(() => {
    setErrorMessage(null);
    workoutsApi
      .today(new Date().getDay())
      .then((res) => {
        setTodayResponse(res);
      })
      .catch(() => setErrorMessage('Sem conexão — não foi possível carregar seus treinos.'));
    workoutsApi
      .mine()
      .then((list) => {
        setAssignedWorkouts(list);
      })
      .catch(() => {
        setErrorMessage('Sem conexão — não foi possível carregar seus treinos.');
      });
    workoutLogsApi.myHistory().then(setHistoryEntries).catch(() => {});
    notesApi
      .mine()
      .then((notesResponse) => setUnreadNotesCount(notesResponse.unread))
      .catch(() => {});
    void loadCurrentProgram();
  }, [loadCurrentProgram]);

  const reloadLinks = useCallback(() => {
    linksApi
      .pending()
      .then(setPendingLinks)
      .catch(() => {});
    linksApi
      .current()
      .then((current) => {
        setCurrentLink(current.link);
        setLinkLoaded(true);
      })
      .catch(() => {
        // Não marca linkLoaded=true em falha de rede para não exibir falso "Sem personal vinculado"
      });
  }, []);

  useEffect(() => {
    reloadWorkoutsAndProgram();
    reloadLinks();
  }, [reloadWorkoutsAndProgram, reloadLinks]);

  async function handleAcceptLink(link: TrainerTraineeLink) {
    setLinkBusyId(link.id);
    setErrorMessage(null);
    setLinkFeedback(null);
    try {
      const res = await linksApi.accept(link.id);
      const portedParts: string[] = [];
      if (res.portedWorkoutsCount > 0) {
        portedParts.push(
          `${res.portedWorkoutsCount} treino${res.portedWorkoutsCount > 1 ? 's' : ''}`,
        );
      }
      if (res.portedProgram) {
        portedParts.push('seu programa ativo');
      }
      const portedSuffix =
        portedParts.length > 0
          ? ` ${portedParts.join(' e ')} ${
              res.portedWorkoutsCount > 1 || portedParts.length > 1
                ? 'foram portados'
                : 'foi portado'
            } para o novo personal.`
          : '';
      setLinkFeedback(
        `Vínculo confirmado com ${link.trainer?.name ?? 'seu novo personal'}!${portedSuffix}`,
      );
      reloadLinks();
      reloadWorkoutsAndProgram();
    } catch (error) {
      setLinkFeedback(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível aceitar o convite.',
      );
    } finally {
      setLinkBusyId(null);
    }
  }

  async function handleRejectLink(link: TrainerTraineeLink) {
    setLinkBusyId(link.id);
    setErrorMessage(null);
    setLinkFeedback(null);
    try {
      await linksApi.reject(link.id);
      setLinkFeedback(`Convite de ${link.trainer?.name ?? 'personal'} recusado.`);
      reloadLinks();
    } catch (error) {
      setLinkFeedback(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível recusar o convite.',
      );
    } finally {
      setLinkBusyId(null);
    }
  }

  async function handleEndCurrentLink() {
    if (!currentLink) return;
    setLinkBusyId(currentLink.id);
    setErrorMessage(null);
    setLinkFeedback(null);
    try {
      await linksApi.end(currentLink.id);
      setConfirmEndLink(false);
      setLinkFeedback(
        'Vínculo encerrado. Seus treinos, histórico e fotos continuam salvos com você.',
      );
      reloadLinks();
    } catch (error) {
      setLinkFeedback(null);
      setErrorMessage(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível encerrar o vínculo.',
      );
    } finally {
      setLinkBusyId(null);
    }
  }

  async function copyOwnUsername() {
    if (!user?.username) return;
    const ok = await copyText(`@${user.username}`);
    if (ok) {
      setCopiedHandle(true);
      setTimeout(() => setCopiedHandle(false), 2000);
    } else {
      setErrorMessage('Não foi possível copiar automaticamente — selecione seu @apelido abaixo.');
    }
  }

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
        {/* Convites pendentes de vínculo de personal */}
        {pendingLinks.map((link) => (
          <div
            key={link.id}
            className="space-y-2.5 rounded-2xl border-2 border-brand bg-card p-4 shadow-soft"
          >
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-brand-ink">
              🤝 Convite de vínculo
            </p>
            <p className="text-sm font-extrabold text-ink">
              {link.trainer?.name ?? 'Um personal'}{' '}
              {link.trainer?.username ? (
                <span className="font-bold text-muted2">
                  (@{link.trainer.username})
                </span>
              ) : null}{' '}
              quer ser seu personal.
            </p>
            <p className="text-xs font-semibold text-muted2">
              Ao aceitar, seus treinos e desafio atuais são portados para o novo personal. Fotos e recados anteriores ficam privados só com você.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={linkBusyId === link.id}
                onClick={() => void handleRejectLink(link)}
                className="flex-1 rounded-xl border border-line bg-paper py-2.5 text-xs font-extrabold text-muted disabled:opacity-50"
              >
                Recusar
              </button>
              <button
                type="button"
                disabled={linkBusyId === link.id}
                onClick={() => void handleAcceptLink(link)}
                className="flex-1 rounded-xl bg-brand py-2.5 text-xs font-extrabold text-white shadow-brand disabled:opacity-50"
              >
                {linkBusyId === link.id ? 'Confirmando…' : 'Aceitar vínculo'}
              </button>
            </div>
          </div>
        ))}

        {linkFeedback && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-done/40 bg-done-bg px-4 py-2.5 text-xs font-extrabold text-done-ink">
            <span>{linkFeedback}</span>
            <button
              type="button"
              onClick={() => setLinkFeedback(null)}
              className="shrink-0 underline"
            >
              fechar
            </button>
          </div>
        )}

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
          <p className="rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold text-brand-ink">
            {errorMessage}
          </p>
        )}
        {isLoading && !errorMessage && <p className="py-10 text-center text-muted2">Carregando…</p>}

        {!isLoading && !errorMessage && activeWorkouts.length === 0 && (
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

        {/* Card do personal atual ou apelido para vincular */}
        {linkLoaded && (
          <section className="rounded-2xl border border-line bg-card p-4">
            {currentLink?.trainer ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
                      Seu personal
                    </p>
                    <p className="truncate text-sm font-extrabold text-ink">
                      {currentLink.trainer.name}
                    </p>
                    <p className="text-xs font-bold text-muted2">
                      @{currentLink.trainer.username}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmEndLink((v) => !v)}
                    className="shrink-0 rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-extrabold text-skip"
                  >
                    Encerrar vínculo
                  </button>
                </div>

                {confirmEndLink && (
                  <div className="space-y-2 rounded-xl border border-line bg-paper p-3">
                    <p className="text-xs font-semibold text-ink">
                      Seus treinos, fotos e histórico continuam salvos com você. Depois de encerrar, outro personal poderá te enviar convite pelo seu @apelido.
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmEndLink(false)}
                        className="flex-1 rounded-xl border border-line py-2 text-xs font-extrabold text-muted"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        disabled={linkBusyId === currentLink.id}
                        onClick={() => void handleEndCurrentLink()}
                        className="flex-1 rounded-xl bg-brand py-2 text-xs font-extrabold text-white disabled:opacity-50"
                      >
                        {linkBusyId === currentLink.id ? 'Encerrando…' : 'Sim, encerrar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
                    Sem personal vinculado
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-muted2">
                    Passe seu apelido ao personal para receber o convite:
                  </p>
                  <p className="mt-1 select-text font-display text-base font-extrabold text-ink">
                    @{user?.username}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyOwnUsername()}
                  className="shrink-0 rounded-xl bg-chip px-3.5 py-2 text-xs font-extrabold text-ink active:scale-95"
                >
                  {copiedHandle ? '✓ Copiado' : 'Copiar apelido'}
                </button>
              </div>
            )}
          </section>
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
              <Link href="/treino/meus" className="text-[12.5px] font-extrabold text-brand-ink">
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
              <Link href="/treino/meus" className="text-[12.5px] font-extrabold text-brand-ink">
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
