'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ProgressSummary } from '@/lib/types';
import { usersApi, workoutLogsApi } from '@/lib/api/endpoints';
import { PageHead } from '@/components/dashboard/page-head';
import { FiltroAluno, useNomeAluno } from '@/components/dashboard/filtro-aluno';
import { BarChart, LineChart } from '@/components/dashboard/charts';

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
}

export default function EvolucaoPage() {
  const [data, setData] = useState<ProgressSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exercise, setExercise] = useState('');
  const [hasTrainees, setHasTrainees] = useState(true);

  // '' = todos os alunos somados
  const [alunoId, setAlunoId] = useState('');
  const nomeAluno = useNomeAluno(alunoId);

  useEffect(() => {
    usersApi
      .list({ role: 'TRAINEE' })
      .then((list) => setHasTrainees(list.length > 0))
      .catch(() => {});
  }, []);

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
      .catch(() => !cancelado && setError('Não foi possível carregar a evolução.'));
    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  const freqBars = useMemo(
    () =>
      (data?.frequency.byWeek ?? []).map((w) => ({
        label: shortDate(w.week),
        value: w.count,
      })),
    [data],
  );

  const loadSeries = useMemo(() => {
    const s = data?.loadProgression.find((l) => l.exercise === exercise);
    return (s?.points ?? []).map((p) => ({
      label: shortDate(p.date),
      value: p.loadUsed,
    }));
  }, [data, exercise]);

  // variação entre a primeira e a última carga do exercício escolhido
  const firstLoad = loadSeries[0]?.value;
  const lastLoad = loadSeries[loadSeries.length - 1]?.value;
  const loadDifference =
    firstLoad != null && lastLoad != null && loadSeries.length > 1 ? lastLoad - firstLoad : null;
  const loadDifferencePercentage =
    loadDifference !== null && firstLoad != null && firstLoad > 0
      ? Math.round((loadDifference / firstLoad) * 100)
      : null;
  const weeklyTarget = Math.round((data?.sessions.target ?? 16) / 4);

  return (
    <>
      <PageHead
        eyebrow="Acompanhamento"
        title={nomeAluno ? `Evolução · ${nomeAluno.split(' ')[0]}` : 'Evolução'}
      />
      <div className="mx-auto max-w-6xl space-y-5 p-4 sm:p-6 md:p-8">
        <FiltroAluno value={alunoId} onChange={setAlunoId} />

        {!hasTrainees && !error && (
          <p className="rounded-2xl border border-line bg-card p-4 text-sm font-semibold text-muted2">
            Nenhum aluno vinculado ainda. Vincule alunos na aba Alunos para acompanhar a frequência e progressão de carga.
          </p>
        )}

        {error && <p className="text-brand-ink">{error}</p>}
        {!data && !error && <p className="text-muted2">Carregando…</p>}

        {data && (
          <>
            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <Panel
                title="Frequência por semana"
                action={<span className="text-xs font-bold text-muted2">meta: {weeklyTarget}/semana</span>}
              >
                <BarChart data={freqBars} />
              </Panel>

              <Panel
                title="Progressão de carga"
                action={
                  data.loadProgression.length > 0 && (
                    <select
                      value={exercise}
                      onChange={(e) => setExercise(e.target.value)}
                      className="max-w-full truncate rounded-full bg-chip px-3 py-1.5 text-xs font-bold capitalize text-muted sm:max-w-[55%]"
                    >
                      {data.loadProgression.map((l) => (
                        <option key={l.exercise} value={l.exercise}>
                          {l.exercise}
                        </option>
                      ))}
                    </select>
                  )
                }
              >
                <LineChart points={loadSeries} />
                {loadDifference !== null && (
                  <p className={`mt-3 text-sm font-extrabold ${loadDifference >= 0 ? 'text-done' : 'text-skip'}`}>
                    {loadDifference >= 0 ? '▲' : '▼'} {loadDifference >= 0 ? '+' : ''}
                    {loadDifference.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} kg
                    {loadDifferencePercentage !== null ? ` (${loadDifferencePercentage >= 0 ? '+' : ''}${loadDifferencePercentage}%)` : ''}{' '}
                    no período
                  </p>
                )}
              </Panel>
            </div>

            <div className="grid min-w-0 gap-5 lg:grid-cols-2">
              <Panel title="Mais trocados">
                {data.mostReplaced.length === 0 ? (
                  <p className="text-sm text-muted2">Nenhuma troca registrada.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.mostReplaced.map((r, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate capitalize font-semibold">
                          {r.from} <span className="text-replace">→</span> {r.to}
                        </span>
                        <span className="shrink-0 font-extrabold text-replace">
                          {r.count}×
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel title="Mais pulados">
                {data.mostSkipped.length === 0 ? (
                  <p className="text-sm text-muted2">Nenhum exercício pulado.</p>
                ) : (
                  <div className="space-y-2.5">
                    {data.mostSkipped.map((s) => (
                      <div
                        key={s.exercise}
                        className="flex items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 flex-1 truncate capitalize font-semibold">
                          {s.exercise}
                        </span>
                        <span className="shrink-0 font-extrabold text-skip">{s.count}×</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-card p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-extrabold">{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}
