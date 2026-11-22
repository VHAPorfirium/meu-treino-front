import type { HistoryEntry, Workout } from '@/lib/types';

const SHORT_WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const LONG_WEEKDAY_LABELS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** 'YYYY-MM-DD' no fuso do aparelho (o mesmo do aluno). */
export function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shortWeekdayLabel(dayOfWeek: number): string {
  return SHORT_WEEKDAY_LABELS[dayOfWeek] ?? '';
}

export function longWeekdayLabel(dayOfWeek: number): string {
  return LONG_WEEKDAY_LABELS[dayOfWeek] ?? '';
}

/** Dias (chave local) em que o aluno concluiu pelo menos um treino. */
export function collectCompletedDayKeys(historyEntries: HistoryEntry[]): Set<string> {
  return new Set(
    historyEntries
      .filter((historyEntry) => historyEntry.completed)
      .map((historyEntry) => toLocalDayKey(new Date(historyEntry.date))),
  );
}

/** Última conclusão de cada treino (o histórico pode vir em qualquer ordem). */
export function findLastCompletionByWorkoutId(historyEntries: HistoryEntry[]): Map<string, Date> {
  const lastCompletionByWorkoutId = new Map<string, Date>();
  for (const historyEntry of historyEntries) {
    if (!historyEntry.completed) continue;
    const completedAt = new Date(historyEntry.date);
    const previousCompletion = lastCompletionByWorkoutId.get(historyEntry.workout.id);
    if (!previousCompletion || completedAt > previousCompletion) {
      lastCompletionByWorkoutId.set(historyEntry.workout.id, completedAt);
    }
  }
  return lastCompletionByWorkoutId;
}

/** "hoje", "ontem", "quinta", "há 2 sem." — para "Último: …". */
export function describeLastCompletion(lastCompletion: Date | undefined, today: Date = new Date()): string {
  if (!lastCompletion) return 'Nunca feito';
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfCompletionDay = new Date(
    lastCompletion.getFullYear(),
    lastCompletion.getMonth(),
    lastCompletion.getDate(),
  ).getTime();
  const daysAgo = Math.round((startOfToday - startOfCompletionDay) / millisecondsPerDay);
  if (daysAgo <= 0) return 'hoje';
  if (daysAgo === 1) return 'ontem';
  if (daysAgo < 7) return longWeekdayLabel(lastCompletion.getDay());
  if (daysAgo < 14) return 'há 1 sem.';
  return `há ${Math.floor(daysAgo / 7)} sem.`;
}

/** Dias seguidos com treino concluído, contando de hoje (ou de ontem, se hoje ainda não treinou). */
export function countCurrentStreak(completedDayKeys: Set<string>, today: Date = new Date()): number {
  let streakLength = 0;
  const cursorDate = new Date(today);
  if (!completedDayKeys.has(toLocalDayKey(cursorDate))) cursorDate.setDate(cursorDate.getDate() - 1);
  while (completedDayKeys.has(toLocalDayKey(cursorDate))) {
    streakLength += 1;
    cursorDate.setDate(cursorDate.getDate() - 1);
  }
  return streakLength;
}

/** Letra do treino (A, B, C…) pela posição na lista. */
export function workoutLetter(workoutIndex: number): string {
  return String.fromCharCode(65 + (workoutIndex % 26));
}

/** "6 exercícios" ou "" quando a contagem não veio. */
export function describeExerciseCount(workout: Workout): string {
  const exerciseCount = workout._count?.exercises;
  if (exerciseCount === undefined) return '';
  return `${exerciseCount} exercício${exerciseCount === 1 ? '' : 's'}`;
}

/** "Bom dia", "Boa tarde" ou "Boa noite" pela hora do aparelho. */
export function greetingForHour(hour: number): string {
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
