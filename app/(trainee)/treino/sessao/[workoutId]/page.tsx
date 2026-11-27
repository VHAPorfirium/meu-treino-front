'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type {
  LastPerformanceByWorkoutExerciseId,
  PatchExercisePayload,
  TodayResponse,
  WorkoutExerciseLog,
  WorkoutLog,
} from '@/lib/types';
import { workoutLogsApi, workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { enqueueAndSend, flush, onPendingChange, wireAutoFlush } from '@/lib/offline/queue';
import {
  carregarRascunho,
  descartarRascunho,
  salvarExerciciosEmLote,
  salvarTimer,
  type RascunhoExercicio,
} from '@/lib/offline/rascunho';
import { useWakeLock } from '@/lib/hooks/use-wake-lock';
import { Button } from '@/components/ui/button';
import { ExerciseCard } from '@/components/workout/exercise-card';
import { RestTimer } from '@/components/workout/rest-timer';
import { ConnectionStatus } from '@/components/layout/connection-status';
import { triggerHaptic } from '@/lib/haptics';
import { unlockAudio } from '@/lib/audio';
import { ChallengeCompletedCelebration } from '@/components/programs/challenge-completed-celebration';
import { useCurrentProgram } from '@/lib/programs/use-current-program';
import { WorkoutSessionHeader } from '@/components/workout/workout-session-header';
import { WorkoutStepBar } from '@/components/workout/workout-step-bar';

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

/**
 * Execução de um treino escolhido na tela inicial (modo foco: sem menu de baixo).
 * A lógica de marcação offline, rascunho e cronômetro é a mesma de antes —
 * só deixou de ser "o treino de hoje" para ser "o treino que o aluno escolheu".
 */
export default function WorkoutSessionPage() {
  const { workoutId } = useParams<{ workoutId: string }>();
  const [data, setData] = useState<TodayResponse | null>(null);
  const [log, setLog] = useState<WorkoutLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [pendingWe, setPendingWe] = useState<Set<string>>(new Set());
  const nextTimerId = useRef(1);
  const [timer, setTimer] = useState<
    { id: number; seconds: number; label: string; terminaEm?: number } | null
  >(null);
  // E13 — o que ela digitou e o app morreu antes de salvar
  const [rascunhos, setRascunhos] = useState<Record<string, RascunhoExercicio>>({});
  const [rascunhoPronto, setRascunhoPronto] = useState(false);
  const [lastPerformanceByWorkoutExerciseId, setLastPerformanceByWorkoutExerciseId] =
    useState<LastPerformanceByWorkoutExerciseId>({});
  // os cards leem a carga sugerida só ao montar: espera a resposta (ou a falha)
  const [isLastPerformanceLoaded, setIsLastPerformanceLoaded] = useState(false);
  const { celebration, loadCurrentProgram, closeCelebration } = useCurrentProgram();
  const openingLogRef = useRef<Promise<WorkoutLog> | null>(null);
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setRascunhoPronto(false);
    setError(null);
    try {
      const res = await workoutsApi.session(workoutId);
      if (seq !== loadSeqRef.current) return;

      // E13 — recupera o rascunho ANTES de montar os <ExerciseCard>, pois cada card
      // lê `rascunho` apenas nos initializers de useState. Evita a corrida em que
      // `rascunhoPronto` virava `true` enquanto `loading` ainda era `true` e `log` era `null`.
      let exerciciosRecuperados: Record<string, RascunhoExercicio> = {};
      let timerRecuperado: { id: number; seconds: number; label: string; terminaEm?: number } | null =
        null;

      if (res.workoutLog?.id && !res.workoutLog.completed) {
        const r = await carregarRascunho(res.workoutLog.id);
        if (seq !== loadSeqRef.current) return;
        if (r) {
          exerciciosRecuperados = r.exercicios ?? {};
          if (r.timerTerminaEm && r.timerTerminaEm > Date.now()) {
            timerRecuperado = {
              id: nextTimerId.current++,
              seconds: Math.ceil((r.timerTerminaEm - Date.now()) / 1000),
              label: r.timerRotulo ?? 'Descanso',
              terminaEm: r.timerTerminaEm,
            };
          }
        }
      }

      setRascunhos(exerciciosRecuperados);
      if (timerRecuperado) {
        setTimer(timerRecuperado);
      }
      setData(res);
      setLog(res.workoutLog);
      setRascunhoPronto(true);
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      setError(
        e instanceof ApiError
          ? `Não foi possível carregar o treino (${e.message}).`
          : 'Sem conexão — o treino não pôde ser carregado.',
      );
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [workoutId]);

  useEffect(() => {
    void load();
    void loadCurrentProgram();
    wireAutoFlush();
    const off = onPendingChange((n) => {
      setPendingOps(n);
      if (n === 0) setPendingWe(new Set());
    });
    // "última vez" + sugestão de carga: ajuda, mas o treino funciona sem
    workoutLogsApi
      .lastPerformance(workoutId)
      .then(setLastPerformanceByWorkoutExerciseId)
      .catch(() => {})
      .finally(() => setIsLastPerformanceLoaded(true));
    return () => {
      loadSeqRef.current += 1;
      off();
    };
  }, [load, loadCurrentProgram, workoutId]);

  // E13 — grava cada digitação com atraso; a tela não pode esperar o IndexedDB
  const gravar = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendente = useRef<Record<string, RascunhoExercicio>>({});
  const cancelarRascunhoPendente = useCallback(() => {
    if (gravar.current) {
      clearTimeout(gravar.current);
      gravar.current = null;
    }
    pendente.current = {};
  }, []);

  useEffect(() => cancelarRascunhoPendente, [cancelarRascunhoPendente]);

  const onRascunho = useCallback(
    (weId: string, dados: RascunhoExercicio) => {
      const logId = log?.id;
      if (!logId || log?.completed) return;
      pendente.current[weId] = { ...pendente.current[weId], ...dados };
      if (gravar.current) clearTimeout(gravar.current);
      gravar.current = setTimeout(() => {
        gravar.current = null;
        const lote = pendente.current;
        pendente.current = {};
        void salvarExerciciosEmLote(logId, lote);
      }, 400);
    },
    [log?.id, log?.completed],
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
    if (openingLogRef.current) return openingLogRef.current;
    const promise = workoutLogsApi
      .open(data!.workout!.id)
      .then((opened) => {
        setLog(opened);
        setData((prev) =>
          prev && prev.status === 'nao_iniciado'
            ? { ...prev, status: 'em_andamento', workoutLog: opened }
            : prev,
        );
        return opened;
      })
      .finally(() => {
        openingLogRef.current = null;
      });
    openingLogRef.current = promise;
    return promise;
  }

  /** Marcação idempotente: tenta enviar; se estiver offline, fica na fila (E5). */
  async function handlePatch(weId: string, payload: PatchExercisePayload) {
    try {
      const current = await ensureLog();
      const res = await enqueueAndSend({
        method: 'PATCH',
        path: `/workout-logs/${current.id}/exercises/${weId}`,
        body: payload,
        key: `patch:${current.id}:${weId}`, // a última marcação do exercício vence
      });
      setError(null);
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
          totalSeconds: payload.totalSeconds ?? null,
          note: payload.note ?? null,
          sets: payload.sets?.map((s) => ({
            setNumber: s.setNumber,
            weight: s.weight ?? null,
            reps: s.reps ?? null,
            durationSeconds: s.durationSeconds ?? null,
          })),
        };
        return { ...prev, exerciseLogs: [...others, merged] };
      });
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : 'Sem conexão — conecte-se pra iniciar e salvar este exercício.',
      );
    }
  }

  async function start() {
    unlockAudio();
    triggerHaptic('success');
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
    triggerHaptic('medium');
    setBusy(true);
    try {
      // garante que marcações pendentes subam antes de fechar a sessão
      const { left } = await flush();
      if (left > 0) {
        setError('Ainda há marcações aguardando rede. Conecte-se e tente de novo.');
        return;
      }
      const done = await workoutLogsApi.complete(log.id);
      triggerHaptic('success');
      cancelarRascunhoPendente(); // cancela debounce antes de limpar para o rascunho não ressuscitar
      setLog({ ...log, completed: done.completed });
      await descartarRascunho(); // E13 — sessão fechada, rascunho não ressuscita
      setRascunhos({});
      setTimer(null);
      // recarrega pra pegar `status` e `proximaLiberacao` do servidor (E9)
      await load();
      // se este treino fechou o último dia do desafio/mesociclo, o programa
      // volta como COMPLETED e a comemoração (com vibração forte) abre sozinha
      await loadCurrentProgram();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Sem conexão — tente finalizar depois.');
    } finally {
      setBusy(false);
    }
  }

  const handleTimerAlvo = useCallback(
    (terminaEm: number | null) => {
      if (log?.id) void salvarTimer(log.id, terminaEm, timer?.label);
    },
    [log?.id, timer?.label],
  );

  const workout = data?.workout;
  // E9 — o servidor é quem diz se o treino de hoje já foi concluído. O front não
  // deduz mais isso da ausência de sessão (era o que fazia o treino "renascer").
  const concluidoHoje = data?.status === 'concluido';
  const total = workout?.exercises.length ?? 0;
  const marked = log?.exerciseLogs.length ?? 0;
  const pendingCount = total - marked;
  // exercício "da vez": o primeiro ainda sem marcação — fica destacado e aberto
  const currentExerciseId = concluidoHoje
    ? undefined
    : workout?.exercises.find((exerciseItem) => !logMap[exerciseItem.id])?.id;

  return (
    <>
      <WorkoutSessionHeader
        workoutName={workout?.name ?? 'Treino'}
        sessionStartedAt={log && !log.completed ? log.date : null}
      />
      <ConnectionStatus />

      <div className="space-y-3 p-5 pb-32">
        {workout && (
          <WorkoutStepBar
            exercises={workout.exercises}
            exerciseLogById={logMap}
            currentExerciseId={currentExerciseId}
          />
        )}

        {pendingOps > 0 && (
          <div className="rounded-2xl border border-line bg-card px-4 py-2.5 text-xs font-semibold text-muted">
            ⏳ {pendingOps} marcaç{pendingOps > 1 ? 'ões' : 'ão'} salva{pendingOps > 1 ? 's' : ''} no
            aparelho — envia sozinho quando a rede voltar.{' '}
            <button onClick={() => void flush()} className="underline">
              tentar agora
            </button>
          </div>
        )}

        {loading && <p className="py-10 text-center text-muted2">Carregando…</p>}
        {error && (
          <p className="rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold text-brand-ink">
            {error}
          </p>
        )}

        {!loading && !error && !workout && (
          <div className="py-16 text-center text-muted2">
            <p className="text-4xl">🔎</p>
            <p className="mt-2 font-semibold">Treino não encontrado.</p>
            <Link href="/treino" className="mt-2 inline-block text-sm font-bold text-brand-ink underline">
              Voltar para o início
            </Link>
          </div>
        )}

        {workout && concluidoHoje && (
          <div className="rounded-2xl border border-done bg-done-bg p-4 text-center">
            <p className="text-2xl">✅</p>
            <p className="mt-1 font-extrabold text-done-ink">Treino concluído!</p>
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
            {busy ? 'Iniciando…' : '▶ Iniciar treino'}
          </Button>
        )}

        {/* espera o rascunho: o card lê o que foi digitado só ao montar (E13) */}
        {rascunhoPronto &&
          isLastPerformanceLoaded &&
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
              lastPerformance={lastPerformanceByWorkoutExerciseId[item.id]}
              isCurrent={item.id === currentExerciseId && Boolean(log)}
              onTimer={(s, label) =>
                s && s > 0 && setTimer({ id: nextTimerId.current++, seconds: s, label })
              }
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
      </div>

      {timer && (
        <RestTimer
          key={timer.id}
          seconds={timer.seconds}
          label={timer.label}
          terminaEm={timer.terminaEm}
          onAlvo={handleTimerAlvo}
          onClose={() => {
            setTimer(null);
            if (log) void salvarTimer(log.id, null);
          }}
        />
      )}

      {celebration && (
        <ChallengeCompletedCelebration
          programReport={celebration.programReport}
          onClose={closeCelebration}
        />
      )}
    </>
  );
}
