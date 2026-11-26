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
import {
  notesApi,
  photosApi,
  programsApi,
  usersApi,
  workoutLogsApi,
  workoutsApi,
} from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import {
  formatCpfInput,
  generateStrongPassword,
  isValidCpf,
  isValidUsername,
  normalizeUsername,
  passwordChecklist,
  suggestUsernameFromName,
  validateStrongPassword,
} from '@/lib/auth/credentials';
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

/** Status de cada aluno na lista: conta inativa, alerta de inatividade ou programa atual. */
function describeTraineeStatus(
  trainee: UserSummary,
  programs: TrainingProgram[],
  attentionItems: AttentionItem[],
): { text: string; isWarning: boolean } {
  if (!trainee.active) {
    return { text: 'Conta desativada', isWarning: true };
  }

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

/** Alunos: lista com status e o perfil completo com gestão cadastral e abas. */
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
      traineeIdToSelect ??
      new URLSearchParams(window.location.search).get('aluno') ??
      undefined;
    setSelectedTrainee(
      loadedTrainees.find((trainee) => trainee.id === requestedTraineeId) ??
        loadedTrainees[0] ??
        null,
    );
  }

  useEffect(() => {
    loadTrainees().catch((error) =>
      setErrorMessage(
        describeErrorMessage(error, 'Não foi possível carregar alunos'),
      ),
    );
    programsApi.list().then(setPrograms).catch(() => {});
    workoutLogsApi.attention().then(setAttentionItems).catch(() => {});
  }, []);

  function handleTraineeUpdated(updated: UserSummary) {
    setTrainees((current) =>
      current
        .map((t) => (t.id === updated.id ? updated : t))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    );
    setSelectedTrainee((current) =>
      current?.id === updated.id ? updated : current,
    );
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
              placeholder="🔍 Buscar por nome ou @apelido"
              className="mb-2 w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
            />
            {trainees.length === 0 && (
              <p className="p-3 text-sm text-muted2">Nenhum aluno cadastrado.</p>
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
                  } ${!trainee.active ? 'opacity-70' : ''}`}
                >
                  <TraineeAvatar name={trainee.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-extrabold">
                        {trainee.name}
                      </span>
                      {!trainee.active && (
                        <span className="shrink-0 rounded-full bg-chip px-1.5 py-0.5 text-[10px] font-extrabold text-muted">
                          Inativo
                        </span>
                      )}
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
              onTraineeUpdated={handleTraineeUpdated}
            />
          )}
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
  const [cpf, setCpf] = useState('');
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState(() => generateStrongPassword());
  const [showPassword, setShowPassword] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);

  function handleNameChange(value: string) {
    setTraineeName(value);
    if (!usernameTouched) {
      setUsername(suggestUsernameFromName(value));
    }
  }

  async function refreshSuggestedUsername() {
    if (usernameTouched || traineeName.trim().length < 2) return;
    try {
      const res = await usersApi.suggestUsername(traineeName.trim());
      if (!usernameTouched) setUsername(res.username);
    } catch {
      /* mantém sugestão local */
    }
  }

  async function submit() {
    const trimmedName = traineeName.trim();
    if (trimmedName.length < 2) {
      return setFormErrorMessage('Informe o nome completo do aluno.');
    }
    if (!isValidCpf(cpf)) {
      return setFormErrorMessage('CPF inválido. Confira os 11 dígitos.');
    }
    const cleanUsername = username.trim() ? normalizeUsername(username) : '';
    if (cleanUsername && !isValidUsername(cleanUsername)) {
      return setFormErrorMessage(
        'Apelido inválido (use 3 a 40 caracteres: letras, números, ponto, hífen ou _).',
      );
    }
    const strength = validateStrongPassword(password);
    if (!strength.valid) {
      return setFormErrorMessage(strength.reason ?? 'Senha inicial fraca.');
    }

    setIsSaving(true);
    setFormErrorMessage(null);
    try {
      const createdTrainee = await usersApi.createTrainee({
        name: trimmedName,
        cpf,
        password,
        ...(cleanUsername ? { username: cleanUsername } : {}),
      });
      await onCreated(createdTrainee);
    } catch (error) {
      setFormErrorMessage(
        describeErrorMessage(error, 'Não foi possível cadastrar o aluno.'),
      );
    } finally {
      setIsSaving(false);
    }
  }

  const check = passwordChecklist(password);
  const inputClassName =
    'w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-muted2 focus:border-brand focus:outline-none';

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="text-base font-extrabold">Novo aluno</p>
        <span className="text-xs font-bold text-muted2">
          Troca de senha obrigatória no 1º acesso
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
            Nome completo
          </label>
          <input
            value={traineeName}
            onChange={(event) => handleNameChange(event.target.value)}
            onBlur={() => void refreshSuggestedUsername()}
            placeholder="Ex.: Gabriel da Silva"
            className={inputClassName}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
            CPF
          </label>
          <input
            value={cpf}
            onChange={(event) => setCpf(formatCpfInput(event.target.value))}
            inputMode="numeric"
            placeholder="000.000.000-00"
            className={inputClassName}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
            Apelido (@username)
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-extrabold text-muted2">
              @
            </span>
            <input
              value={username}
              onChange={(event) => {
                setUsernameTouched(true);
                setUsername(event.target.value.toLowerCase().replace(/\s+/g, ''));
              }}
              placeholder="gabriel.silva"
              className={`${inputClassName} pl-8`}
            />
          </div>
          <p className="text-[11px] font-semibold text-muted2">
            Sugestão automática. Usado para identificar o aluno sem expor o CPF.
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-extrabold uppercase tracking-wide text-muted">
              Senha inicial temporária
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPassword(generateStrongPassword())}
                className="text-xs font-extrabold text-brand hover:underline"
              >
                Gerar nova
              </button>
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-xs font-extrabold text-muted hover:text-ink"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mín. 8 chars (letra, número e especial)"
            className={inputClassName}
          />
          <p className="text-[11px] font-semibold text-muted2">
            <span className={check.minLength ? 'text-done' : ''}>8+ chars</span> ·{' '}
            <span className={check.hasLetter ? 'text-done' : ''}>letra</span> ·{' '}
            <span className={check.hasNumber ? 'text-done' : ''}>número</span> ·{' '}
            <span className={check.hasSpecial ? 'text-done' : ''}>especial</span>
          </p>
        </div>
      </div>

      {formErrorMessage && (
        <p className="text-sm font-semibold text-brand">{formErrorMessage}</p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold"
        >
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

function TraineeProfile({
  trainee,
  onTraineeUpdated,
}: {
  trainee: UserSummary;
  onTraineeUpdated: (updated: UserSummary) => void;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Painéis inline de gestão cadastral (v1.1)
  const [activeAction, setActiveAction] = useState<
    null | 'edit' | 'reset-password' | 'confirm-toggle'
  >(null);
  const [editName, setEditName] = useState(trainee.name);
  const [editUsername, setEditUsername] = useState(trainee.username);
  const [editCpf, setEditCpf] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [isMutatingAccount, setIsMutatingAccount] = useState(false);

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

  async function saveProfileEdits() {
    if (editName.trim().length < 2) {
      return setErrorMessage('O nome deve ter pelo menos 2 caracteres.');
    }
    const cleanUsername = normalizeUsername(editUsername);
    if (!isValidUsername(cleanUsername)) {
      return setErrorMessage('Apelido inválido.');
    }
    if (editCpf.trim() && !isValidCpf(editCpf)) {
      return setErrorMessage('CPF inválido. Confira os 11 dígitos.');
    }

    setIsMutatingAccount(true);
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const updated = await usersApi.update(trainee.id, {
        name: editName.trim(),
        username: cleanUsername,
        ...(editCpf.trim() ? { cpf: editCpf } : {}),
      });
      onTraineeUpdated(updated);
      setEditCpf('');
      setActiveAction(null);
      setFeedbackMessage('Cadastro atualizado com sucesso.');
    } catch (error) {
      setErrorMessage(
        describeErrorMessage(error, 'Não foi possível atualizar o cadastro.'),
      );
    } finally {
      setIsMutatingAccount(false);
    }
  }

  async function submitResetPassword() {
    const strength = validateStrongPassword(resetPasswordValue);
    if (!strength.valid) {
      return setErrorMessage(strength.reason ?? 'Senha temporária fraca.');
    }
    setIsMutatingAccount(true);
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const res = await usersApi.resetPassword(trainee.id, resetPasswordValue);
      onTraineeUpdated(res.user);
      const handedPassword = resetPasswordValue;
      setResetPasswordValue('');
      setActiveAction(null);
      setFeedbackMessage(
        `Senha redefinida! Senha temporária: ${handedPassword} (o aluno deverá trocar no próximo acesso).`,
      );
    } catch (error) {
      setErrorMessage(
        describeErrorMessage(error, 'Não foi possível redefinir a senha.'),
      );
    } finally {
      setIsMutatingAccount(false);
    }
  }

  async function toggleActiveStatus() {
    setIsMutatingAccount(true);
    setErrorMessage(null);
    setFeedbackMessage(null);
    try {
      const nextActive = !trainee.active;
      const updated = await usersApi.setActive(trainee.id, nextActive);
      onTraineeUpdated(updated);
      setActiveAction(null);
      setFeedbackMessage(
        nextActive
          ? 'Conta reativada! O aluno já pode acessar o app novamente.'
          : 'Conta desativada e acesso revogado imediatamente.',
      );
    } catch (error) {
      setErrorMessage(
        describeErrorMessage(error, 'Não foi possível alterar o status da conta.'),
      );
    } finally {
      setIsMutatingAccount(false);
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
  const inputClassName =
    'w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none';

  return (
    <div className="min-w-0 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-3.5">
        <TraineeAvatar name={trainee.name} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-display text-[22px] font-extrabold">
              {trainee.name}
            </p>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                trainee.active
                  ? 'bg-done-bg text-done'
                  : 'bg-skip-bg text-skip'
              }`}
            >
              {trainee.active ? 'Ativo' : 'Desativado'}
            </span>
            {trainee.mustChangePassword && (
              <span className="rounded-full bg-gold-bg px-2.5 py-0.5 text-[11px] font-extrabold text-gold">
                Troca de senha pendente
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs font-bold text-muted2">
            @{trainee.username} · CPF {trainee.cpfMasked ?? 'não cadastrado'}
            {lastWorkoutNote ? ` · ${lastWorkoutNote}` : ''}
          </p>
        </div>
        {currentProgram && (
          <span className="rounded-full bg-gold-bg px-3 py-1.5 text-xs font-extrabold text-gold">
            {PROGRAM_TYPE_RULES[currentProgram.program.type].icon}{' '}
            {currentProgram.program.name}
            {currentProgram.progress
              ? ` · ${currentProgram.progress.currentDayNumber}/${currentProgram.progress.totalDays}`
              : ''}
          </span>
        )}
      </div>

      {/* Ações rápidas de gestão cadastral */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setFeedbackMessage(null);
            setEditName(trainee.name);
            setEditUsername(trainee.username);
            setEditCpf('');
            setActiveAction((prev) => (prev === 'edit' ? null : 'edit'));
          }}
          className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-extrabold text-ink hover:border-brand"
        >
          ✏️ Editar cadastro
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setFeedbackMessage(null);
            setResetPasswordValue(generateStrongPassword());
            setActiveAction((prev) =>
              prev === 'reset-password' ? null : 'reset-password',
            );
          }}
          className="rounded-xl border border-line bg-paper px-3 py-1.5 text-xs font-extrabold text-ink hover:border-brand"
        >
          🔑 Redefinir senha
        </button>
        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setFeedbackMessage(null);
            setActiveAction((prev) =>
              prev === 'confirm-toggle' ? null : 'confirm-toggle',
            );
          }}
          className={`rounded-xl border px-3 py-1.5 text-xs font-extrabold ${
            trainee.active
              ? 'border-line bg-paper text-skip hover:border-skip'
              : 'border-done bg-done-bg text-done'
          }`}
        >
          {trainee.active ? '⛔ Desativar aluno' : '✅ Reativar aluno'}
        </button>
      </div>

      {activeAction === 'edit' && (
        <div className="mt-3 space-y-2.5 rounded-2xl border border-line bg-paper p-3.5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
            Editar dados cadastrais
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome completo"
              className={inputClassName}
            />
            <input
              value={editUsername}
              onChange={(e) =>
                setEditUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))
              }
              placeholder="Apelido (ex: ana.silva)"
              className={inputClassName}
            />
            <input
              value={editCpf}
              onChange={(e) => setEditCpf(formatCpfInput(e.target.value))}
              inputMode="numeric"
              placeholder={
                trainee.cpfMasked
                  ? `Novo CPF (atual: ${trainee.cpfMasked})`
                  : 'Cadastrar CPF (000.000.000-00)'
              }
              className={inputClassName}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isMutatingAccount}
              onClick={() => void saveProfileEdits()}
              className="rounded-xl bg-brand px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {isMutatingAccount ? 'Salvando…' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}

      {activeAction === 'reset-password' && (
        <div className="mt-3 space-y-2.5 rounded-2xl border border-line bg-paper p-3.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted">
              Redefinir senha temporária
            </p>
            <button
              type="button"
              onClick={() => setResetPasswordValue(generateStrongPassword())}
              className="text-xs font-extrabold text-brand hover:underline"
            >
              Gerar outra
            </button>
          </div>
          <input
            type="text"
            value={resetPasswordValue}
            onChange={(e) => setResetPasswordValue(e.target.value)}
            placeholder="Nova senha forte (8+ chars, letra, número e especial)"
            className={inputClassName}
          />
          <p className="text-[11px] font-semibold text-muted2">
            O aluno precisará criar uma nova senha pessoal assim que entrar com esta senha temporária.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isMutatingAccount}
              onClick={() => void submitResetPassword()}
              className="rounded-xl bg-brand px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {isMutatingAccount ? 'Aplicando…' : 'Confirmar redefinição'}
            </button>
          </div>
        </div>
      )}

      {activeAction === 'confirm-toggle' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-paper p-3.5">
          <p className="text-xs font-bold text-ink">
            {trainee.active
              ? `Desativar ${firstName}? O acesso ao app é bloqueado imediatamente, mantendo histórico e treinos preservados.`
              : `Reativar a conta de ${firstName}?`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveAction(null)}
              className="rounded-xl border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isMutatingAccount}
              onClick={() => void toggleActiveStatus()}
              className="rounded-xl bg-brand px-4 py-1.5 text-xs font-extrabold text-white disabled:opacity-60"
            >
              {isMutatingAccount
                ? 'Aguarde…'
                : trainee.active
                  ? 'Sim, desativar'
                  : 'Sim, reativar'}
            </button>
          </div>
        </div>
      )}

      {feedbackMessage && (
        <p className="mt-3 rounded-xl bg-done-bg px-3.5 py-2.5 text-xs font-extrabold text-done">
          {feedbackMessage}
        </p>
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
                <span className="block truncate text-sm font-extrabold">
                  {workout.name}
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
              Nenhum recado enviado ainda.
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
              {firstName} ainda não enviou fotos.
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
