'use client';

import { useEffect, useState } from 'react';
import type {
  AttentionItem,
  CurrentProgram,
  ProgramAchievement,
  ProgressPhoto,
  ProgressSummary,
  TrainerNote,
  TrainingProgram,
  UserSummary,
  Workout,
} from '@/lib/types';
import { notesApi, photosApi, programsApi, usersApi, workoutLogsApi, workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import { buildAchievementStatsLine, buildAchievementTitle } from '@/lib/programs/achievement-summary';
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
  new Date(isoDate).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const formatDay = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function describeErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

/** Status de cada aluno na lista: programa em que está ou alerta de inatividade. */
function describeTraineeStatus(
  traineeId: string,
  programs: TrainingProgram[],
  attentionItems: AttentionItem[],
): { text: string; isWarning: boolean } {
  const inactiveItem = attentionItems.find(
    (attentionItem) => attentionItem.userId === traineeId && attentionItem.kind === 'inactive',
  );
  if (inactiveItem) return { text: inactiveItem.description, isWarning: true };

  for (const program of programs) {
    const participation = program.assignments.find(
      (assignment) => assignment.userId === traineeId && assignment.status !== 'ARCHIVED',
    );
    if (!participation) continue;
    const programTypeRule = PROGRAM_TYPE_RULES[program.type];
    if (participation.status === 'COMPLETED') return { text: `🏆 ${program.name} concluído`, isWarning: false };
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

/** Alunos: lista com status e o perfil completo com abas, na mesma tela. */
export default function AlunosPage() {
  const [trainees, setTrainees] = useState<UserSummary[]>([]);
  const [programs, setPrograms] = useState<TrainingProgram[]>([]);
  const [attentionItems, setAttentionItems] = useState<AttentionItem[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<UserSummary | null>(null);
  const [searchText, setSearchText] = useState('');
  const [isCreatingTrainee, setIsCreatingTrainee] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function loadTrainees(traineeIdToSelect?: string) {
    const loadedTrainees = await usersApi.list({ role: 'TRAINEE' });
    setTrainees(loadedTrainees);
    const requestedTraineeId =
      traineeIdToSelect ?? new URLSearchParams(window.location.search).get('aluno') ?? undefined;
    setSelectedTrainee(
      loadedTrainees.find((trainee) => trainee.id === requestedTraineeId) ?? loadedTrainees[0] ?? null,
    );
  }

  useEffect(() => {
    loadTrainees().catch((error) => setErrorMessage(describeErrorMessage(error, 'Não foi possível carregar alunos')));
    programsApi.list().then(setPrograms).catch(() => {});
    workoutLogsApi.attention().then(setAttentionItems).catch(() => {});
  }, []);

  const visibleTrainees = trainees.filter((trainee) =>
    trainee.name.toLocaleLowerCase('pt-BR').includes(searchText.trim().toLocaleLowerCase('pt-BR')),
  );

  return (
    <>
      <PageHead
        eyebrow="Acompanhamento"
        title="Alunos"
        actions={
          <button
            type="button"
            onClick={() => setIsCreatingTrainee((isOpen) => !isOpen)}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand"
          >
            ＋ Novo aluno
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

        {isCreatingTrainee && (
          <CreateTraineeForm
            onCancel={() => setIsCreatingTrainee(false)}
            onCreated={async (createdTrainee) => {
              setIsCreatingTrainee(false);
              await loadTrainees(createdTrainee.id);
            }}
          />
        )}

        <div className="grid min-w-0 gap-4 md:grid-cols-[280px_1fr]">
          <div className="min-w-0 rounded-2xl border border-line bg-card p-2.5 md:self-start">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="🔍 Buscar aluno"
              className="mb-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
            />
            {trainees.length === 0 && <p className="p-3 text-sm text-muted2">Nenhum aluno cadastrado.</p>}
            {visibleTrainees.map((trainee) => {
              const traineeStatus = describeTraineeStatus(trainee.id, programs, attentionItems);
              return (
                <button
                  key={trainee.id}
                  type="button"
                  onClick={() => setSelectedTrainee(trainee)}
                  className={`flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition ${
                    selectedTrainee?.id === trainee.id ? 'bg-chip' : 'hover:bg-chip/60'
                  }`}
                >
                  <TraineeAvatar name={trainee.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-extrabold">{trainee.name}</span>
                    <span
                      className={`block truncate text-xs font-bold ${traineeStatus.isWarning ? 'text-skip' : 'text-muted2'}`}
                    >
                      {traineeStatus.text}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedTrainee && <TraineeProfile key={selectedTrainee.id} trainee={selectedTrainee} />}
        </div>
      </div>
    </>
  );
}

function CreateTraineeForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (createdTrainee: UserSummary) => Promise<void>;
}) {
  const [traineeName, setTraineeName] = useState('');
  const [traineePin, setTraineePin] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  async function submit() {
    if (traineeName.trim().length < 2) return setFormErrorMessage('Informe o nome do aluno.');
    if (!/^\d{4,8}$/.test(traineePin)) return setFormErrorMessage('O PIN deve ter de 4 a 8 números.');
    setIsSaving(true);
    setFormErrorMessage(null);
    try {
      const createdTrainee = await usersApi.createTrainee({ name: traineeName.trim(), pin: traineePin });
      await onCreated(createdTrainee);
    } catch (error) {
      setFormErrorMessage(describeErrorMessage(error, 'Não foi possível cadastrar'));
    } finally {
      setIsSaving(false);
    }
  }

  const inputClassName =
    'w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-muted2 focus:border-brand focus:outline-none';

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <p className="text-base font-extrabold">Novo aluno</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_180px]">
        <input value={traineeName} onChange={(event) => setTraineeName(event.target.value)} placeholder="Nome" className={inputClassName} />
        <input
          value={traineePin}
          onChange={(event) => setTraineePin(event.target.value.replace(/\D/g, '').slice(0, 8))}
          inputMode="numeric"
          placeholder="PIN (4 a 8 números)"
          className={inputClassName}
        />
      </div>
      <p className="text-xs font-semibold text-muted2">
        O aluno entra no app só com esse PIN — por isso ele precisa ser diferente do de todo mundo.
      </p>
      {formErrorMessage && <p className="text-sm font-semibold text-brand">{formErrorMessage}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold">
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={isSaving}
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {isSaving ? 'Salvando…' : 'Cadastrar aluno'}
        </button>
      </div>
    </div>
  );
}

function TraineeProfile({ trainee }: { trainee: UserSummary }) {
  const [selectedTab, setSelectedTab] = useState<ProfileTab>('summary');
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [currentProgram, setCurrentProgram] = useState<CurrentProgram | null>(null);
  const [achievements, setAchievements] = useState<ProgramAchievement[]>([]);
  const [assignedWorkouts, setAssignedWorkouts] = useState<Workout[]>([]);
  const [notes, setNotes] = useState<TrainerNote[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [noteText, setNoteText] = useState('');
  const [isSendingNote, setIsSendingNote] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    workoutLogsApi.progress(trainee.id).then(setProgressSummary).catch(() => {});
    programsApi.currentOfUser(trainee.id).then(setCurrentProgram).catch(() => {});
    programsApi.achievementsOfUser(trainee.id).then(setAchievements).catch(() => {});
    workoutsApi
      .list()
      .then((workouts) =>
        setAssignedWorkouts(workouts.filter((workout) => workout.assignees?.some((assignee) => assignee.id === trainee.id))),
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
          <p className="truncate font-display text-[22px] font-extrabold">{trainee.name}</p>
          <p className="text-xs font-bold text-muted2">{lastWorkoutNote}</p>
        </div>
        {currentProgram && (
          <span className="rounded-full bg-gold-bg px-3 py-1.5 text-xs font-extrabold text-gold">
            {PROGRAM_TYPE_RULES[currentProgram.program.type].icon} {currentProgram.program.name}
            {currentProgram.progress ? ` · ${currentProgram.progress.currentDayNumber}/${currentProgram.progress.totalDays}` : ''}
          </span>
        )}
      </div>

      <div className="no-scrollbar my-4 flex gap-5 overflow-x-auto border-b border-line">
        {PROFILE_TABS.map((profileTab) => (
          <button
            key={profileTab.value}
            type="button"
            onClick={() => setSelectedTab(profileTab.value)}
            className={`-mb-px shrink-0 border-b-[2.5px] py-2 text-sm font-extrabold ${
              selectedTab === profileTab.value ? 'border-brand text-ink' : 'border-transparent text-muted2'
            }`}
          >
            {profileTab.label}
            {tabCountByValue[profileTab.value] ? ` (${tabCountByValue[profileTab.value]})` : ''}
          </button>
        ))}
      </div>

      {errorMessage && <p className="mb-3 text-sm font-semibold text-brand">{errorMessage}</p>}

      {selectedTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatTile value={progressSummary?.sessions.last30days ?? '–'} label="treinos em 30 dias" />
            <StatTile value={progressSummary ? `${progressSummary.adherence.pct}%` : '–'} label="aderência" />
            <StatTile
              value={
                progressSummary
                  ? `${progressSummary.cargaTotal.deltaPct >= 0 ? '+' : ''}${progressSummary.cargaTotal.deltaPct}%`
                  : '–'
              }
              label="carga vs mês anterior"
              valueClassName={progressSummary && progressSummary.cargaTotal.deltaPct > 0 ? '!text-done' : ''}
            />
            <StatTile value={achievements.length} label="medalhas" />
          </div>
          {currentProgram?.progress && (
            <div className="rounded-2xl border border-gold p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-gold">
                {PROGRAM_TYPE_RULES[currentProgram.program.type].label} em andamento
              </p>
              <p className="mt-0.5 font-extrabold">
                {currentProgram.program.name} · Dia {currentProgram.progress.currentDayNumber} de{' '}
                {currentProgram.progress.totalDays}
              </p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                  style={{ width: `${currentProgram.progress.progressPercentage}%` }}
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
          {assignedWorkouts.length === 0 && <p className="py-6 text-center text-sm text-muted2">Nenhum treino direcionado.</p>}
          {assignedWorkouts.map((workout) => (
            <div key={workout.id} className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold">{workout.name}</span>
                <span className="block text-xs font-bold text-muted2">
                  {workout.program ? `${PROGRAM_TYPE_RULES[workout.program.type].icon} ${workout.program.name}` : 'Avulso'}
                  {workout._count ? ` · ${workout._count.exercises} exercícios` : ''}
                </span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${workout.active ? 'bg-done-bg text-done' : 'bg-chip text-muted'}`}>
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
          {notes.length === 0 && <p className="py-6 text-center text-sm text-muted2">Nenhum recado enviado ainda.</p>}
          {notes.map((note) => (
            <div key={note.id} className="rounded-2xl border border-line p-4">
              <div className="mb-1 flex items-center justify-between text-xs font-bold text-muted2">
                <span>{formatDateTime(note.createdAt)}</span>
                <span>{note.readAt ? `✓ lido ${formatDateTime(note.readAt)}` : 'não lido'}</span>
              </div>
              <p className="whitespace-pre-wrap text-[15px] text-ink">{note.text}</p>
            </div>
          ))}
        </div>
      )}

      {selectedTab === 'photos' && (
        <div>
          {photos.length === 0 && <p className="py-6 text-center text-sm text-muted2">{firstName} ainda não enviou fotos.</p>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-2xl border border-line">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.note ?? 'Foto de progresso'} className="aspect-[3/4] w-full object-cover" />
                ) : (
                  <div className="aspect-[3/4] w-full bg-chip" />
                )}
                <figcaption className="p-2.5">
                  <p className="text-xs font-extrabold">{formatDay(photo.takenAt)}</p>
                  {photo.note && <p className="truncate text-[11px] text-muted2">{photo.note}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      {selectedTab === 'achievements' && (
        <div className="space-y-2">
          {achievements.length === 0 && <p className="py-6 text-center text-sm text-muted2">Nenhuma medalha ainda.</p>}
          {achievements.map((achievement) => (
            <div key={achievement.assignmentId} className="flex items-center gap-3 rounded-xl border border-gold/40 bg-gold-bg p-3">
              <span className="text-3xl">🥇</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-extrabold text-ink">{buildAchievementTitle(achievement.report)}</span>
                <span className="block truncate text-xs font-semibold text-muted">
                  {achievement.programName} · {buildAchievementStatsLine(achievement.report)}
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
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">Enviar recado</p>
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
