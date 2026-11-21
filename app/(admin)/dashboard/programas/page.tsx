'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CreateProgramPayload, TrainingProgram } from '@/lib/types';
import { programsApi, usersApi, workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { formatProgramDuration } from '@/lib/programs/program-type-rules';
import { PageHead } from '@/components/dashboard/page-head';
import { ProgramForm } from '@/components/dashboard/program-form';
import { ProgramDetailPanel } from '@/components/dashboard/program-detail-panel';
import type { SelectableChipOption } from '@/components/dashboard/selectable-chip-list';
import { ProgramTypeBadge } from '@/components/programs/program-type-badge';

function describeErrorMessage(error: unknown, fallbackMessage: string) {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

/** Gestão de programas: treino contínuo, mesociclo ou desafio com prazo. */
export default function ProgramasPage() {
  const [programs, setPrograms] = useState<TrainingProgram[] | null>(null);
  const [expandedProgram, setExpandedProgram] = useState<TrainingProgram | null>(null);
  const [isCreatingProgram, setIsCreatingProgram] = useState(false);
  const [workoutOptions, setWorkoutOptions] = useState<SelectableChipOption[] | null>(null);
  const [traineeOptions, setTraineeOptions] = useState<SelectableChipOption[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshPrograms = useCallback(async () => {
    setPrograms(await programsApi.list());
  }, []);

  const refreshWorkoutOptions = useCallback(async () => {
    const workouts = await workoutsApi.list();
    setWorkoutOptions(
      workouts.map((workout) => ({
        id: workout.id,
        label: workout.program ? `${workout.name} (${workout.program.name})` : workout.name,
      })),
    );
  }, []);

  useEffect(() => {
    refreshPrograms().catch((error) =>
      setErrorMessage(describeErrorMessage(error, 'Não foi possível carregar os programas')),
    );
    refreshWorkoutOptions().catch(() => setWorkoutOptions([]));
    usersApi
      .list({ role: 'TRAINEE' })
      .then((trainees) => setTraineeOptions(trainees.map(({ id, name }) => ({ id, label: name }))))
      .catch(() => setTraineeOptions([]));
  }, [refreshPrograms, refreshWorkoutOptions]);

  async function openProgramDetail(programId: string) {
    setExpandedProgram(await programsApi.get(programId));
  }

  async function reloadAfterChange(programId: string) {
    await Promise.all([refreshPrograms(), refreshWorkoutOptions(), openProgramDetail(programId)]);
  }

  async function createProgram(payload: CreateProgramPayload) {
    try {
      const createdProgram = await programsApi.create(payload);
      setIsCreatingProgram(false);
      await reloadAfterChange(createdProgram.id);
    } catch (error) {
      setErrorMessage(describeErrorMessage(error, 'Não foi possível criar o programa'));
    }
  }

  function toggleProgram(programId: string) {
    if (expandedProgram?.id === programId) {
      setExpandedProgram(null);
      return;
    }
    openProgramDetail(programId).catch((error) =>
      setErrorMessage(describeErrorMessage(error, 'Não foi possível abrir o programa')),
    );
  }

  return (
    <>
      <PageHead
        eyebrow="Programação"
        title="Programas & Desafios"
        actions={
          <button
            onClick={() => setIsCreatingProgram((isOpen) => !isOpen)}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand"
          >
            + Novo programa
          </button>
        }
      />

      <div className="mx-auto max-w-3xl space-y-3 p-6 md:p-8">
        {errorMessage && (
          <div className="rounded-2xl border border-line bg-card p-3 text-sm font-semibold text-brand">
            {errorMessage}{' '}
            <button onClick={() => setErrorMessage(null)} className="ml-2 underline">
              fechar
            </button>
          </div>
        )}

        {isCreatingProgram && (
          <ProgramForm
            workoutOptions={workoutOptions}
            traineeOptions={traineeOptions}
            onSubmit={createProgram}
            onCancel={() => setIsCreatingProgram(false)}
          />
        )}

        {programs === null && !errorMessage && (
          <p className="py-10 text-center text-muted2">Carregando…</p>
        )}

        {programs?.map((program) => {
          const isExpanded = expandedProgram?.id === program.id;
          const currentParticipantNames = program.assignments
            .filter((assignment) => assignment.status !== 'ARCHIVED')
            .map((assignment) => assignment.user.name.split(' ')[0]);
          return (
            <div key={program.id} className="rounded-2xl border border-line bg-card p-4">
              <button className="flex w-full items-center gap-3 text-left" onClick={() => toggleProgram(program.id)}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold">{program.name}</p>
                  <p className="text-[13px] font-semibold text-muted2">
                    {formatProgramDuration(program)} · {program.workouts.length} treino
                    {program.workouts.length === 1 ? '' : 's'} ·{' '}
                    {currentParticipantNames.length ? currentParticipantNames.join(', ') : 'sem aluno'}
                  </p>
                </div>
                <ProgramTypeBadge programType={program.type} />
                <span className="text-muted2">{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && expandedProgram && (
                <ProgramDetailPanel
                  program={expandedProgram}
                  workoutOptions={workoutOptions}
                  traineeOptions={traineeOptions}
                  onChanged={() => reloadAfterChange(program.id)}
                  onDeleted={async () => {
                    setExpandedProgram(null);
                    await Promise.all([refreshPrograms(), refreshWorkoutOptions()]);
                  }}
                />
              )}
            </div>
          );
        })}

        {programs?.length === 0 && !isCreatingProgram && (
          <div className="py-10 text-center text-muted2">
            <p className="text-4xl">🎯</p>
            <p className="mt-2 font-semibold">Nenhum programa criado ainda.</p>
            <p className="mt-1 text-sm">
              Crie um treino contínuo, um mesociclo ou um desafio de 30 dias.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
