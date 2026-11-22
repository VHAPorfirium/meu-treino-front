'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { triggerHaptic } from '@/lib/haptics';

/** "18:42" ou "1:05:12" a partir de segundos. */
function formatElapsedTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
    : `${minutes}:${paddedSeconds}`;
}

/** Cabeçalho da execução (modo foco): voltar, nome do treino e tempo decorrido. */
export function WorkoutSessionHeader({
  workoutName,
  sessionStartedAt,
}: {
  workoutName: string;
  /** ISO de quando a sessão foi aberta; `null` esconde o cronômetro. */
  sessionStartedAt: string | null;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!sessionStartedAt) return;
    const startedAtTimestamp = new Date(sessionStartedAt).getTime();
    const updateElapsed = () =>
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtTimestamp) / 1000)));
    updateElapsed();
    const intervalId = setInterval(updateElapsed, 1000);
    return () => clearInterval(intervalId);
  }, [sessionStartedAt]);

  return (
    <header className="safe-top sticky top-0 z-20 border-b border-line bg-paper/95 px-5 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        <Link
          href="/treino"
          onClick={() => triggerHaptic('light')}
          aria-label="Voltar para o início"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chip text-lg font-extrabold text-ink"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted2">
            {sessionStartedAt ? 'Treino em andamento' : 'Treino'}
          </p>
          <h1 className="truncate font-display text-[20px] font-extrabold leading-tight text-ink">
            {workoutName}
          </h1>
        </div>
        {sessionStartedAt && (
          <span className="shrink-0 rounded-full bg-chip px-3 py-1.5 font-display text-sm font-extrabold tabular-nums text-ink">
            ⏱ {formatElapsedTime(elapsedSeconds)}
          </span>
        )}
      </div>
    </header>
  );
}
