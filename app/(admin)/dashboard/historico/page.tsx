'use client';

import { useEffect, useMemo, useState } from 'react';
import type { HistoryEntry, UserSummary } from '@/lib/types';
import { usersApi, workoutLogsApi } from '@/lib/api/endpoints';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import { buildHistoryCsv, downloadTextFile } from '@/lib/dashboard/history-csv';
import { PageHead } from '@/components/dashboard/page-head';

type PeriodFilter = '7' | '30' | '90' | 'all';
type StatusFilter = 'all' | 'completed' | 'open';

const HISTORY_PAGE_SIZE = 100;

const PERIOD_OPTIONS: { value: PeriodFilter; label: string }[] = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Tudo' },
];

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Status: todos' },
  { value: 'completed', label: 'Concluídos' },
  { value: 'open', label: 'Em andamento' },
];

const SELECT_CLASS_NAME =
  'max-w-full rounded-xl border border-line bg-card px-3 py-2 text-sm font-bold text-ink focus:border-brand focus:outline-none';

function formatDateTime(isoDate: string) {
  const entryDate = new Date(isoDate);
  return `${entryDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · ${entryDate.toLocaleTimeString(
    'pt-BR',
    { hour: '2-digit', minute: '2-digit' },
  )}`;
}

function mergeUniqueEntries(existing: HistoryEntry[], incoming: HistoryEntry[]): HistoryEntry[] {
  const seen = new Set(existing.map((entry) => entry.id));
  const merged = [...existing];
  for (const entry of incoming) {
    if (!seen.has(entry.id)) {
      seen.add(entry.id);
      merged.push(entry);
    }
  }
  return merged;
}

/** Todas as sessões, com filtros por aluno, período e status, paginação e exportação em CSV. */
export default function AdminHistoricoPage() {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[] | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [lastBatchSize, setLastBatchSize] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [registeredTrainees, setRegisteredTrainees] = useState<UserSummary[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [traineeFilter, setTraineeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('30');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    workoutLogsApi
      .historyPage({ limit: HISTORY_PAGE_SIZE, offset: 0 })
      .then(({ items, total }) => {
        setHistoryEntries(items);
        setTotalCount(total);
        setLastBatchSize(items.length);
      })
      .catch(() => setErrorMessage('Não foi possível carregar o histórico.'));
    usersApi.list({ role: 'TRAINEE' }).then(setRegisteredTrainees).catch(() => {});
  }, []);

  const loadedCount = historyEntries?.length ?? 0;
  const hasMore =
    historyEntries !== null &&
    (totalCount !== null ? loadedCount < totalCount : lastBatchSize === HISTORY_PAGE_SIZE);

  async function loadMore() {
    if (loadingMore || !historyEntries) return;
    setLoadingMore(true);
    setErrorMessage(null);
    try {
      const { items, total } = await workoutLogsApi.historyPage({
        limit: HISTORY_PAGE_SIZE,
        offset: historyEntries.length,
      });
      setHistoryEntries((prev) => mergeUniqueEntries(prev ?? [], items));
      if (total !== null) setTotalCount(total);
      setLastBatchSize(items.length);
    } catch {
      setErrorMessage('Não foi possível carregar mais sessões.');
    } finally {
      setLoadingMore(false);
    }
  }

  const trainees = useMemo(() => {
    const traineeById = new Map<string, string>();
    for (const trainee of registeredTrainees) traineeById.set(trainee.id, trainee.name);
    for (const historyEntry of historyEntries ?? []) traineeById.set(historyEntry.user.id, historyEntry.user.name);
    return Array.from(traineeById.entries()).sort((first, second) => first[1].localeCompare(second[1]));
  }, [historyEntries, registeredTrainees]);

  const filteredEntries = (historyEntries ?? []).filter((historyEntry) => {
    if (traineeFilter !== 'all' && historyEntry.user.id !== traineeFilter) return false;
    if (statusFilter === 'completed' && !historyEntry.completed) return false;
    if (statusFilter === 'open' && historyEntry.completed) return false;
    if (periodFilter !== 'all') {
      const periodStart = Date.now() - Number(periodFilter) * 24 * 60 * 60 * 1000;
      if (new Date(historyEntry.date).getTime() < periodStart) return false;
    }
    return true;
  });

  function exportCsv() {
    const todayLabel = new Date().toISOString().slice(0, 10);
    downloadTextFile(buildHistoryCsv(filteredEntries), `sessoes-${todayLabel}.csv`, 'text/csv;charset=utf-8');
  }

  return (
    <>
      <PageHead
        eyebrow="Acompanhamento"
        title="Todas as sessões"
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={filteredEntries.length === 0}
            title={
              hasMore
                ? `Exporta as ${filteredEntries.length} sessões filtradas já carregadas na tela`
                : 'Exportar sessões filtradas em CSV'
            }
            className="rounded-xl bg-chip px-4 py-2.5 text-sm font-extrabold text-ink disabled:opacity-50"
          >
            {hasMore
              ? `⬇ Exportar CSV (${filteredEntries.length} carreg.)`
              : '⬇ Exportar CSV'}
          </button>
        }
      />
      <div className="mx-auto max-w-6xl space-y-3.5 p-4 sm:p-6 md:p-8">
        <div className="flex flex-wrap gap-2">
          <select value={traineeFilter} onChange={(event) => setTraineeFilter(event.target.value)} className={SELECT_CLASS_NAME}>
            <option value="all">Aluno: todos</option>
            {trainees.map(([traineeId, traineeName]) => (
              <option key={traineeId} value={traineeId}>
                {traineeName}
              </option>
            ))}
          </select>
          <select
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
            className={SELECT_CLASS_NAME}
          >
            {PERIOD_OPTIONS.map((periodOption) => (
              <option key={periodOption.value} value={periodOption.value}>
                {periodOption.label}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className={SELECT_CLASS_NAME}
          >
            {STATUS_OPTIONS.map((statusOption) => (
              <option key={statusOption.value} value={statusOption.value}>
                {statusOption.label}
              </option>
            ))}
          </select>
          {historyEntries && (
            <span className="self-center text-xs font-bold text-muted2">
              {filteredEntries.length} sess{filteredEntries.length === 1 ? 'ão' : 'ões'}
              {totalCount !== null && totalCount > loadedCount
                ? ` · ${loadedCount} de ${totalCount} carregadas`
                : ''}
            </span>
          )}
        </div>

        {errorMessage && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-card p-3 text-sm font-semibold text-brand-ink">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="shrink-0 text-xs font-extrabold underline"
            >
              fechar
            </button>
          </div>
        )}
        {!historyEntries && !errorMessage && <p className="text-muted2">Carregando…</p>}

        {historyEntries && (
          <>
            <div className="overflow-x-auto rounded-2xl border border-line bg-card">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-tableHead text-left text-[11px] font-extrabold uppercase tracking-wide text-muted2">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Aluno</th>
                    <th className="px-4 py-3">Treino</th>
                    <th className="px-4 py-3">Programa</th>
                    <th className="px-3 py-3 text-center">Feitos</th>
                    <th className="px-3 py-3 text-center">Pulados</th>
                    <th className="px-3 py-3 text-center">Trocados</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-muted2">
                        {trainees.length === 0 && historyEntries.length === 0
                          ? 'Nenhum aluno vinculado ainda. Vincule alunos na aba Alunos para acompanhar o histórico.'
                          : hasMore
                            ? 'Nenhuma sessão com esses filtros nas páginas carregadas. Clique em "Carregar mais sessões" abaixo para buscar registros mais antigos.'
                            : 'Nenhuma sessão com esses filtros.'}
                      </td>
                    </tr>
                  )}
                  {filteredEntries.map((historyEntry) => {
                    const doneCount = historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'DONE').length;
                    const skippedCount = historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'SKIPPED').length;
                    const replacedCount = historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'REPLACED').length;
                    const workoutProgram = historyEntry.workout.program;
                    return (
                      <tr key={historyEntry.id} className="border-t border-line font-bold">
                        <td className="whitespace-nowrap px-4 py-3">{formatDateTime(historyEntry.date)}</td>
                        <td className="px-4 py-3">{historyEntry.user.name}</td>
                        <td className="px-4 py-3">{historyEntry.workout.name}</td>
                        <td className="px-4 py-3">
                          {workoutProgram ? (
                            <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold ${PROGRAM_TYPE_RULES[workoutProgram.type].badgeClassName}`}>
                              {PROGRAM_TYPE_RULES[workoutProgram.type].icon} {workoutProgram.name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted2">Avulso</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-extrabold text-done">{doneCount}</td>
                        <td className="px-3 py-3 text-center font-extrabold text-skip">{skippedCount}</td>
                        <td className="px-3 py-3 text-center font-extrabold text-replace">{replacedCount}</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-extrabold ${
                              historyEntry.completed ? 'bg-done-bg text-done-ink' : 'bg-skip-bg text-skip'
                            }`}
                          >
                            {historyEntry.completed ? 'Concluído' : 'Em andamento'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {hasMore && (
              <div className="flex justify-center pt-1">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="rounded-xl bg-chip px-5 py-2.5 text-sm font-extrabold text-ink transition active:scale-95 disabled:opacity-50"
                >
                  {loadingMore
                    ? 'Carregando…'
                    : totalCount !== null
                      ? `Carregar mais (${loadedCount}/${totalCount})`
                      : 'Carregar mais sessões'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
