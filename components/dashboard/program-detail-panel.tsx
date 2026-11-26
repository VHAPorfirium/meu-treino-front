'use client';

import { useState } from 'react';
import type { ProgramAssignmentDetail, ProgramStatus, TrainingProgram } from '@/lib/types';
import { programsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import {
  SelectableChipList,
  type SelectableChipOption,
  toggleIdInSet,
} from './selectable-chip-list';

const STATUS_LABEL: Record<ProgramStatus, string> = {
  ACTIVE: 'Em andamento',
  COMPLETED: 'Concluído 🏆',
  ARCHIVED: 'Encerrado',
};

const STATUS_CLASS_NAME: Record<ProgramStatus, string> = {
  ACTIVE: 'bg-done-bg text-done-ink',
  COMPLETED: 'bg-gold-bg text-gold',
  ARCHIVED: 'bg-chip text-muted',
};

function describeErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

/** Painel expandido de um programa: participantes e progresso, treinos, excluir. */
export function ProgramDetailPanel({
  program,
  workoutOptions,
  traineeOptions,
  onChanged,
  onDeleted,
}: {
  program: TrainingProgram;
  workoutOptions: SelectableChipOption[] | null;
  traineeOptions: SelectableChipOption[] | null;
  onChanged: () => Promise<void>;
  onDeleted: () => Promise<void>;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [traineeIdsToAdd, setTraineeIdsToAdd] = useState<Set<string>>(new Set());

  const programWorkoutIds = new Set(program.workouts.map((workout) => workout.id));
  const currentParticipants = program.assignments.filter(
    (assignment) => assignment.status !== 'ARCHIVED',
  );
  const pastParticipants = program.assignments.filter(
    (assignment) => assignment.status === 'ARCHIVED',
  );
  const currentParticipantIds = new Set(currentParticipants.map((assignment) => assignment.userId));
  const traineesAvailableToAdd =
    traineeOptions?.filter((trainee) => !currentParticipantIds.has(trainee.id)) ?? null;

  async function runAction(action: () => Promise<unknown>, fallbackMessage: string) {
    setIsBusy(true);
    setErrorMessage(null);
    try {
      await action();
      await onChanged();
    } catch (error) {
      setErrorMessage(describeErrorMessage(error, fallbackMessage));
    } finally {
      setIsBusy(false);
    }
  }

  function toggleProgramWorkout(workoutId: string) {
    const nextWorkoutIds = toggleIdInSet(programWorkoutIds, workoutId);
    void runAction(
      () => programsApi.update(program.id, { workoutIds: Array.from(nextWorkoutIds) }),
      'Não foi possível salvar os treinos',
    );
  }

  function addSelectedTrainees() {
    if (traineeIdsToAdd.size === 0) return;
    void runAction(async () => {
      await programsApi.assign(program.id, Array.from(traineeIdsToAdd));
      setTraineeIdsToAdd(new Set());
    }, 'Não foi possível adicionar os alunos');
  }

  function archiveParticipant(assignment: ProgramAssignmentDetail) {
    if (!window.confirm(`Tirar ${assignment.user.name} de "${program.name}"?`)) return;
    void runAction(
      () => programsApi.archiveAssignment(assignment.id),
      'Não foi possível encerrar a participação',
    );
  }

  async function deleteProgram() {
    if (!window.confirm(`Excluir "${program.name}"? Os treinos continuam existindo.`)) return;
    setIsBusy(true);
    try {
      await programsApi.remove(program.id);
      await onDeleted();
    } catch (error) {
      setErrorMessage(describeErrorMessage(error, 'Não foi possível excluir'));
      setIsBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-5 border-t border-line pt-4">
      {program.description && <p className="text-sm text-muted">{program.description}</p>}

      <section className="space-y-2">
        <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">Participantes</p>
        {currentParticipants.length === 0 && (
          <p className="text-sm text-muted2">Nenhum aluno neste programa.</p>
        )}
        {currentParticipants.map((assignment) => (
          <ParticipantRow
            key={assignment.id}
            assignment={assignment}
            hasDeadline={PROGRAM_TYPE_RULES[program.type].hasDeadline}
            disabled={isBusy}
            onArchive={() => archiveParticipant(assignment)}
          />
        ))}
        {pastParticipants.length > 0 && (
          <p className="text-xs font-semibold text-muted2">
            Já participaram: {pastParticipants.map((assignment) => assignment.user.name).join(', ')}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <SelectableChipList
          title="Adicionar alunos"
          options={traineesAvailableToAdd}
          selectedIds={traineeIdsToAdd}
          onToggle={(traineeId) => setTraineeIdsToAdd((current) => toggleIdInSet(current, traineeId))}
          emptyMessage="Todos os alunos já estão neste programa."
          disabled={isBusy}
        />
        {traineeIdsToAdd.size > 0 && (
          <button
            type="button"
            disabled={isBusy}
            onClick={addSelectedTrainees}
            className="rounded-xl bg-brand px-4 py-2 text-sm font-extrabold text-white disabled:opacity-60"
          >
            Colocar {traineeIdsToAdd.size} aluno{traineeIdsToAdd.size > 1 ? 's' : ''} no programa
          </button>
        )}
      </section>

      <SelectableChipList
        title="Treinos do programa (salva ao tocar)"
        options={workoutOptions}
        selectedIds={programWorkoutIds}
        onToggle={toggleProgramWorkout}
        emptyMessage="Nenhum treino criado."
        disabled={isBusy}
      />

      {errorMessage && <p className="text-sm font-semibold text-brand">{errorMessage}</p>}

      <button
        type="button"
        disabled={isBusy}
        onClick={deleteProgram}
        className="text-sm font-extrabold text-brand underline disabled:opacity-60"
      >
        Excluir programa
      </button>
    </div>
  );
}

function ParticipantRow({
  assignment,
  hasDeadline,
  disabled,
  onArchive,
}: {
  assignment: ProgramAssignmentDetail;
  hasDeadline: boolean;
  disabled: boolean;
  onArchive: () => void;
}) {
  const startDateLabel = new Date(assignment.startDate).toLocaleDateString('pt-BR');
  return (
    <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-extrabold">{assignment.user.name}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${STATUS_CLASS_NAME[assignment.status]}`}
        >
          {STATUS_LABEL[assignment.status]}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onArchive}
          className="shrink-0 text-xs font-bold text-muted2 underline disabled:opacity-60"
        >
          encerrar
        </button>
      </div>
      <p className="mt-0.5 text-xs font-semibold text-muted2">
        Desde {startDateLabel}
        {hasDeadline && assignment.progress &&
          ` · Dia ${assignment.progress.currentDayNumber} de ${assignment.progress.totalDays} · ${assignment.progress.completedWorkoutsCount} treinos feitos`}
        {assignment.reportData &&
          ` · ${assignment.reportData.completedWorkoutsCount} treinos${
            assignment.reportData.loadEvolutionPercentage != null
              ? ` · ${assignment.reportData.loadEvolutionPercentage >= 0 ? '+' : ''}${assignment.reportData.loadEvolutionPercentage}% de carga`
              : ''
          }`}
      </p>
      {hasDeadline && assignment.progress && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-chip">
          <div
            className="h-full rounded-full bg-amber-500"
            style={{ width: `${assignment.progress.progressPercentage}%` }}
          />
        </div>
      )}
    </div>
  );
}
