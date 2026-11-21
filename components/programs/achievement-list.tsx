import type { ProgramAchievement } from '@/lib/types';
import { buildAchievementStatsLine, buildAchievementTitle } from '@/lib/programs/achievement-summary';

/** Medalhas do aluno — um card por mesociclo/desafio concluído. */
export function AchievementList({
  achievements,
  onSelectAchievement,
}: {
  achievements: ProgramAchievement[];
  onSelectAchievement: (achievement: ProgramAchievement) => void;
}) {
  if (achievements.length === 0) return null;
  return (
    <section className="space-y-2">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">Minhas conquistas</p>
      {achievements.map((achievement) => (
        <button
          key={achievement.assignmentId}
          type="button"
          onClick={() => onSelectAchievement(achievement)}
          className="flex w-full items-center gap-3 rounded-2xl border border-gold/30 bg-gold-bg p-3 text-left"
        >
          <span className="text-3xl">🥇</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-ink">
              {buildAchievementTitle(achievement.report)}
            </span>
            <span className="block truncate text-xs font-semibold text-muted2">
              {achievement.programName} · {buildAchievementStatsLine(achievement.report)}
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}
