'use client';

import type { CurrentProgram } from '@/lib/types';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';

/**
 * Banner dourado do topo para programas com prazo (mesociclo/desafio):
 * nome, "Dia X de Y" e barra de progresso. Treino contínuo não usa banner.
 */
export function ProgramProgressBanner({
  currentProgram,
  onOpenAchievement,
}: {
  currentProgram: CurrentProgram;
  onOpenAchievement: () => void;
}) {
  const programTypeRule = PROGRAM_TYPE_RULES[currentProgram.program.type];
  if (!programTypeRule.hasDeadline) return null;

  if (currentProgram.status === 'COMPLETED') {
    return (
      <button
        type="button"
        onClick={onOpenAchievement}
        className="block w-full rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 px-5 py-4 text-left text-white shadow-soft"
      >
        <p className="text-[11px] font-extrabold uppercase tracking-wider opacity-90">
          🏆 {programTypeRule.label} concluído
        </p>
        <p className="font-display text-[20px] font-extrabold leading-tight">
          {currentProgram.program.name}
        </p>
        <p className="mt-1 text-sm font-bold underline">Ver minha conquista →</p>
      </button>
    );
  }

  const progress = currentProgram.progress;
  if (!progress) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 px-5 py-4 text-white shadow-soft">
      <p className="text-[11px] font-extrabold uppercase tracking-wider opacity-90">
        {programTypeRule.icon} {currentProgram.program.name}
      </p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className="font-display text-[24px] font-extrabold leading-tight">
          Dia {progress.currentDayNumber} de {progress.totalDays}
        </p>
        <p className="text-sm font-extrabold">
          {progress.completedWorkoutsCount} treino{progress.completedWorkoutsCount === 1 ? '' : 's'} feito
          {progress.completedWorkoutsCount === 1 ? '' : 's'}
        </p>
      </div>
      <div
        className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/30"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.progressPercentage}
      >
        <div
          className="h-full rounded-full bg-white transition-all"
          style={{ width: `${progress.progressPercentage}%` }}
        />
      </div>
      {progress.isLastDayReached && (
        <p className="mt-2 text-xs font-bold">Último dia! Finalize o treino para conquistar o troféu 🏆</p>
      )}
    </div>
  );
}
