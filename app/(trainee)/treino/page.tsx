'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  PatchExercisePayload,
  TodayResponse,
  WorkoutExerciseLog,
  WorkoutLog,
} from '@/lib/types';
import { workoutLogsApi, workoutsApi } from '@/lib/api/endpoints';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { ExerciseCard } from '@/components/workout/exercise-card';

const TODAY_LABEL = () =>
  new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });

export default function TreinoPage() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workoutsApi.today(new Date().getDay());
      setData(res);
      setLog(res.workoutLog);
    } catch {
      setError('Não foi possível carregar o treino de hoje.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const logMap = useMemo(() => {
    const m: Record<string, WorkoutExerciseLog> = {};
    for (const e of log?.exerciseLogs ?? []) m[e.workoutExerciseId] = e;
    return m;
  }, [log]);

  async function ensureLog(): Promise<WorkoutLog> {
    if (log) return log;
    const opened = await workoutLogsApi.open(data!.workout!.id);
    setLog(opened);
    return opened;
  }

  async function handlePatch(weId: string, payload: PatchExercisePayload) {
    const current = await ensureLog();
    await workoutLogsApi.patchExercise(current.id, weId, payload);
    setLog((prev) => {
      if (!prev) return prev;
      const others = prev.exerciseLogs.filter(
        (e) => e.workoutExerciseId !== weId,
      );
      const merged: WorkoutExerciseLog = {
        id: logMap[weId]?.id ?? `local-${weId}`,
        workoutExerciseId: weId,
        status: payload.status,
        actualExerciseId: payload.actualExerciseId ?? null,
        loadUsed: payload.loadUsed ?? null,
        setsCompleted: payload.setsCompleted ?? null,
        note: payload.note ?? null,
      };
      return { ...prev, exerciseLogs: [...others, merged] };
    });
  }

  async function start() {
    setBusy(true);
    try {
      await ensureLog();
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!log) return;
    setBusy(true);
    try {
      const done = await workoutLogsApi.complete(log.id);
      setLog({ ...log, completed: done.completed });
    } finally {
      setBusy(false);
    }
  }

  const workout = data?.workout;
  const total = workout?.exercises.length ?? 0;
  const marked = log?.exerciseLogs.length ?? 0;
  const pct = total ? Math.round((marked / total) * 100) : 0;
  const pending = total - marked;

  return (
    <>
      <AppHeader
        eyebrow={TODAY_LABEL()}
        title={workout?.name ?? 'Treino de hoje'}
      />

      <div className="space-y-3 p-5 pb-28">
        {loading && <p className="py-10 text-center text-muted2">Carregando…</p>}
        {error && <p className="py-10 text-center text-brand">{error}</p>}

        {!loading && !error && !workout && (
          <div className="py-16 text-center text-muted2">
            <p className="text-4xl">🛌</p>
            <p className="mt-2">Nenhum treino para hoje.</p>
          </div>
        )}

        {workout && (
          <div className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">
                Progresso
              </p>
              <p className="font-display text-[24px] font-extrabold text-paper">
                {marked} de {total} exercícios
              </p>
            </div>
            <p className="font-display text-[30px] font-extrabold text-brand">
              {pct}%
            </p>
          </div>
        )}

        {workout && log?.completed && (
          <div className="rounded-2xl border border-done bg-done-bg p-4 text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-1 font-extrabold text-done-ink">Treino concluído!</p>
            <p className="text-sm text-muted">Mandou bem 💪</p>
          </div>
        )}

        {workout && !log && (
          <Button className="w-full py-4 text-[17px]" disabled={busy} onClick={start}>
            {busy ? 'Iniciando…' : 'Iniciar treino'}
          </Button>
        )}

        {workout?.exercises.map((item) => (
          <ExerciseCard
            key={item.id}
            item={item}
            log={logMap[item.id]}
            disabled={log?.completed}
            onPatch={handlePatch}
          />
        ))}

        {workout && log && !log.completed && (
          <div className="pt-1">
            <Button
              className="w-full py-4 text-[18px]"
              disabled={busy}
              onClick={complete}
            >
              {busy ? 'Salvando…' : 'Finalizar treino'}
            </Button>
            {pending > 0 && (
              <p className="mt-2.5 text-center text-xs font-semibold text-muted2">
                Faltam {pending} exercício{pending > 1 ? 's' : ''} pendente
                {pending > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
