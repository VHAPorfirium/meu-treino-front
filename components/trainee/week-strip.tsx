import { shortWeekdayLabel, toLocalDayKey } from '@/lib/trainee/workout-history';

/** Faixa da semana (segunda a domingo) com os dias treinados marcados. */
export function WeekStrip({
  completedDayKeys,
  today = new Date(),
}: {
  completedDayKeys: Set<string>;
  today?: Date;
}) {
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - daysSinceMonday);
  const weekDates = Array.from({ length: 7 }, (_, dayOffset) => {
    const weekDate = new Date(monday);
    weekDate.setDate(monday.getDate() + dayOffset);
    return weekDate;
  });
  const todayDayKey = toLocalDayKey(today);

  return (
    <div className="flex justify-between rounded-2xl border border-line bg-card px-3 py-2.5">
      {weekDates.map((weekDate) => {
        const weekDayKey = toLocalDayKey(weekDate);
        const isCompleted = completedDayKeys.has(weekDayKey);
        const isToday = weekDayKey === todayDayKey;
        return (
          <div key={weekDayKey} className="flex w-9 flex-col items-center gap-1">
            <span className="text-[11px] font-extrabold text-muted2">
              {shortWeekdayLabel(weekDate.getDay()).charAt(0)}
            </span>
            <span
              className={`flex h-[30px] w-[30px] items-center justify-center rounded-full text-xs font-extrabold ${
                isCompleted
                  ? 'bg-done text-on-done'
                  : isToday
                    ? 'border-[2.5px] border-brand text-brand'
                    : 'bg-chip text-muted2'
              }`}
              aria-label={isCompleted ? 'Treino concluído' : undefined}
            >
              {isCompleted ? '✓' : weekDate.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}
