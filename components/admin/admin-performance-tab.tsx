'use client';

import { useEffect, useState } from 'react';
import type { HttpMetricsSnapshot, RouteMetricSummary } from '@/lib/types';
import { formatLatencyMs } from '@/lib/admin/formatters';

const WINDOW_CHOICES: { value: number; label: string }[] = [
  { value: 60, label: 'Última 1h' },
  { value: 360, label: '6 horas' },
  { value: 1440, label: '24 horas' },
];

function timelineEyebrow(windowMinutes: number): string {
  if (windowMinutes <= 60) return 'Volume a cada 5 min (última 1h)';
  if (windowMinutes <= 360) return 'Volume a cada 30 min (últimas 6h)';
  return 'Volume por hora (últimas 24h)';
}

export function AdminPerformanceTab({
  http,
  windowMinutes,
  refreshing = false,
  onChangeWindow,
}: {
  http: HttpMetricsSnapshot;
  windowMinutes: number;
  refreshing?: boolean;
  onChangeWindow: (minutes: number) => void;
}) {
  const [selectedBucketIdx, setSelectedBucketIdx] = useState<number | null>(null);

  useEffect(() => {
    setSelectedBucketIdx(null);
  }, [windowMinutes, http.timeline.length]);

  const { requests, latencyMs, timeline, topRoutes, slowestRoutes } = http;
  const totalStatus = Math.max(1, requests.total);
  const pct2xx = Math.round((requests.status2xx / totalStatus) * 100);
  const pct3xx = Math.round((requests.status3xx / totalStatus) * 100);
  const pct4xx = Math.round((requests.status4xx / totalStatus) * 100);
  const pct5xx = Math.round((requests.status5xx / totalStatus) * 100);

  const maxHourTotal = Math.max(1, ...timeline.map((b) => b.total));
  const selectedBucket =
    selectedBucketIdx !== null ? (timeline[selectedBucketIdx] ?? null) : null;
  const labelStride = timeline.length <= 12 ? 2 : 3;

  return (
    <div className={`space-y-5 transition-opacity ${refreshing ? 'opacity-70' : ''}`}>
      {/* Seletor de janela + cards de latência */}
      <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
              Performance HTTP {refreshing ? '· atualizando…' : ''}
            </p>
            <h2 className="font-display text-lg font-extrabold text-ink">
              Latência (p50 / p95 / p99) e taxa de erros
            </h2>
          </div>
          <div className="flex gap-1.5">
            {WINDOW_CHOICES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChangeWindow(opt.value)}
                className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition ${
                  windowMinutes === opt.value
                    ? 'bg-inverse text-on-inverse'
                    : 'bg-chip text-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <LatencyCard label="Latência p50" value={formatLatencyMs(latencyMs.p50)} />
          <LatencyCard
            label="Latência p95"
            value={formatLatencyMs(latencyMs.p95)}
            tone={latencyMs.p95 >= 800 ? 'brand' : latencyMs.p95 >= 350 ? 'skip' : 'done'}
          />
          <LatencyCard
            label="Latência p99"
            value={formatLatencyMs(latencyMs.p99)}
            tone={latencyMs.p99 >= 1000 ? 'brand' : undefined}
          />
          <LatencyCard
            label="Média / Máx"
            value={formatLatencyMs(latencyMs.avg)}
            sub={`máx ${formatLatencyMs(latencyMs.max)}`}
          />
          <LatencyCard
            label="Requisições"
            value={String(requests.total)}
            sub={`${requests.perMinute} req/min · total ${requests.lifetimeTotal}`}
          />
        </div>

        {/* Barra proporcional de status HTTP */}
        <div className="mt-4 rounded-xl border border-line bg-paper p-3.5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
            <span className="text-ink">Distribuição de respostas HTTP</span>
            <span className="text-muted2">
              Erro 5xx:{' '}
              <strong className={requests.status5xx > 0 ? 'text-brand' : 'text-done'}>
                {requests.errorRatePct}%
              </strong>{' '}
              · Cliente 4xx: <strong className="text-skip">{requests.clientErrorRatePct}%</strong>
            </span>
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-chip">
            {pct2xx > 0 && <div className="bg-done" style={{ width: `${pct2xx}%` }} />}
            {pct3xx > 0 && <div className="bg-muted2" style={{ width: `${pct3xx}%` }} />}
            {pct4xx > 0 && <div className="bg-skip" style={{ width: `${pct4xx}%` }} />}
            {pct5xx > 0 && <div className="bg-brand" style={{ width: `${pct5xx}%` }} />}
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[11px] font-bold text-muted2">
            <span>2xx: {requests.status2xx}</span>
            <span>3xx: {requests.status3xx}</span>
            <span>4xx: {requests.status4xx}</span>
            <span>5xx: {requests.status5xx}</span>
          </div>
        </div>
      </section>

      {/* Timeline adaptativa (1h / 6h / 24h) */}
      <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
              {timelineEyebrow(windowMinutes)}
            </p>
            <h2 className="font-display text-lg font-extrabold text-ink">
              Tráfego da API e picos de erro
            </h2>
          </div>
          <span className="text-xs font-semibold text-muted2">
            Toque em uma barra para ver detalhes e p95
          </span>
        </div>

        <div className="no-scrollbar overflow-x-auto pb-1">
          <div className="flex h-36 min-w-[440px] items-end gap-1.5 pt-2">
            {timeline.map((bucket, idx) => {
              const heightPct =
                bucket.total > 0
                  ? Math.max(8, Math.round((bucket.total / maxHourTotal) * 100))
                  : 4;
              const barColor =
                bucket.errors5xx > 0
                  ? 'bg-brand'
                  : bucket.errors4xx > 0
                    ? 'bg-skip'
                    : bucket.total > 0
                      ? 'bg-done'
                      : 'bg-chip';
              const isSelected = selectedBucketIdx === idx;
              return (
                <button
                  key={`${bucket.hour}-${idx}`}
                  type="button"
                  onClick={() =>
                    setSelectedBucketIdx((prev) => (prev === idx ? null : idx))
                  }
                  aria-pressed={isSelected}
                  title={`${bucket.hour} — ${bucket.total} reqs · 4xx: ${bucket.errors4xx} · 5xx: ${bucket.errors5xx} · p95: ${formatLatencyMs(bucket.p95Ms)}`}
                  className={`flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-lg px-0.5 py-0.5 transition focus:outline-none ${
                    isSelected ? 'bg-chip/80 ring-1 ring-brand' : 'hover:bg-chip/40'
                  }`}
                >
                  <div className="flex h-24 w-full items-end">
                    <div
                      className={`w-full rounded-t-md transition ${barColor}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-muted2">
                    {idx % labelStride === 0 || idx === timeline.length - 1
                      ? bucket.hour
                      : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {selectedBucket && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3.5 py-2 text-xs font-bold">
            <span className="font-mono text-ink">{selectedBucket.hour}</span>
            <div className="flex flex-wrap items-center gap-3 text-muted2">
              <span>
                <strong className="text-ink">{selectedBucket.total}</strong> reqs
              </span>
              <span>
                p95 <strong className="text-ink">{formatLatencyMs(selectedBucket.p95Ms)}</strong>
              </span>
              <span className={selectedBucket.errors4xx > 0 ? 'text-skip' : ''}>
                4xx: {selectedBucket.errors4xx}
              </span>
              <span className={selectedBucket.errors5xx > 0 ? 'text-brand' : ''}>
                5xx: {selectedBucket.errors5xx}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Tabelas de rotas */}
      <div className="grid gap-4 lg:grid-cols-2">
        <RouteTable
          eyebrow="Gargalos"
          title="Rotas mais lentas (p95)"
          routes={slowestRoutes}
        />
        <RouteTable
          eyebrow="Volume"
          title="Rotas mais acessadas"
          routes={topRoutes}
        />
      </div>
    </div>
  );
}

function LatencyCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'done' | 'skip' | 'brand';
}) {
  const toneClass =
    tone === 'done'
      ? 'text-done'
      : tone === 'skip'
        ? 'text-skip'
        : tone === 'brand'
          ? 'text-brand'
          : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-paper p-3.5">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl font-extrabold ${toneClass}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[11px] font-semibold text-muted2">{sub}</p>}
    </div>
  );
}

function RouteTable({
  eyebrow,
  title,
  routes,
}: {
  eyebrow: string;
  title: string;
  routes: RouteMetricSummary[];
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
      <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
        {eyebrow}
      </p>
      <h3 className="mb-3 font-display text-base font-extrabold text-ink">{title}</h3>

      {routes.length === 0 ? (
        <p className="py-6 text-center text-sm font-semibold text-muted2">
          Nenhuma requisição registrada nesta janela ainda.
        </p>
      ) : (
        <div className="space-y-2">
          {routes.map((r) => (
            <div
              key={`${r.method}-${r.route}`}
              className="rounded-xl border border-line bg-paper px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 rounded-md bg-chip px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-ink">
                    {r.method}
                  </span>
                  <span className="truncate font-mono text-xs font-bold text-ink">
                    {r.route}
                  </span>
                </div>
                <span
                  className={`shrink-0 text-xs font-extrabold ${
                    r.p95Ms >= 800
                      ? 'text-brand'
                      : r.p95Ms >= 350
                        ? 'text-skip'
                        : 'text-done'
                  }`}
                >
                  p95 {formatLatencyMs(r.p95Ms)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap gap-3 text-[11px] font-semibold text-muted2">
                <span>{r.count} reqs</span>
                <span>p50 {formatLatencyMs(r.p50Ms)}</span>
                <span>p99 {formatLatencyMs(r.p99Ms)}</span>
                {r.errorCount > 0 && (
                  <span className="font-extrabold text-brand">
                    {r.errorCount} erro{r.errorCount > 1 ? 's' : ''} ({r.errorRatePct}%)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
