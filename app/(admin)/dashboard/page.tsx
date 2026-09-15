'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { ProgressSummary } from '@/lib/types';
import { workoutLogsApi } from '@/lib/api/endpoints';
import { PageHead } from '@/components/dashboard/page-head';
import { FiltroAluno, useNomeAluno } from '@/components/dashboard/filtro-aluno';

export default function DashboardHome() {
  const [data, setData] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exercise, setExercise] = useState('');

  // '' = todos os alunos juntos (agregado)
  const [alunoId, setAlunoId] = useState('');
  const nomeAluno = useNomeAluno(alunoId);

  useEffect(() => {
    let cancelado = false;
    setData(null);
    setError(null);
    workoutLogsApi
      .progress(alunoId || undefined)
      .then((d) => {
        if (cancelado) return;
        setData(d);
        // o catálogo de exercícios muda por aluno — reancora a seleção do gráfico
        setExercise(d.loadProgression?.[0]?.exercise ?? '');
      })
      .catch(() => !cancelado && setError('Não foi possível carregar o resumo.'));
    return () => {
      cancelado = true;
    };
  }, [alunoId]);



  // valores seguros (não quebra se a API vier num formato antigo/parcial)
  const sessions = data?.sessions ?? { last30days: 0, delta: 0, target: 16 };
  const adherence = data?.adherence ?? {
    pct: 0,
    deltaPp: 0,
    completedExercises: 0,
    totalExercises: 0,
  };
  const streak = data?.streak ?? { current: 0, best: 0 };
  const cargaTotal = data?.cargaTotal ?? { current: 0, deltaPct: 0 };
  const cardio = data?.cardio ?? { minutes: 0, deltaPct: 0 };
  const heatmap = data?.heatmap ?? [];
  const ranking = data?.ranking ?? [];
  const recentNotes = data?.recentNotes ?? [];
  const loadProgression = data?.loadProgression ?? [];

  const perWeek = useMemo(() => {
    const w = data?.frequency?.byWeek ?? [];
    if (!w.length) return '0';
    return (w.reduce((a, x) => a + x.count, 0) / w.length).toFixed(1);
  }, [data]);

  const loadPoints = useMemo(() => {
    const s = loadProgression.find((l) => l.exercise === exercise);
    return (s?.points ?? []).map((p, i) => ({ label: `S${i + 1}`, kg: p.loadUsed }));
  }, [loadProgression, exercise]);

  return (
    <>
      <PageHead
        eyebrow="Acompanhamento"
        title={
          nomeAluno ? `Evolução · ${nomeAluno.split(' ')[0]}` : 'Evolução dos alunos'
        }
        actions={
          <Link
            href="/dashboard/treinos"
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand"
          >
            + Novo treino
          </Link>
        }
      />

      <div className="mx-auto max-w-6xl space-y-5 p-6 md:p-8">
        {/* filtro por aluno — '' mostra todo mundo somado */}
        <FiltroAluno value={alunoId} onChange={setAlunoId} />

        {error && <p className="text-brand">{error}</p>}
        {!data && !error && <p className="text-muted2">Carregando…</p>}

        {data && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard
                label="Frequência 30d"
                value={sessions.last30days}
                delta={sessions.delta}
                hint={`sessões · meta ${sessions.target}`}
              />
              <StatCard
                label="Aderência"
                value={`${adherence.pct}%`}
                delta={adherence.deltaPp}
                deltaSuffix="pp"
                hint="exercícios concluídos"
              />
              <StatCard
                label="Sequência"
                value={`${streak.current}`}
                unit="dias"
                hint={`melhor: ${streak.best} dias`}
              />
              <StatCard
                label="Carga total"
                value={`${cargaTotal.deltaPct >= 0 ? '+' : ''}${cargaTotal.deltaPct}%`}
                hint={`volume · ${cargaTotal.current} kg (30d)`}
              />
              {/* E10 — cardio não tem carga, então some do volume. Métrica própria. */}
              <StatCard
                label="Cardio 30d"
                value={cardio.minutes}
                unit="min"
                delta={cardio.deltaPct}
                deltaSuffix="%"
                hint="exercícios por tempo"
              />
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div className="rounded-2xl border border-line bg-card p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-base font-extrabold">
                      Frequência · últimos 30 dias
                    </h2>
                    <span className="text-xs font-bold text-muted2">
                      {data.frequency?.last30days ?? 0} sessões · {perWeek}/sem
                    </span>
                  </div>
                  <Heatmap cells={heatmap} />
                  <Legend />
                </div>

                <div className="rounded-2xl border border-line bg-card p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="text-base font-extrabold">
                        Progressão de carga
                      </h2>
                      <p className="text-xs text-muted2">kg por sessão</p>
                    </div>
                    <div className="no-scrollbar flex gap-2 overflow-x-auto">
                      {loadProgression.slice(0, 4).map((l) => (
                        <button
                          key={l.exercise}
                          onClick={() => setExercise(l.exercise)}
                          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize ${
                            exercise === l.exercise
                              ? 'bg-ink text-white'
                              : 'bg-chip text-muted'
                          }`}
                        >
                          {l.exercise}
                        </button>
                      ))}
                    </div>
                  </div>
                  <LoadBars points={loadPoints} />
                </div>
              </div>

              <div className="space-y-5">
                <div className="rounded-2xl border border-line bg-card p-5">
                  <h2 className="mb-4 text-base font-extrabold">
                    Mais pulados e trocados
                  </h2>
                  {ranking.length === 0 ? (
                    <p className="text-sm text-muted2">Nada registrado ainda.</p>
                  ) : (
                    <div className="space-y-3.5">
                      {ranking.map((r, i) => {
                        const max = ranking[0].count || 1;
                        const fg = r.type === 'skip' ? 'text-skip' : 'text-replace';
                        const bar = r.type === 'skip' ? 'bg-skip' : 'bg-replace';
                        return (
                          <div key={i} className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 text-sm">
                              <span className="truncate font-semibold capitalize">
                                {r.name}
                              </span>
                              <span className={`shrink-0 text-xs font-extrabold ${fg}`}>
                                {r.count}× {r.type === 'skip' ? 'pulado' : 'trocado'}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-chip">
                              <div
                                className={`h-full rounded-full ${bar}`}
                                style={{ width: `${(r.count / max) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-line bg-card p-5">
                  <h2 className="mb-4 text-base font-extrabold">
                    Observações recentes
                  </h2>
                  {recentNotes.length === 0 ? (
                    <p className="text-sm text-muted2">Nenhuma observação ainda.</p>
                  ) : (
                    <div className="space-y-3">
                      {recentNotes.map((n, i) => (
                        <div key={i} className="border-l-[3px] border-skip pl-3">
                          <p className="text-sm font-semibold leading-snug text-ink2">
                            “{n.text}”
                          </p>
                          <p className="mt-1 text-xs capitalize text-muted2">
                            {n.exercise} ·{' '}
                            {new Date(n.date).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  unit,
  delta,
  deltaSuffix = '',
  hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: number;
  deltaSuffix?: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
        {label}
      </p>
      <div className="mt-1.5 flex items-baseline gap-2">
        <span className="font-display text-[34px] font-extrabold leading-none">
          {value}
        </span>
        {unit && <span className="text-sm font-bold text-muted2">{unit}</span>}
        {delta !== undefined && delta !== 0 && (
          <span
            className={`text-[13px] font-extrabold ${delta > 0 ? 'text-done' : 'text-skip'}`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
            {deltaSuffix}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted2">{hint}</p>
    </div>
  );
}

function Heatmap({ cells }: { cells: { date: string; level: number }[] }) {
  const color = (lvl: number) =>
    lvl >= 3 ? 'bg-done' : lvl === 2 ? 'bg-skip' : 'bg-chip';
  if (cells.length === 0)
    return (
      <p className="py-6 text-center text-sm text-muted2">
        Sem sessões nos últimos 30 dias.
      </p>
    );
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: 'repeat(15, minmax(0, 1fr))' }}
    >
      {cells.map((c) => (
        <div
          key={c.date}
          title={c.date}
          className={`h-6 rounded-md ${color(c.level)}`}
        />
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex items-center gap-4 text-[11px] font-semibold text-muted2">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-done" /> treino completo
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-skip" /> em aberto
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-chip" /> sem treino
      </span>
    </div>
  );
}

function LoadBars({ points }: { points: { label: string; kg: number }[] }) {
  if (points.length === 0)
    return (
      <p className="py-10 text-center text-sm text-muted2">
        Sem carga registrada ainda.
      </p>
    );
  const max = Math.max(...points.map((p) => p.kg), 1);
  return (
    <div className="flex h-44 items-end gap-2">
      {points.map((p, i) => {
        const last = i === points.length - 1;
        return (
          <div
            key={i}
            className="flex flex-1 flex-col items-center justify-end gap-1.5"
          >
            <span className="font-display text-xs font-extrabold">{p.kg}</span>
            <div
              className={`w-full rounded-t-lg ${last ? 'bg-brand' : 'bg-ink'}`}
              style={{ height: `${(p.kg / max) * 100}%`, minHeight: 4 }}
            />
            <span className="text-[10px] font-bold text-muted2">{p.label}</span>
          </div>
        );
      })}
    </div>
  );
}
