'use client';

import type { AdminOverview } from '@/lib/types';
import {
  formatLatencyMs,
  formatShortBrDay,
  formatUptime,
} from '@/lib/admin/formatters';

export function AdminOverviewTab({
  overview,
  onInspectIp,
}: {
  overview: AdminOverview;
  onInspectIp: (ip: string) => void;
}) {
  const { database, cache, http, academy, security } = overview;
  const completedRatePct =
    academy.sessions.last30Days > 0
      ? Math.round(
          (academy.sessions.completedLast30Days / academy.sessions.last30Days) *
            100,
        )
      : 0;

  const maxDailyLogins = Math.max(
    1,
    ...security.loginDaily7d.map((d) => d.success + d.failure + d.locked),
  );

  return (
    <div className="space-y-5">
      {/* Saúde da infraestrutura */}
      <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
              Saúde da infraestrutura
            </p>
            <h2 className="font-display text-lg font-extrabold text-ink">
              API, PostgreSQL, Cache e Memória em tempo real
            </h2>
          </div>
          <span className="rounded-full bg-chip px-3 py-1 text-[11px] font-extrabold text-muted">
            Node {http.nodeVersion} · Uptime {formatUptime(http.uptimeSeconds)}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfraCard
            label="API HTTP"
            value="● Operacional"
            tone="done"
            detail={`p95 ${formatLatencyMs(http.latencyMs.p95)} · ${http.requests.total} reqs (${http.requests.errorRatePct}% 5xx)`}
          />
          <InfraCard
            label="PostgreSQL"
            value={database.status === 'ok' ? '● Saudável' : '⚠ Degradado'}
            tone={database.status === 'ok' ? 'done' : 'skip'}
            detail={`${formatLatencyMs(database.latencyMs)} · ${database.tableCount} tabelas · ${database.migrationsApplied} mig.`}
          />
          <InfraCard
            label="Cache em memória"
            value={cache.enabled ? `${cache.taxaAcerto}% hit` : 'Desligado'}
            tone={cache.enabled ? 'ink' : 'skip'}
            detail={`${cache.entradas} chaves · ${cache.hits} hits / ${cache.misses} misses`}
          />
          <InfraCard
            label="Memória Node.js"
            value={`${http.memory.heapUsedMb} MB`}
            tone="ink"
            detail={`Heap total ${http.memory.heapTotalMb} MB · RSS ${http.memory.rssMb} MB`}
          />
        </div>
      </section>

      {/* Uso global da academia */}
      <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
        <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
          Operação da academia
        </p>
        <h2 className="mb-3 font-display text-lg font-extrabold text-ink">
          Usuários, vínculos e treinos executados
        </h2>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <MetricTile
            label="Personais ativos"
            value={`${academy.users.activeByRole.PERSONAL}/${academy.users.byRole.PERSONAL}`}
          />
          <MetricTile
            label="Alunos ativos"
            value={`${academy.users.activeByRole.TRAINEE}/${academy.users.byRole.TRAINEE}`}
          />
          <MetricTile
            label="Sem personal"
            value={String(academy.links.traineesWithoutTrainer)}
            tone={academy.links.traineesWithoutTrainer > 0 ? 'skip' : 'done'}
          />
          <MetricTile
            label="Vínculos ativos"
            value={String(academy.links.active)}
            tone="done"
          />
          <MetricTile
            label="Convites pendentes"
            value={String(academy.links.pending)}
            tone={academy.links.pending > 0 ? 'brand' : undefined}
          />
          <MetricTile
            label="Portaria / Admins"
            value={`${academy.users.activeByRole.RECEPTION} / ${academy.users.activeByRole.ADMIN}`}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
              Sessões hoje
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink">
              {academy.sessions.today}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
              Últimos 7 dias
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink">
              {academy.sessions.last7Days}
            </p>
          </div>
          <div className="rounded-xl border border-line bg-paper px-3.5 py-3">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
              Últimos 30 dias
            </p>
            <p className="mt-1 font-display text-2xl font-extrabold text-ink">
              {academy.sessions.last30Days}{' '}
              <span className="text-xs font-bold text-done">
                ({completedRatePct}% concluídos)
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Segurança 24h + Gráfico de logins 7d */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
            Segurança (últimas 24h)
          </p>
          <h2 className="mb-3 font-display text-lg font-extrabold text-ink">
            Autenticação, bloqueios e permissões
          </h2>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <MetricTile
              label="Logins OK"
              value={String(security.last24h.loginSuccess)}
              tone="done"
            />
            <MetricTile
              label="Falhas de login"
              value={String(security.last24h.loginFailure)}
              tone={security.last24h.loginFailure > 0 ? 'skip' : undefined}
            />
            <MetricTile
              label="Bloqueios (lockout)"
              value={String(security.last24h.loginLocked)}
              tone={security.last24h.loginLocked > 0 ? 'brand' : undefined}
            />
            <MetricTile
              label="Negados (403)"
              value={String(security.last24h.authzDenied)}
              tone={security.last24h.authzDenied > 0 ? 'brand' : undefined}
            />
            <MetricTile
              label="Rate limit (429)"
              value={String(security.last24h.rateLimitExceeded)}
              tone={security.last24h.rateLimitExceeded > 0 ? 'skip' : undefined}
            />
            <MetricTile
              label="Trocas de perfil"
              value={String(security.last24h.profileSwitched)}
            />
          </div>

          {security.topSuspiciousIps24h.length > 0 && (
            <div className="mt-4 space-y-2 border-t border-line pt-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
                IPs com eventos de alerta (24h)
              </p>
              {security.topSuspiciousIps24h.map((item) => (
                <div
                  key={item.ip}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2"
                >
                  <span className="min-w-0 select-text break-all font-mono text-xs font-bold text-ink">
                    {item.ip}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-skip-bg px-2 py-0.5 text-[11px] font-extrabold text-skip">
                      {item.count} alerta{item.count > 1 ? 's' : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => onInspectIp(item.ip)}
                      className="text-xs font-extrabold text-brand hover:underline"
                    >
                      Ver logs →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
                Tendência 7 dias
              </p>
              <h2 className="font-display text-lg font-extrabold text-ink">
                Logins: sucesso × falha × bloqueio
              </h2>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-bold text-muted2">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-done" />
                OK
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-skip" />
                Falha
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" />
                Bloqueio
              </span>
            </div>
          </div>

          <div className="flex h-44 items-end justify-between gap-2 pt-4">
            {security.loginDaily7d.map((day) => {
              const total = day.success + day.failure + day.locked;
              const barHeightPct =
                total > 0 ? Math.max(10, Math.round((total / maxDailyLogins) * 100)) : 0;
              const lockedShare = total > 0 ? (day.locked / total) * 100 : 0;
              const failureShare = total > 0 ? (day.failure / total) * 100 : 0;
              const successShare = total > 0 ? (day.success / total) * 100 : 0;
              return (
                <div
                  key={day.day}
                  title={`${formatShortBrDay(day.day)}: ${day.success} OK · ${day.failure} falha · ${day.locked} bloqueio`}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                >
                  <span className="text-[10px] font-extrabold text-muted2">
                    {total > 0 ? total : ''}
                  </span>
                  <div className="flex h-28 w-full max-w-[36px] flex-col justify-end overflow-hidden rounded-lg bg-chip/60">
                    {barHeightPct > 0 && (
                      <div
                        className="flex w-full flex-col justify-end overflow-hidden"
                        style={{ height: `${barHeightPct}%` }}
                      >
                        {lockedShare > 0 && (
                          <div
                            className="w-full bg-brand"
                            style={{ height: `${lockedShare}%`, minHeight: 2 }}
                          />
                        )}
                        {failureShare > 0 && (
                          <div
                            className="w-full bg-skip"
                            style={{ height: `${failureShare}%`, minHeight: 2 }}
                          />
                        )}
                        {successShare > 0 && (
                          <div
                            className="w-full bg-done"
                            style={{ height: `${successShare}%`, minHeight: 2 }}
                          />
                        )}
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-muted2">
                    {formatShortBrDay(day.day)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function InfraCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'done' | 'skip' | 'ink';
}) {
  const toneClass =
    tone === 'done'
      ? 'text-done'
      : tone === 'skip'
        ? 'text-skip'
        : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-paper p-3.5">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
        {label}
      </p>
      <p className={`mt-1 font-display text-lg font-extrabold ${toneClass}`}>
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-muted2">{detail}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
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
    <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
      <p className={`font-display text-xl font-extrabold ${toneClass}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-bold text-muted2">{label}</p>
    </div>
  );
}
