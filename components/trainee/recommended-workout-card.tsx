import Link from 'next/link';
import type { StatusDoDia } from '@/lib/types';

export interface RecommendedWorkout {
  id: string;
  name: string;
  exerciseCountLabel: string;
  status: StatusDoDia;
}

/** Botão principal do card: começar, continuar ou rever o treino do dia. */
export function RecommendedWorkoutAction({
  recommendedWorkout,
  variant,
}: {
  recommendedWorkout: RecommendedWorkout;
  variant: 'on-gold' | 'on-inverse';
}) {
  const actionLabel =
    recommendedWorkout.status === 'em_andamento'
      ? '▶ Continuar treino'
      : recommendedWorkout.status === 'concluido'
        ? '✓ Concluído hoje · ver treino'
        : '▶ Começar treino';

  const actionClassName =
    variant === 'on-gold'
      ? 'bg-white text-amber-700'
      : recommendedWorkout.status === 'concluido'
        ? 'bg-done text-on-done'
        : 'bg-brand text-white shadow-brand';

  return (
    <Link
      href={`/treino/sessao/${recommendedWorkout.id}`}
      className={`flex w-full items-center justify-center rounded-2xl py-3.5 text-[16px] font-extrabold transition active:scale-[.98] ${actionClassName}`}
    >
      {actionLabel}
    </Link>
  );
}

/** Mini-card "Treino de hoje" dentro do card principal. */
export function TodayWorkoutSummary({
  recommendedWorkout,
  caption,
}: {
  recommendedWorkout: RecommendedWorkout;
  caption: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-3 rounded-2xl bg-white/15 px-3 py-2.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/90 text-2xl">🏋️</span>
      <span className="min-w-0">
        <span className="block text-xs font-bold opacity-85">{caption}</span>
        <span className="block truncate text-base font-extrabold">{recommendedWorkout.name}</span>
        {recommendedWorkout.exerciseCountLabel && (
          <span className="block text-xs font-bold opacity-85">{recommendedWorkout.exerciseCountLabel}</span>
        )}
      </span>
    </div>
  );
}

/** Card escuro do treino contínuo: "Recomendado para segunda". */
export function RecommendedWorkoutCard({
  recommendedWorkout,
  programName,
  weekdayLabel,
}: {
  recommendedWorkout: RecommendedWorkout;
  programName: string | null;
  weekdayLabel: string;
}) {
  return (
    <div className="rounded-3xl bg-inverse p-4 text-on-inverse">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-on-inverse-muted">
        {programName ? `🔁 ${programName} · ` : ''}Recomendado para {weekdayLabel}
      </p>
      <div className="mt-2.5">
        <TodayWorkoutSummary recommendedWorkout={recommendedWorkout} caption="Treino de hoje" />
      </div>
      <RecommendedWorkoutAction recommendedWorkout={recommendedWorkout} variant="on-inverse" />
    </div>
  );
}
