'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type {
  PatchExercisePayload,
  TodayResponse,
  WorkoutExerciseLog,
  WorkoutLog,
} from '@/lib/types';
import { notesApi, workoutLogsApi, workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { enqueueAndSend, flush, onPendingChange, wireAutoFlush } from '@/lib/offline/queue';
import {
  carregarRascunho,
  descartarRascunho,
  salvarExercicio,
  salvarTimer,
  type RascunhoExercicio,
} from '@/lib/offline/rascunho';
import { useWakeLock } from '@/lib/hooks/use-wake-lock';
import { AppHeader } from '@/components/layout/app-header';
import { Button } from '@/components/ui/button';
import { ExerciseCard } from '@/components/workout/exercise-card';
import { RestTimer } from '@/components/workout/rest-timer';
import { PushOptIn } from '@/components/layout/push-opt-in';

/** '2026-09-21' -> 'segunda, 21/09' */
function rotuloData(iso: string): string {
  const [ano, mes, dia] = iso.split('-').map(Number);
  const d = new Date(ano, mes - 1, dia);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  });
}

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
  const [pendingOps, setPendingOps] = useState(0);
  const [pendingWe, setPendingWe] = useState<Set<string>>(new Set());
  const [timer, setTimer] = useState<
    { seconds: number; label: string; terminaEm?: number } | null
  >(null);
  // E13 — o que ela digitou e o app morreu antes de salvar
  const [rascunhos, setRascunhos] = useState<Record<string, RascunhoExercicio>>({});
  const [rascunhoPronto, setRascunhoPronto] = useState(false);
  const [unreadNotes, setUnreadNotes] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workoutsApi.today(new Date().getDay());
      setData(res);
      setLog(res.workoutLog);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? `Não foi possível carregar o treino (${e.message}).`
          : 'Sem conexão — o treino de hoje não pôde ser carregado.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    wireAutoFlush();
    const off = onPendingChange((n) => {
      setPendingOps(n);
      if (n === 0) setPendingWe(new Set());
    });
    notesApi
      .mine()
      .then((r) => setUnreadNotes(r.unread))
      .catch(() => {});
    return () => {
      off();
    };
  }, [load]);

  /**
   * E13 — ao (re)montar com uma sessão aberta, recupera o rascunho: o que foi
   * digitado sem salvar e o descanso que estava correndo. O timer é retomado
   * pelo **instante absoluto**, então volta com o tempo certo, não do zero.
   */
  useEffect(() => {
    // sem sessão aberta não há rascunho a recuperar — libera a lista na hora
    if (!log?.id || log.completed) {
      setRascunhoPronto(true);
      return;
    }
    let cancelado = false;
    void carregarRascunho(log.id).then((r) => {
      if (cancelado || !r) {
        setRascunhoPronto(true);
        return;
      }
      setRascunhos(r.exercicios ?? {});
      if (r.timerTerminaEm && r.timerTerminaEm > Date.now()) {
        setTimer({
          seconds: Math.ceil((r.timerTerminaEm - Date.now()) / 1000),
          label: r.timerRotulo ?? 'Descanso',
          terminaEm: r.timerTerminaEm,
        });
      }
      setRascunhoPronto(true);
    });
    return () => {
      cancelado = true;
    };
  }, [log?.id, log?.completed]);

  // E13 — grava cada digitação com atraso; a tela não pode esperar o IndexedDB
  const gravar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<Record<string, RascunhoExercicio>>({});
  const onRascunho = useCallback(
    (weId: string, dados: RascunhoExercicio) => {
      const logId = log?.id;
      if (!logId) return;
      pendente.current[weId] = { ...pendente.current[weId], ...dados };
      if (gravar.current) clearTimeout(gravar.current);
      gravar.current = setTimeout(() => {
        const lote = pendente.current;
        pendente.current = {};
        for (const [id, d] of Object.entries(lote)) {
          void salvarExercicio(logId, id, d);
        }
      }, 400);
    },
    [log?.id],
  );

  // mantém a tela acesa durante o treino: ataca a CAUSA de o iOS matar o app
  useWakeLock(Boolean(log) && !log?.completed);

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

  /** Marcação idempotente: tenta enviar; se estiver offline, fica na fila (E5). */
  async function handlePatch(weId: string, payload: PatchExercisePayload) {
    const current = await ensureLog();
    const res = await enqueueAndSend({
      method: 'PATCH',
      path: `/workout-logs/${current.id}/exercises/${weId}`,
      body: payload,
      key: `patch:${current.id}:${weId}`, // a última marcação do exercício vence
    });
    setPendingWe((s) => {
      const n = new Set(s);
      if (res.queued) n.add(weId);
      else n.delete(weId);
      return n;
    });
    // atualiza o estado local (otimista) — vale tanto enviado quanto enfileirado
    setLog((prev) => {
      if (!prev) return prev;
      const others = prev.exerciseLogs.filter((e) => e.workoutExerciseId !== weId);
      const merged: WorkoutExerciseLog = {
        id: logMap[weId]?.id ?? `local-${weId}`,
        workoutExerciseId: weId,
        status: payload.status,
        actualExerciseId: payload.actualExerciseId ?? null,
        loadUsed: payload.loadUsed ?? null,
        setsCompleted: payload.setsCompleted ?? null,
        note: payload.note ?? null,
        sets: payload.sets?.map((s) => ({
          setNumber: s.setNumber,
          weight: s.weight ?? null,
          reps: s.reps ?? null,
        })),
      };
      return { ...prev, exerciseLogs: [...others, merged] };
    });
  }

  async function start() {
    setBusy(true);
    try {
      await ensureLog();
    } catch (e) {
      // 409 (E9) = já concluído hoje em outro aparelho/aba. Recarrega em vez de
      // insistir: a fonte da verdade é o servidor.
      if (e instanceof ApiError && e.status === 409) {
        setError(e.message);
        await load();
      } else {
        setError(
          e instanceof ApiError
            ? e.message
            : 'Sem conexão — conecte-se pra iniciar o treino.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!log) return;
    setBusy(true);
    try {
      // garante que marcações pendentes subam antes de fechar a sessão
      const { left } = await flush();
      if (left > 0) {
        setError('Ainda há marcações aguardando rede. Conecte-se e tente de novo.');
        return;
      }
      const done = await workoutLogsApi.complete(log.id);
      setLog({ ...log, completed: done.completed });
      await descartarRascunho(); // E13 — sessão fechada, rascunho não ressuscita
      setRascunhos({});
      setTimer(null);
      // recarrega pra pegar `status` e `proximaLiberacao` do servidor (E9)
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sem conexão — tente finalizar depois.');
    } finally {
      setBusy(false);
    }
  }

  const workout = data?.workout;
  // E9 — o servidor é quem diz se o treino de hoje já foi concluído. O front não
  // deduz mais isso da ausência de sessão (era o que fazia o treino "renascer").
  const concluidoHoje = data?.status === 'concluido';
  const total = workout?.exercises.length ?? 0;
  const marked = log?.exerciseLogs.length ?? 0;
  const pct = total ? Math.round((marked / total) * 100) : 0;
  const pendingCount = total - marked;

  return (
    <>
      <AppHeader eyebrow={TODAY_LABEL()} title={workout?.name ?? 'Treino de hoje'} />

      <div className="space-y-3 p-5 pb-28">
        {/* avisos: offline / recados */}
        {pendingOps > 0 && (
          <div className="rounded-2xl border border-line bg-card px-4 py-2.5 text-xs font-semibold text-muted">
            ⏳ {pendingOps} marcaç{pendingOps > 1 ? 'ões' : 'ão'} salva{pendingOps > 1 ? 's' : ''} no
            aparelho — envia sozinho quando a rede voltar.{' '}
            <button onClick={() => void flush()} className="underline">
              tentar agora
            </button>
          </div>
        )}
        {unreadNotes > 0 && (
          <Link
            href="/treino/recados"
            className="block rounded-2xl border border-line bg-card px-4 py-2.5 text-sm font-bold text-ink"
          >
            📝 {unreadNotes} recado{unreadNotes > 1 ? 's' : ''} novo{unreadNotes > 1 ? 's' : ''} do
            seu personal →
          </Link>
        )}

        {loading && <p className="py-10 text-center text-muted2">Carregando…</p>}
        {error && (
          <p className="rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold text-brand">
            {error}
          </p>
        )}

        {!loading && !error && !workout && (
          <div className="py-16 text-center text-muted2">
            <p className="text-4xl">🛌</p>
            <p className="mt-2 font-semibold">Nenhum treino atribuído a você.</p>
            <p className="mt-1 text-sm">Quando seu personal direcionar um treino, ele aparece aqui.</p>
          </div>
        )}

        {workout && data?.isFallback && !log && (
          <div className="rounded-2xl border border-skip bg-skip-bg px-4 py-3 text-sm font-semibold text-skip">
            Sem treino marcado pra hoje — sugerido: <b>{workout.name}</b>.{' '}
            <Link href="/treino/meus" className="underline">
              Ver meus treinos
            </Link>
          </div>
        )}

        {workout && (
          <div className="flex items-center justify-between rounded-2xl bg-ink px-5 py-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Progresso</p>
              <p className="font-display text-[24px] font-extrabold text-paper">
                {marked} de {total} exercícios
              </p>
            </div>
            <p className="font-display text-[30px] font-extrabold text-brand">{pct}%</p>
          </div>
        )}

        {workout && concluidoHoje && (
          <div className="rounded-2xl border border-done bg-done-bg p-4 text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-1 font-extrabold text-done-ink">
              Treino de hoje concluído!
            </p>
            <p className="text-sm text-muted">Mandou bem 💪</p>
            {data?.proximaLiberacao && (
              <p className="mt-2 text-xs font-bold text-muted2">
                Volta a liberar {rotuloData(data.proximaLiberacao)}
              </p>
            )}
          </div>
        )}

        {/* só oferece começar quando o servidor diz que ainda não começou */}
        {workout && data?.status === 'nao_iniciado' && (
          <Button className="w-full py-4 text-[17px]" disabled={busy} onClick={start}>
            {busy ? 'Iniciando…' : 'Iniciar treino'}
          </Button>
        )}

        {/* espera o rascunho: o card lê o que foi digitado só ao montar (E13) */}
        {rascunhoPronto &&
          workout?.exercises.map((item) => (
          <ExerciseCard
            key={item.id}
            item={item}
            log={logMap[item.id]}
            disabled={concluidoHoje}
            pending={pendingWe.has(item.id)}
            onPatch={handlePatch}
            rascunho={rascunhos[item.id]}
            onRascunho={onRascunho}
              onTimer={(s, label) => s && s > 0 && setTimer({ seconds: s, label })}
            />
          ))}

        {workout && log && !concluidoHoje && (
          <div className="pt-1">
            <Button className="w-full py-4 text-[18px]" disabled={busy} onClick={complete}>
              {busy ? 'Salvando…' : 'Finalizar treino'}
            </Button>
            {pendingCount > 0 && (
              <p className="mt-2.5 text-center text-xs font-semibold text-muted2">
                Faltam {pendingCount} exercício{pendingCount > 1 ? 's' : ''} pendente
                {pendingCount > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {workout && <PushOptIn />}
      </div>

      {timer && (
        <RestTimer
          seconds={timer.seconds}
          label={timer.label}
          terminaEm={timer.terminaEm}
          onAlvo={(t) => log && void salvarTimer(log.id, t, timer.label)}
          onClose={() => {
            setTimer(null);
            if (log) void salvarTimer(log.id, null);
          }}
        />
      )}
    </>
  );
}
