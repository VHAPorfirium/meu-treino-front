'use client';

import Link from 'next/link';
import type { TrainingProgram } from '@/lib/types';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import { TraineeAvatar } from './trainee-avatar';

/** Desafios e mesociclos em andamento, com o "Dia X de Y" de cada aluno. */
export function ProgramsInProgressPanel({ programs }: { programs: TrainingProgram[] | null }) {
  const participations = (programs ?? []).flatMap((program) =>
    program.assignments
      .filter((assignment) => assignment.status === 'ACTIVE' && assignment.progress)
      .map((assignment) => ({ program, assignment })),
  );

  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-extrabold">🎯 Jornadas em andamento</h2>
        <Link href="/dashboard/programas" className="text-xs font-extrabold text-brand">
          Ver todas
        </Link>
      </div>
      {programs === null && <p className="text-sm text-muted2">Carregando…</p>}
      {programs && participations.length === 0 && (
        <p className="text-sm text-muted2">Nenhum desafio ou mesociclo em andamento.</p>
      )}
      <div className="divide-y divide-line">
        {participations.map(({ program, assignment }) => (
          <div key={assignment.id} className="flex items-center gap-3 py-2.5">
            <TraineeAvatar name={assignment.user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">
                {assignment.user.name.split(' ')[0]} · {program.name}
              </p>
              <p className="text-xs font-bold text-muted2">
                {PROGRAM_TYPE_RULES[program.type].icon} Dia {assignment.progress!.currentDayNumber} de{' '}
                {assignment.progress!.totalDays}
              </p>
            </div>
            <div className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-chip">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                style={{ width: `${assignment.progress!.progressPercentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
