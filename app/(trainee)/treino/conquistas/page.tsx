'use client';

import { useEffect, useState } from 'react';
import type { HistoryEntry, ProgramAchievement } from '@/lib/types';
import { programsApi, workoutLogsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useCurrentProgram } from '@/lib/programs/use-current-program';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import { buildAchievementTitle } from '@/lib/programs/achievement-summary';
import { AppHeader } from '@/components/layout/app-header';
import { SectionTitle } from '@/components/trainee/section-title';
import { StatTile } from '@/components/trainee/stat-tile';
import { ChallengeCompletedCelebration } from '@/components/programs/challenge-completed-celebration';

const MEDAL_ICON_BY_PROGRAM_TYPE = { CHALLENGE: '🥇', MESOCYCLE: '🏅', CONTINUOUS: '🎖️' } as const;

/** Média das evoluções de carga das conquistas que têm esse número. */
function averageLoadEvolution(achievements: ProgramAchievement[]): number | null {
  const loadEvolutions = achievements
    .map((achievement) => achievement.report.loadEvolutionPercentage)
    .filter((loadEvolution): loadEvolution is number => loadEvolution !== null);
  if (loadEvolutions.length === 0) return null;
  return Math.round(loadEvolutions.reduce((sum, loadEvolution) => sum + loadEvolution, 0) / loadEvolutions.length);
}

function formatMonthYear(isoDate: string | null): string {
  if (!isoDate) return '';
  return new Date(isoDate).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '');
}

/** Aba "Conquistas": medalhas dos desafios/mesociclos concluídos e a próxima em andamento. */
export default function ConquistasPage() {
  const [achievements, setAchievements] = useState<ProgramAchievement[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
  const [selectedAchievement, setSelectedAchievement] = useState<ProgramAchievement | null>(null);
  const { currentProgram, loadCurrentProgram } = useCurrentProgram();

  useEffect(() => {
    let cancelled = false;
    setErrorMessage(null);
    programsApi
      .achievements()
      .then((list) => {
        if (!cancelled) setAchievements(list);
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof ApiError
              ? error.message
              : 'Sem conexão — não foi possível carregar suas conquistas.',
          );
        }
      });

    (async () => {
      const pageSize = 200;
      const all: HistoryEntry[] = [];
      for (let page = 0; page < 10; page++) {
        const { items, total } = await workoutLogsApi.myHistoryPage({
          limit: pageSize,
          offset: page * pageSize,
        });
        all.push(...items);
        if (items.length < pageSize || (total !== null && all.length >= total)) break;
      }
      if (!cancelled) setHistoryEntries(all);
    })().catch(() => {});

    void loadCurrentProgram();
    return () => {
      cancelled = true;
    };
  }, [loadCurrentProgram]);

  const completedWorkoutsCount = historyEntries.filter((historyEntry) => historyEntry.completed).length;
  const averageEvolution = averageLoadEvolution(achievements ?? []);
  const nextMedalProgram =
    currentProgram?.hasDeadline && currentProgram.status === 'ACTIVE' && currentProgram.progress
      ? currentProgram
      : null;

  return (
    <>
      <AppHeader eyebrow="Sua jornada" title="Conquistas" />
      <div className="space-y-3.5 p-5 pb-28">
        <div className="grid grid-cols-3 gap-2">
          <StatTile value={achievements?.length ?? '–'} label="medalhas" />
          <StatTile value={completedWorkoutsCount} label="treinos no total" />
          <StatTile
            value={averageEvolution == null ? '–' : `${averageEvolution >= 0 ? '+' : ''}${averageEvolution}%`}
            label="carga média"
            valueClassName={averageEvolution != null && averageEvolution > 0 ? '!text-done-ink' : ''}
          />
        </div>

        {nextMedalProgram?.progress && (
          <div className="rounded-2xl border border-gold bg-card p-4">
            <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-gold">Próxima medalha</p>
            <p className="mt-0.5 text-[15px] font-extrabold text-ink">
              {PROGRAM_TYPE_RULES[nextMedalProgram.program.type].label} · {nextMedalProgram.program.name}
            </p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-chip">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-600"
                style={{ width: `${nextMedalProgram.progress.progressPercentage}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs font-bold text-muted2">
              {nextMedalProgram.progress.isLastDayReached
                ? 'Último dia! Finalize um treino para conquistar 🏆'
                : `Faltam ${nextMedalProgram.progress.totalDays - nextMedalProgram.progress.currentDayNumber} dias · continue assim 🔥`}
            </p>
          </div>
        )}

        <section>
          <SectionTitle>Medalhas</SectionTitle>
          {errorMessage && (
            <p className="rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold text-brand-ink">
              {errorMessage}
            </p>
          )}
          {achievements === null && !errorMessage && (
            <p className="py-6 text-center text-muted2">Carregando…</p>
          )}
          {achievements?.length === 0 && !errorMessage && !nextMedalProgram && (
            <div className="py-10 text-center text-muted2">
              <p className="text-4xl">🏆</p>
              <p className="mt-2 font-semibold">Nenhuma medalha ainda.</p>
              <p className="mt-1 text-sm">Conclua um desafio ou mesociclo para ganhar a primeira.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {achievements?.map((achievement) => (
              <button
                key={achievement.assignmentId}
                type="button"
                onClick={() => setSelectedAchievement(achievement)}
                className="rounded-2xl border border-line bg-card p-3.5 text-center transition active:scale-[.98]"
              >
                <span className="block text-[44px] leading-none">{MEDAL_ICON_BY_PROGRAM_TYPE[achievement.programType]}</span>
                <span className="mt-2 block text-[13.5px] font-extrabold leading-tight text-ink">
                  {buildAchievementTitle(achievement.report).replace(' com Sucesso!', '').replace(' com sucesso!', '')}
                </span>
                <span className="mt-0.5 block text-[11px] font-bold text-muted2">
                  {achievement.programName} · {formatMonthYear(achievement.completedAt)}
                </span>
                <span className="mt-2 inline-block rounded-full bg-gold-bg px-2.5 py-1 text-[11px] font-extrabold text-gold">
                  ↗ Compartilhar
                </span>
              </button>
            ))}
            {nextMedalProgram && (
              <div className="rounded-2xl border border-dashed border-line3 bg-card p-3.5 text-center opacity-60">
                <span className="block text-[44px] leading-none grayscale">
                  {MEDAL_ICON_BY_PROGRAM_TYPE[nextMedalProgram.program.type]}
                </span>
                <span className="mt-2 block text-[13.5px] font-extrabold leading-tight text-ink">
                  {nextMedalProgram.program.name}
                </span>
                <span className="mt-0.5 block text-[11px] font-bold text-muted2">em andamento</span>
              </div>
            )}
          </div>
        </section>
      </div>

      {selectedAchievement && (
        <ChallengeCompletedCelebration
          programReport={selectedAchievement.report}
          onClose={() => setSelectedAchievement(null)}
        />
      )}
    </>
  );
}
