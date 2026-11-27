'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminAccessLogItem } from '@/lib/types';
import { adminApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import {
  ACCESS_EVENT_OPTIONS,
  describeAccessEvent,
  formatLatencyMs,
  resolvePeriodFromIso,
  type EventTone,
} from '@/lib/admin/formatters';

type PeriodKey = '24h' | '7d' | '30d' | 'all';

const PAGE_SIZE = 30;

function eventBadgeClasses(tone: EventTone): string {
  switch (tone) {
    case 'done':
      return 'bg-done-bg text-done';
    case 'brand':
      return 'bg-brand/10 text-brand';
    case 'skip':
      return 'bg-skip-bg text-skip';
    case 'neutral':
      return 'bg-chip text-muted';
  }
}

function formatDateTimeBr(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function AdminAuditLogsTab({
  initialIpFilter = '',
}: {
  initialIpFilter?: string;
}) {
  const [eventFilter, setEventFilter] = useState('');
  const [period, setPeriod] = useState<PeriodKey>('7d');
  const [ipFilter, setIpFilter] = useState(initialIpFilter);
  const [searchFilter, setSearchFilter] = useState('');
  const [appliedIp, setAppliedIp] = useState(initialIpFilter);
  const [appliedSearch, setAppliedSearch] = useState('');
  const [offset, setOffset] = useState(0);

  const [items, setItems] = useState<AdminAccessLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialIpFilter) {
      setIpFilter(initialIpFilter);
      setAppliedIp(initialIpFilter);
      setOffset(0);
    }
  }, [initialIpFilter]);

  const fromIso = resolvePeriodFromIso(period);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await adminApi.accessLogs({
        event: eventFilter || undefined,
        ip: appliedIp || undefined,
        search: appliedSearch || undefined,
        from: fromIso,
        limit: PAGE_SIZE,
        offset,
      });
      setItems(page.items);
      setTotal(page.total);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Não foi possível carregar os logs de auditoria.',
      );
    } finally {
      setLoading(false);
    }
  }, [eventFilter, appliedIp, appliedSearch, fromIso, offset]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  function applyTextFilters() {
    setOffset(0);
    setAppliedIp(ipFilter.trim());
    setAppliedSearch(searchFilter.trim());
  }

  function clearFilters() {
    setEventFilter('');
    setPeriod('7d');
    setIpFilter('');
    setSearchFilter('');
    setAppliedIp('');
    setAppliedSearch('');
    setOffset(0);
  }

  const exportUrl = adminApi.accessLogsExportUrl({
    event: eventFilter || undefined,
    ip: appliedIp || undefined,
    search: appliedSearch || undefined,
    from: fromIso,
  });

  const showingFrom = total === 0 ? 0 : offset + 1;
  const showingTo = Math.min(total, offset + items.length);

  return (
    <div className="space-y-4">
      {/* Filtros e exportação */}
      <section className="space-y-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
              Auditoria persistida (retenção 90 dias)
            </p>
            <h2 className="font-display text-lg font-extrabold text-ink">
              Logs de acesso e eventos de segurança
            </h2>
          </div>

          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-xl bg-inverse px-3.5 py-2 text-xs font-extrabold text-on-inverse transition hover:opacity-90 active:scale-95"
          >
            ⬇ Exportar CSV
          </a>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <select
            aria-label="Filtrar por evento"
            value={eventFilter}
            onChange={(e) => {
              setEventFilter(e.target.value);
              setOffset(0);
            }}
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-ink focus:border-brand focus:outline-none"
          >
            <option value="">Todos os eventos</option>
            {ACCESS_EVENT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value})
              </option>
            ))}
          </select>

          <input
            value={ipFilter}
            onChange={(e) => setIpFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyTextFilters()}
            placeholder="IP exato (ex.: 198.51.100.1)"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
          />

          <input
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyTextFilters()}
            placeholder="Buscar @apelido, rota, motivo, requestId…"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={applyTextFilters}
              className="flex-1 rounded-xl bg-brand px-3 py-2.5 text-xs font-extrabold text-white shadow-brand"
            >
              Filtrar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-line bg-paper px-3 py-2.5 text-xs font-extrabold text-muted hover:text-ink"
            >
              Limpar
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { value: '24h', label: '24h' },
                { value: '7d', label: '7 dias' },
                { value: '30d', label: '30 dias' },
                { value: 'all', label: 'Tudo (90d)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPeriod(opt.value);
                  setOffset(0);
                }}
                className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
                  period === opt.value
                    ? 'bg-brand text-white shadow-brand'
                    : 'bg-chip text-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <p className="text-xs font-bold text-muted2">
            {total > 0
              ? `Mostrando ${showingFrom}–${showingTo} de ${total} registro${total > 1 ? 's' : ''}`
              : '0 registros encontrados'}
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-2xl border border-brand/30 bg-card p-3.5 text-sm font-semibold text-brand">
          {error}
        </p>
      )}

      {loading && (
        <p className="py-10 text-center text-sm font-semibold text-muted2">
          Carregando logs de auditoria…
        </p>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-2xl border border-line bg-card p-8 text-center">
          <p className="text-sm font-bold text-muted2">
            Nenhum evento de auditoria corresponde aos filtros selecionados.
          </p>
        </div>
      )}

      {/* Lista responsiva (cards no mobile, linhas densas no desktop) */}
      {!loading && items.length > 0 && (
        <section className="space-y-2">
          {items.map((log) => {
            const meta = describeAccessEvent(log.event);
            const targetUser = log.user
              ? `${log.user.name} (@${log.user.username})`
              : log.identifierMasked ?? '—';
            const actorLabel = log.actor
              ? `por @${log.actor.username}`
              : null;

            return (
              <article
                key={log.id}
                className="rounded-2xl border border-line bg-card p-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${eventBadgeClasses(
                        meta.tone,
                      )}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs font-extrabold text-ink">
                      {targetUser}
                    </span>
                    {actorLabel && (
                      <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold text-muted">
                        {actorLabel}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-[11px] font-bold text-muted2">
                    {formatDateTimeBr(log.createdAt)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-muted2">
                  <span className="font-mono">IP {log.ip}</span>
                  {log.path && (
                    <span className="font-mono">
                      {log.method ?? ''} {log.path}
                      {log.statusCode ? ` · ${log.statusCode}` : ''}
                    </span>
                  )}
                  {log.reason && (
                    <span className="text-ink">motivo: {log.reason}</span>
                  )}
                  {log.durationMs != null && (
                    <span>{formatLatencyMs(log.durationMs)}</span>
                  )}
                  {log.requestId && (
                    <span className="font-mono text-[10px]">
                      req:{log.requestId.slice(0, 12)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* Paginação */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3">
          <button
            type="button"
            disabled={offset === 0 || loading}
            onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
            className="rounded-xl border border-line bg-paper px-3.5 py-1.5 text-xs font-extrabold text-ink disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="text-xs font-bold text-muted2">
            Página {Math.floor(offset / PAGE_SIZE) + 1} de{' '}
            {Math.max(1, Math.ceil(total / PAGE_SIZE))}
          </span>
          <button
            type="button"
            disabled={offset + PAGE_SIZE >= total || loading}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            className="rounded-xl border border-line bg-paper px-3.5 py-1.5 text-xs font-extrabold text-ink disabled:opacity-40"
          >
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
