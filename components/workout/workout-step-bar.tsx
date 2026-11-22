import type { ExerciseStatus, TodayExercise, WorkoutExerciseLog } from '@/lib/types';

const SEGMENT_COLOR_BY_STATUS: Record<ExerciseStatus, string> = {
  DONE: 'bg-done',
  REPLACED: 'bg-done',
  SKIPPED: 'bg-skip',
};

/** Barra de etapas: um segmento por exercício, colorido pelo que já foi feito. */
export function WorkoutStepBar({
  exercises,
  exerciseLogById,
  currentExerciseId,
}: {
  exercises: TodayExercise[];
  exerciseLogById: Record<string, WorkoutExerciseLog>;
  currentExerciseId?: string;
}) {
  const markedCount = exercises.filter((exerciseItem) => exerciseLogById[exerciseItem.id]).length;
  const currentExercisePosition = currentExerciseId
    ? exercises.findIndex((exerciseItem) => exerciseItem.id === currentExerciseId) + 1
    : null;

  return (
    <div>
      <div className="flex gap-1">
        {exercises.map((exerciseItem) => {
          const exerciseStatus = exerciseLogById[exerciseItem.id]?.status;
          const segmentColor = exerciseStatus
            ? SEGMENT_COLOR_BY_STATUS[exerciseStatus]
            : exerciseItem.id === currentExerciseId
              ? 'bg-brand'
              : 'bg-chip';
          return <div key={exerciseItem.id} className={`h-1.5 flex-1 rounded-full ${segmentColor}`} />;
        })}
      </div>
      <p className="mt-1.5 text-xs font-bold text-muted2">
        {currentExercisePosition
          ? `Exercício ${currentExercisePosition} de ${exercises.length}`
          : `${markedCount} de ${exercises.length} exercícios`}
      </p>
    </div>
  );
}
