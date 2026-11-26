'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CreateProgramPayload, ProgramType, TrainingProgram } from '@/lib/types';
import { programsApi, usersApi, workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import {
  PROGRAM_TYPE_RULES,
  PROGRAM_TYPES_IN_DISPLAY_ORDER,
  formatProgramDuration,
} from '@/lib/programs/program-type-rules';
import { TraineeAvatar } from '@/components/dashboard/trainee-avatar';
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
  const [typeFilter, setTypeFilter] = useState<ProgramType | 'ALL'>('ALL');

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

      <div className="mx-auto max-w-6xl space-y-3.5 p-4 sm:p-6 md:p-8">
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

        {programs && programs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {(['ALL', ...PROGRAM_TYPES_IN_DISPLAY_ORDER] as const).map((filterValue) => {
              const filterCount =
                filterValue === 'ALL'
                  ? programs.length
                  : programs.filter((program) => program.type === filterValue).length;
              if (filterValue !== 'ALL' && filterCount === 0) return null;
              return (
                <button
                  key={filterValue}
                  type="button"
                  onClick={() => setTypeFilter(filterValue)}
                  className={`rounded-full px-3 py-1.5 text-xs font-extrabold transition ${
                    typeFilter === filterValue ? 'bg-brand text-white shadow-brand' : 'bg-chip text-muted'
                  }`}
                >
                  {filterValue === 'ALL'
                    ? 'Todos'
                    : `${PROGRAM_TYPE_RULES[filterValue].icon} ${PROGRAM_TYPE_RULES[filterValue].label}`}{' '}
                  · {filterCount}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid min-w-0 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {programs
            ?.filter((program) => typeFilter === 'ALL' || program.type === typeFilter)
            .map((program) => {
              const isExpanded = expandedProgram?.id === program.id;
              const currentParticipations = program.assignments.filter(
                (assignment) => assignment.status !== 'ARCHIVED',
              );
              const isDeadlineProgram = PROGRAM_TYPE_RULES[program.type].hasDeadline;
              return (
                <div
                  key={program.id}
                  className={`min-w-0 rounded-2xl border bg-card p-4 ${
                    isExpanded ? 'md:col-span-2 xl:col-span-3' : ''
                  } ${program.type === 'CHALLENGE' ? 'border-gold/60' : 'border-line'}`}
                >
                  <button className="block w-full text-left" onClick={() => toggleProgram(program.id)}>
                    <div className="flex items-start justify-between gap-2">
                      <ProgramTypeBadge programType={program.type} />
                      <span className="text-muted2">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                    <p className="mt-2.5 truncate text-base font-extrabold">{program.name}</p>
                    <p className="text-[13px] font-semibold text-muted2">
                      {formatProgramDuration(program)} · {program.workouts.length} treino
                      {program.workouts.length === 1 ? '' : 's'} · {currentParticipations.length} participante
                      {currentParticipations.length === 1 ? '' : 's'}
                    </p>
                    {currentParticipations.length > 0 && <div className="my-2.5 h-px bg-line" />}
                    {isDeadlineProgram ? (
                      <div className="space-y-2">
                        {currentParticipations.slice(0, 4).map((assignment) => (
                          <div key={assignment.id} className="flex items-center gap-2.5">
                            <TraineeAvatar name={assignment.user.name} size={26} />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-bold">
                              {assignment.user.name.split(' ')[0]}
                            </span>
                            {assignment.status === 'COMPLETED' ? (
                              <span className="text-xs font-extrabold text-gold">🏆 concluído</span>
                            ) : assignment.progress ? (
                              <>
                                <span className="text-xs font-bold text-muted2">
                                  {assignment.progress.currentDayNumber}/{assignment.progress.totalDays}
                                </span>
                                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-chip">
                                  <span
                                    className="block h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                                    style={{ width: `${assignment.progress.progressPercentage}%` }}
                                  />
                                </span>
                              </>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex">
                        {currentParticipations.map((assignment, participantIndex) => (
                          <span key={assignment.id} className={participantIndex > 0 ? '-ml-2' : ''}>
                            <TraineeAvatar name={assignment.user.name} size={28} />
                          </span>
                        ))}
                      </div>
                    )}
                  </button>

                  {isExpanded && expandedProgram && (
                    <ProgramDetailPanel
                      program={expandedProgram}
                      workoutOptions={workoutOptions}
                      traineeOptions={traineeOptions}
                      onChanged={() => reloadAfterChange(program.id)}
                      onDeleted={async () => {
                        setExpandedProgram(null);
                        const [updatedPrograms] = await Promise.all([
                          programsApi.list(),
                          refreshWorkoutOptions(),
                        ]);
                        setPrograms(updatedPrograms);
                        if (
                          typeFilter !== 'ALL' &&
                          !updatedPrograms.some((item) => item.type === typeFilter)
                        ) {
                          setTypeFilter('ALL');
                        }
                      }}
                    />
                  )}
                </div>
              );
            })}
        </div>

        <RecentlyCompletedPrograms programs={programs ?? []} />

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

/** Relatórios das jornadas concluídas mais recentes. */
function RecentlyCompletedPrograms({ programs }: { programs: TrainingProgram[] }) {
  const completedParticipations = programs
    .flatMap((program) =>
      program.assignments
        .filter(
          (assignment) =>
            (assignment.status === 'COMPLETED' || assignment.status === 'ARCHIVED') &&
            Boolean(assignment.reportData),
        )
        .map((assignment) => ({ program, assignment })),
    )
    .sort(
      (first, second) =>
        new Date(second.assignment.endDate ?? 0).getTime() - new Date(first.assignment.endDate ?? 0).getTime(),
    )
    .slice(0, 5);

  if (completedParticipations.length === 0) return null;

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="mb-2 text-base font-extrabold">🏆 Concluídos recentemente</p>
      <div className="divide-y divide-line">
        {completedParticipations.map(({ program, assignment }) => {
          const programReport = assignment.reportData!;
          return (
            <div key={assignment.id} className="flex items-center gap-3 py-2.5">
              <TraineeAvatar name={assignment.user.name} size={30} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold">
                  {program.name} · {assignment.user.name.split(' ')[0]}
                </p>
                <p className="truncate text-xs font-bold text-muted2">
                  {programReport.totalDays} dias · {programReport.completedWorkoutsCount} treinos
                  {programReport.loadEvolutionPercentage != null
                    ? ` · ${programReport.loadEvolutionPercentage >= 0 ? '+' : ''}${programReport.loadEvolutionPercentage}% de carga`
                    : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
