'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AttentionItem,
  CurrentProgram,
  ProgramAchievement,
  ProgressPhoto,
  ProgressSummary,
  TrainerNote,
  TrainerTraineeLink,
  TrainingProgram,
  UserSummary,
  Workout,
} from '@/lib/types';
import {
  linksApi,
  notesApi,
  photosApi,
  programsApi,
  usersApi,
  workoutLogsApi,
  workoutsApi,
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { normalizeUsername } from '@/lib/auth/credentials';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import {
  buildAchievementStatsLine,
  buildAchievementTitle,
} from '@/lib/programs/achievement-summary';
import { PageHead } from '@/components/dashboard/page-head';
import { TraineeAvatar } from '@/components/dashboard/trainee-avatar';
import { StatTile } from '@/components/trainee/stat-tile';

type ProfileTab = 'summary' | 'workouts' | 'notes' | 'photos' | 'achievements';

const PROFILE_TABS: { value: ProfileTab; label: string }[] = [
  { value: 'summary', label: 'Resumo' },
  { value: 'workouts', label: 'Treinos' },
  { value: 'notes', label: 'Recados' },
  { value: 'photos', label: 'Fotos' },
  { value: 'achievements', label: 'Conquistas' },
];

const formatDateTime = (isoDate: string) =>
  new Date(isoDate).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
const formatDay = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

function describeErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

/** Status de cada aluno na lista: alerta de inatividade ou programa atual. */
function describeTraineeStatus(
  trainee: UserSummary,
  programs: TrainingProgram[],
  attentionItems: AttentionItem[],
): { text: string; isWarning: boolean } {
  const inactiveItem = attentionItems.find(
    (attentionItem) =>
      attentionItem.userId === trainee.id && attentionItem.kind === 'inactive',
  );
  if (inactiveItem) return { text: inactiveItem.description, isWarning: true };

  for (const program of programs) {
    const participation = program.assignments.find(
      (assignment) =>
        assignment.userId === trainee.id && assignment.status !== 'ARCHIVED',
    );
    if (!participation) continue;
    const programTypeRule = PROGRAM_TYPE_RULES[program.type];
    if (participation.status === 'COMPLETED') {
      return { text: `🏆 ${program.name} concluído`, isWarning: false };
    }
    if (participation.progress) {
      return {
        text: `${programTypeRule.icon} ${programTypeRule.label} · Dia ${participation.progress.currentDayNumber}`,
        isWarning: false,
      };
    }
    return { text: `${programTypeRule.icon} ${program.name}`, isWarning: false };
  }
  return { text: 'Sem programa', isWarning: false };
}

/** Carteira do Personal: alunos vinculados, convites por @apelido e acompanhamento. */
export default function AlunosPage() {
  const [trainees, setTrainees] = useState<UserSummary[]>([]);
  const [sentLinks, setSentLinks] = useState<TrainerTraineeLink[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<UserSummary | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isLinkingTrainee, setIsLinkingTrainee] = useState(false);
  const [cancelingLinkId, setCancelingLinkId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const loadPortfolio = useCallback(async (traineeIdToSelect?: string) => {
    const [loadedTrainees, loadedLinks] = await Promise.all([
      usersApi.list({ role: 'TRAINEE' }),
      linksApi.sent().catch(() => [] as TrainerTraineeLink[]),
    ]);
    setTrainees(loadedTrainees);
    setSentLinks(loadedLinks);
    const requestedTraineeId =
      traineeIdToSelect ??
      (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('aluno') ?? undefined
        : undefined);
    setSelectedTrainee((current) => {
      const targetId = requestedTraineeId ?? current?.id;
      return (
        loadedTrainees.find((trainee) => trainee.id === targetId) ??
        loadedTrainees[0] ??
        null
      );
    });
  }, []);

  useEffect(() => {
    loadPortfolio().catch((error) =>
      setErrorMessage(
        describeErrorMessage(error, 'Não foi possível carregar sua carteira de alunos.'),
      ),
    );
    programsApi.list().then(setPrograms).catch(() => {});
    workoutLogsApi.attention().then(setAttentionItems).catch(() => {});
  }, [loadPortfolio]);

  const pendingLinks = useMemo(
    () => sentLinks.filter((link) => link.status === 'PENDING'),
    [sentLinks],
  );

  const activeLinkByTraineeId = useMemo(() => {
    const map = new Map<string, TrainerTraineeLink>();
    for (const link of sentLinks) {
      if (link.status === 'ACTIVE') {
        map.set(link.traineeId, link);
      }
    }
    return map;
  }, [sentLinks]);

  async function cancelPendingInvite(link: TrainerTraineeLink) {
    setCancelingLinkId(link.id);
    setErrorMessage(null);
    try {
      await linksApi.end(link.id);
      setSuccessBanner(
        `Convite para ${link.trainee?.name ?? 'aluno'} cancelado.`,
      );
      await loadPortfolio();
    } catch (error) {
      setErrorMessage(
        describeErrorMessage(error, 'Não foi possível cancelar o convite.'),
      );
    } finally {
      setCancelingLinkId(null);
    }
  }

  const normalizedQuery = searchText.trim().toLocaleLowerCase('pt-BR');
  const visibleTrainees = trainees.filter(
    (trainee) =>
      trainee.name.toLocaleLowerCase('pt-BR').includes(normalizedQuery) ||
      trainee.username.toLocaleLowerCase('pt-BR').includes(normalizedQuery),
  );

  return (
    <>
      <PageHead
        eyebrow="Carteira do Personal"
        title="Meus Alunos"
        actions={
          <button
            type="button"
            onClick={() => {
              setErrorMessage(null);
              setIsLinkingTrainee((isOpen) => !isOpen);
            }}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand"
          >
            {isLinkingTrainee ? 'Fechar convite' : '＋ Vincular aluno'}
          </button>
        }
      />

      <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6 md:p-8">
        {errorMessage && (
          <p className="rounded-2xl border border-line bg-card p-3 text-sm font-semibold text-brand">
            {errorMessage}{' '}
            <button onClick={() => setErrorMessage(null)} className="ml-2 underline">
              fechar
            </button>
          </p>
        )}

        {successBanner && (
          <p className="rounded-2xl border border-done/40 bg-done-bg p-3 text-sm font-bold text-done-ink">
            {successBanner}{' '}
            <button onClick={() => setSuccessBanner(null)} className="ml-2 underline">
              fechar
            </button>
          </p>
        )}

        {isLinkingTrainee && (
          <LinkTraineeForm
            onCancel={() => setIsLinkingTrainee(false)}
            onRequested={async (createdLink) => {
              setIsLinkingTrainee(false);
              setSuccessBanner(
                `Convite enviado para ${createdLink.trainee?.name ?? 'o aluno'} (@${createdLink.trainee?.username ?? ''}). Aguarde a aceitação no app dele.`,
              );
              await loadPortfolio();
            }}
          />
        )}

        {pendingLinks.length > 0 && (
          <section className="rounded-2xl border border-gold/40 bg-card p-4">
            <p className="text-xs font-extrabold uppercase tracking-wide text-gold">
              ⏳ Convites aguardando aceite ({pendingLinks.length})
            </p>
            <div className="mt-2.5 space-y-2">
              {pendingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-ink">
                      {link.trainee?.name ?? 'Aluno'}
                    </p>
                    <p className="text-xs font-bold text-muted2">
                      @{link.trainee?.username ?? '—'} · enviado em {formatDay(link.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={cancelingLinkId === link.id}
                    onClick={() => void cancelPendingInvite(link)}
                    className="rounded-xl border border-line bg-card px-3 py-1.5 text-xs font-extrabold text-skip hover:border-skip disabled:opacity-50"
                  >
                    {cancelingLinkId === link.id ? 'Cancelando…' : 'Cancelar convite'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid min-w-0 gap-4 md:grid-cols-[280px_1fr]">
          <div className="min-w-0 rounded-2xl border border-line bg-card p-2.5 md:self-start">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="🔍 Buscar por nome ou @apelido"
              className="mb-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
            />
            {trainees.length === 0 && (
              <div className="space-y-2 p-3 text-center">
                <p className="text-sm font-bold text-muted2">
                  Nenhum aluno vinculado ainda.
                </p>
                <p className="text-xs font-semibold text-muted2">
                  Peça o @apelido do aluno e clique em &ldquo;＋ Vincular aluno&rdquo;.
                </p>
              </div>
            )}
            {visibleTrainees.map((trainee) => {
              const traineeStatus = describeTraineeStatus(
                trainee,
                programs,
                attentionItems,
              );
              return (
                <button
                  key={trainee.id}
                  type="button"
                  onClick={() => setSelectedTrainee(trainee)}
                  className={`flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition ${
                    selectedTrainee?.id === trainee.id
                      ? 'bg-chip'
                      : 'hover:bg-chip/60'
                  }`}
                >
                  <TraineeAvatar name={trainee.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">
                      {trainee.name}
                    </span>
                    <span
                      className={`block truncate text-xs font-bold ${
                        traineeStatus.isWarning ? 'text-skip' : 'text-muted2'
                      }`}
                    >
                      {traineeStatus.text}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTrainee && (
            <TraineeProfile
              key={selectedTrainee.id}
              trainee={selectedTrainee}
              activeLink={activeLinkByTraineeId.get(selectedTrainee.id) ?? null}
              onLinkEnded={async (endedName) => {
                setSuccessBanner(
                  `Vínculo com ${endedName} encerrado. Os treinos e o histórico dele foram preservados.`,
                );
                await loadPortfolio();
                programsApi.list().then(setPrograms).catch(() => {});
                workoutLogsApi.attention().then(setAttentionItems).catch(() => {});
              }}
            />
          )}
        </div>
      </div>
    </>
  );
}

function LinkTraineeForm({
  onCancel,
  onRequested,
}: {
  onCancel: () => void;
  onRequested: (link: TrainerTraineeLink) => Promise<void>;
}) {
  const [usernameInput, setUsernameInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit() {
    const clean = normalizeUsername(usernameInput.replace(/^@+/, ''));
    if (clean.length < 3) {
      return setFormError('Informe o @apelido do aluno (mínimo 3 caracteres).');
    }
    setIsSubmitting(true);
    setFormError(null);
    try {
      const created = await linksApi.request(clean);
      await onRequested(created);
    } catch (error) {
      setFormError(
        describeErrorMessage(
          error,
          'Não foi possível enviar o convite. Confira o @apelido.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div>
        <p className="text-base font-extrabold text-ink">
          Solicitar vínculo com aluno
        </p>
        <p className="mt-0.5 text-xs font-semibold text-muted2">
          Peça o @apelido ao aluno (sem precisar do CPF). Quando ele aceitar no app, seus treinos e desafio ativos serão portados automaticamente para você.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-muted2">
            @
          </span>
          <input
            value={usernameInput}
            onChange={(e) => {
              setFormError(null);
              setUsernameInput(e.target.value.toLowerCase().replace(/\s+/g, ''));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="nome.sobrenome"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-xl border border-line bg-paper py-2.5 pl-8 pr-3.5 text-base font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-line px-4 py-2.5 text-sm font-extrabold text-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void submit()}
            className="rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white shadow-brand disabled:opacity-60"
          >
            {isSubmitting ? 'Enviando…' : 'Enviar convite'}
          </button>
        </div>
      </div>

      {formError && (
        <p className="text-sm font-semibold text-brand">{formError}</p>
      )}
    </div>
  );
}

function TraineeProfile({
  trainee,
  activeLink,
  onLinkEnded,
}: {
  trainee: UserSummary;
  activeLink: TrainerTraineeLink | null;
  onLinkEnded: (traineeName: string) => Promise<void>;
}) {
  const [selectedTab, setSelectedTab] = useState<ProfileTab>('summary');
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(
    null,
  );
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null);
  const [achievements, setAchievements] = useState<ProgramAchievement[]>([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState<Workout[]>([]);
  const [notes, setNotes] = useState<TrainerNote[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);
  const [confirmEndLink, setConfirmEndLink] = useState(false);
  const [isEndingLink, setIsEndingLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    workoutLogsApi.progress(trainee.id).then(setProgressSummary).catch(() => {});
    programsApi.currentOfUser(trainee.id).then(setCurrentProgram).catch(() => {});
    programsApi.achievementsOfUser(trainee.id).then(setAchievements).catch(() => {});
    workoutsApi
      .list()
      .then((workouts) =>
        setAssignedWorkouts(
          workouts.filter((workout) =>
            workout.assignees?.some((assignee) => assignee.id === trainee.id),
          ),
        ),
      )
      .catch(() => {});
    notesApi.forUser(trainee.id).then(setNotes).catch(() => {});
    photosApi.ofUser(trainee.id).then(setPhotos).catch(() => {});
  }, [trainee.id]);

  async function sendNote() {
    if (!noteText.trim()) return;
    setIsSendingNote(true);
    setErrorMessage(null);
    try {
      const sentNote = await notesApi.send(trainee.id, noteText.trim());
      setNotes((currentNotes) => [sentNote, ...currentNotes]);
      setNoteText('');
    } catch (error) {
      setErrorMessage(describeErrorMessage(error, 'Não foi possível enviar'));
    } finally {
      setIsSendingNote(false);
    }
  }

  async function handleEndLink() {
    if (!activeLink) return;
    setIsEndingLink(true);
    setErrorMessage(null);
    try {
      await linksApi.end(activeLink.id);
      setConfirmEndLink(false);
      await onLinkEnded(trainee.name);
    } catch (error) {
      setErrorMessage(
        describeErrorMessage(error, 'Não foi possível encerrar o vínculo.'),
      );
    } finally {
      setIsEndingLink(false);
    }
  }

  const firstName = trainee.name.split(' ')[0];
  const lastWorkoutNote = progressSummary
    ? `${progressSummary.sessions.last30days} treinos nos últimos 30 dias`
    : '';
  const tabCountByValue: Partial<Record<ProfileTab, number>> = {
    workouts: assignedWorkouts.length,
    notes: notes.length,
    photos: photos.length,
    achievements: achievements.length,
  };

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-3.5">
        <TraineeAvatar name={trainee.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-[22px] font-extrabold">
              {trainee.name}
            </p>
            <span className="rounded-full bg-done-bg px-2.5 py-0.5 text-[11px] font-extrabold text-done">
              Vinculado
            </span>
          </div>
          <p className="mt-0.5 text-xs font-bold text-muted2">
            @{trainee.username}
            {lastWorkoutNote ? ` · ${lastWorkoutNote}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {currentProgram && (
            <span className="rounded-full bg-gold-bg px-3 py-1.5 text-xs font-extrabold text-gold">
              {PROGRAM_TYPE_RULES[currentProgram.program.type].icon}{' '}
              {currentProgram.program.name}
              {currentProgram.progress
                ? ` · ${currentProgram.progress.currentDayNumber}/${currentProgram.progress.totalDays}`
                : ''}
            </span>
          )}
          {activeLink && (
            <button
              type="button"
              onClick={() => setConfirmEndLink((v) => !v)}
              className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-extrabold text-skip hover:border-skip"
            >
              Encerrar vínculo
            </button>
          )}
        </div>
      </div>

      {confirmEndLink && activeLink && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper p-3.5">
          <p className="text-xs font-bold text-ink">
            Encerrar vínculo com {firstName}? Ele manterá seus treinos e histórico, mas sairá da sua carteira e poderá se vincular a outro personal.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmEndLink(false)}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isEndingLink}
              onClick={() => void handleEndLink()}
              className="rounded-xl bg-brand px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {isEndingLink ? 'Encerrando…' : 'Sim, encerrar'}
            </button>
          </div>
        </div>
      )}

      <div className="no-scrollbar my-4 flex gap-5 overflow-x-auto border-b border-line">
        {PROFILE_TABS.map((profileTab) => (
          <button
            key={profileTab.value}
            type="button"
            onClick={() => setSelectedTab(profileTab.value)}
            className={`-mb-px shrink-0 border-b-[2.5px] py-2 text-sm font-extrabold ${
              selectedTab === profileTab.value
                ? 'border-brand text-ink'
                : 'border-transparent text-muted2'
            }`}
          >
            {profileTab.label}
            {tabCountByValue[profileTab.value]
              ? ` (${tabCountByValue[profileTab.value]})`
              : ''}
          </button>
        ))}
      </div>

      {errorMessage && (
        <p className="mb-3 text-sm font-semibold text-brand">{errorMessage}</p>
      )}

      {selectedTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatTile
              value={progressSummary?.sessions.last30days ?? '–'}
              label="treinos em 30 dias"
            />
            <StatTile
              value={progressSummary ? `${progressSummary.adherence.pct}%` : '–'}
              label="aderência"
            />
            <StatTile
              value={
                progressSummary
                  ? `${progressSummary.cargaTotal.deltaPct >= 0 ? '+' : ''}${progressSummary.cargaTotal.deltaPct}%`
                  : '–'
              }
              label="carga vs mês anterior"
              valueClassName={
                progressSummary && progressSummary.cargaTotal.deltaPct > 0
                  ? '!text-done'
                  : ''
              }
            />
            <StatTile value={achievements.length} label="medalhas" />
          </div>
          {currentProgram?.progress && (
            <div className="rounded-2xl border border-gold p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-gold">
                {PROGRAM_TYPE_RULES[currentProgram.program.type].label} em
                andamento
              </p>
              <p className="mt-0.5 font-extrabold">
                {currentProgram.program.name} · Dia{' '}
                {currentProgram.progress.currentDayNumber} de{' '}
                {currentProgram.progress.totalDays}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                  style={{
                    width: `${currentProgram.progress.progressPercentage}%`,
                  }}
                />
              </div>
            </div>
          )}
          <NoteComposer
            firstName={firstName}
            noteText={noteText}
            onChangeNoteText={setNoteText}
            onSend={sendNote}
            isSending={isSendingNote}
          />
        </div>
      )}

      {selectedTab === 'workouts' && (
        <div className="space-y-2">
          {assignedWorkouts.length === 0 && (
            <p className="py-6 text-center text-sm text-muted2">
              Nenhum treino direcionado.
            </p>
          )}
          {assignedWorkouts.map((workout) => (
            <div
              key={workout.id}
              className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-sm font-extrabold">
                    {workout.name}
                  </span>
                  {workout.clonedFromId && (
                    <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[10px] font-extrabold text-muted">
                      Portado
                    </span>
                  )}
                </span>
                <span className="block text-xs font-bold text-muted2">
                  {workout.program
                    ? `${PROGRAM_TYPE_RULES[workout.program.type].icon} ${workout.program.name}`
                    : 'Avulso'}
                  {workout._count
                    ? ` · ${workout._count.exercises} exercícios`
                    : ''}
                </span>
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                  workout.active
                    ? 'bg-done-bg text-done'
                    : 'bg-chip text-muted'
                }`}
              >
                {workout.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          ))}
        </div>
      )}

      {selectedTab === 'notes' && (
        <div className="space-y-3">
          <NoteComposer
            firstName={firstName}
            noteText={noteText}
            onChangeNoteText={setNoteText}
            onSend={sendNote}
            isSending={isSendingNote}
          />
          {notes.length === 0 && (
            <p className="py-6 text-center text-sm text-muted2">
              Nenhum recado enviado neste vínculo ainda.
            </p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-line p-4">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-muted2">
                <span>{formatDateTime(note.createdAt)}</span>
                <span>
                  {note.readAt
                    ? `✓ lido ${formatDateTime(note.readAt)}`
                    : 'não lido'}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[15px] text-ink">
                {note.text}
              </p>
            </div>
          ))}
        </div>
      )}

      {selectedTab === 'photos' && (
        <div>
          {photos.length === 0 && (
            <p className="py-6 text-center text-sm text-muted2">
              {firstName} ainda não enviou fotos neste vínculo.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <figure
                key={photo.id}
                className="overflow-hidden rounded-2xl border border-line"
              >
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.url}
                    alt={photo.note ?? 'Foto de progresso'}
                    className="aspect-[3/4] w-full object-cover"
                  />
                ) : (
                  <div className="aspect-[3/4] w-full bg-chip" />
                )}
                <figcaption className="p-2.5">
                  <p className="text-xs font-extrabold">
                    {formatDay(photo.takenAt)}
                  </p>
                  {photo.note && (
                    <p className="truncate text-[11px] text-muted2">
                      {photo.note}
                    </p>
                  )}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'achievements' && (
        <div className="space-y-2">
          {achievements.length === 0 && (
            <p className="py-6 text-center text-sm text-muted2">
              Nenhuma medalha ainda.
            </p>
          )}
          {achievements.map((achievement) => (
            <div
              key={achievement.assignmentId}
              className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold-bg p-3"
            >
              <span className="text-3xl">🥇</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-ink">
                  {buildAchievementTitle(achievement.report)}
                </span>
                <span className="block truncate text-xs font-semibold text-muted">
                  {achievement.programName} ·{' '}
                  {buildAchievementStatsLine(achievement.report)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NoteComposer({
  firstName,
  noteText,
  onChangeNoteText,
  onSend,
  isSending,
}: {
  firstName: string;
  noteText: string;
  onChangeNoteText: (noteText: string) => void;
  onSend: () => void;
  isSending: boolean;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
        Enviar recado
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <textarea
          value={noteText}
          onChange={(event) => onChangeNoteText(event.target.value)}
          rows={2}
          maxLength={1000}
          placeholder={`Escreva um recado para ${firstName}…`}
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={isSending || !noteText.trim()}
          className="shrink-0 self-end rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand disabled:opacity-50"
        >
          {isSending ? 'Enviando…' : 'Enviar'}
        </button>
      </div>
    </div>
  );
}
