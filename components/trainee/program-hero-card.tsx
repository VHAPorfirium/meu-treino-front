import type { CurrentProgram } from '@/lib/types';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import {
  type RecommendedWorkout,
  RecommendedWorkoutAction,
  TodayWorkoutSummary,
} from './recommended-workout-card';

/** Card dourado do desafio/mesociclo: "Dia 19 de 30", barra e o treino do dia. */
export function ProgramHeroCard({
  currentProgram,
  recommendedWorkout,
  onOpenAchievement,
}: {
  currentProgram: CurrentProgram;
  recommendedWorkout: RecommendedWorkout | null;
  onOpenAchievement: () => void;
}) {
  const programTypeRule = PROGRAM_TYPE_RULES[currentProgram.program.type];
  const progress = currentProgram.progress;

  if (currentProgram.status === 'COMPLETED') {
    return (
      <button
        type="button"
        onClick={onOpenAchievement}
        className="block w-full rounded-3xl bg-gradient-to-br from-amber-700 to-amber-900 p-4 text-left text-white shadow-soft"
      >
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-50">
          🏆 {programTypeRule.label} concluído
        </p>
        <p className="font-display text-[22px] font-extrabold leading-tight">{currentProgram.program.name}</p>
        <p className="mt-1 text-sm font-bold underline">Ver minha conquista →</p>
      </button>
    );
  }

  return (
    <div className="rounded-3xl bg-gradient-to-br from-amber-700 to-amber-900 p-4 text-white shadow-soft">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-50">
        {programTypeRule.icon} {currentProgram.program.name}
      </p>
      {progress && (
        <>
          <div className="mt-0.5 flex items-end justify-between gap-3">
            <p className="font-display text-[25px] font-extrabold leading-tight">
              Dia {progress.currentDayNumber} de {progress.totalDays}
            </p>
            <p className="text-[13px] font-extrabold">
              {progress.completedWorkoutsCount} treino{progress.completedWorkoutsCount === 1 ? '' : 's'} feito
              {progress.completedWorkoutsCount === 1 ? '' : 's'}
            </p>
          </div>
          <div
            className="mb-3 mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/30"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.progressPercentage}
          >
            <div className="h-full rounded-full bg-white" style={{ width: `${progress.progressPercentage}%` }} />
          </div>
          {progress.isLastDayReached && (
            <p className="-mt-1 mb-3 text-xs font-bold">Último dia! Finalize um treino para conquistar o troféu 🏆</p>
          )}
        </>
      )}
      {recommendedWorkout ? (
        <>
          <TodayWorkoutSummary recommendedWorkout={recommendedWorkout} caption="Treino de hoje" />
          <RecommendedWorkoutAction recommendedWorkout={recommendedWorkout} variant="on-gold" />
        </>
      ) : (
        <p className="text-sm font-bold text-amber-50">Nenhum treino neste programa ainda.</p>
      )}
    </div>
  );
}
