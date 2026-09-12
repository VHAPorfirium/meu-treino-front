'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HistoryEntry } from '@/lib/types';
import { workoutLogsApi } from '@/lib/api/endpoints';
import { AppHeader } from '@/components/layout/app-header';
import { StatusBadge } from '@/components/ui/status-badge';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

export default function HistoricoPage() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workoutLogsApi
      .myHistory()
      .then(setEntries)
      .catch(() => setError('Não foi possível carregar o histórico.'));
  }, []);

  const monthCount = useMemo(() => {
    if (!entries) return 0;
    const now = new Date();
    return entries.filter((e) => {
      const d = new Date(e.date);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    }).length;
  }, [entries]);

  return (
    <>
      <AppHeader
        title="Seu histórico"
        subtitle={new Date().toLocaleDateString('pt-BR', {
          month: 'long',
          year: 'numeric',
        })}
      />
      <div className="space-y-3 p-5 pb-24">
        <div className="flex gap-3">
          <div className="flex-1 rounded-2xl bg-ink p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
              Este mês
            </p>
            <p className="font-display text-[30px] font-extrabold text-paper">
              {monthCount} treinos
            </p>
          </div>
          <div className="flex-1 rounded-2xl border border-line bg-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted2">
              Total
            </p>
            <p className="font-display text-[30px] font-extrabold text-brand">
              {entries?.length ?? 0}
            </p>
          </div>
        </div>

        {error && <p className="py-10 text-center text-brand">{error}</p>}
        {!entries && !error && (
          <p className="py-10 text-center text-muted2">Carregando…</p>
        )}
        {entries && entries.length === 0 && (
          <p className="py-16 text-center text-muted2">
            Nenhum treino registrado ainda.
          </p>
        )}

        {entries?.map((e) => {
          const done = e.exerciseLogs.filter((x) => x.status === 'DONE').length;
          return (
            <div
              key={e.id}
              className="rounded-2xl border border-line bg-card p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="font-extrabold">{e.workout.name}</p>
                  <p className="text-xs capitalize text-muted2">{fmtDate(e.date)}</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                    e.completed
                      ? 'bg-done-bg text-done-ink'
                      : 'bg-chip text-muted'
                  }`}
                >
                  {e.completed ? 'Concluído' : 'Em aberto'}
                </span>
              </div>
              <p className="mb-2 text-xs font-semibold text-muted2">
                {done} feitos de {e.exerciseLogs.length} registrados
              </p>
              <div className="space-y-1.5">
                {e.exerciseLogs.map((x) => (
                  <div
                    key={x.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 truncate capitalize text-ink2">
                      {x.status === 'REPLACED' && x.actualExercise
                        ? `${x.workoutExercise.exercise.name} → ${x.actualExercise.name}`
                        : x.workoutExercise.exercise.name}
                      {x.loadUsed ? (
                        <span className="font-bold text-muted2"> · {x.loadUsed}kg</span>
                      ) : null}
                    </span>
                    <StatusBadge status={x.status} />
                  </div>
                ))}
              </div>
              {e.exerciseLogs.some((x) => x.note) && (
                <div className="mt-3 space-y-1.5 border-t border-line pt-3">
                  {e.exerciseLogs
                    .filter((x) => x.note)
                    .map((x) => (
                      <p
                        key={x.id}
                        className="border-l-[3px] border-skip pl-3 text-xs text-muted"
                      >
                        “{x.note}” —{' '}
                        <span className="capitalize">
                          {x.workoutExercise.exercise.name}
                        </span>
                      </p>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
