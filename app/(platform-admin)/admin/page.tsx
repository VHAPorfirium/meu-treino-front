'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminOverview } from '@/lib/types';
import { adminApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/auth-context';
import { applyThemePreference, readInitialIsDark } from '@/lib/theme';
import { AdminOverviewTab } from '@/components/admin/admin-overview-tab';
import { AdminPerformanceTab } from '@/components/admin/admin-performance-tab';
import { AdminAuditLogsTab } from '@/components/admin/admin-audit-logs-tab';
import { AccountManagementPanel } from '@/components/accounts/account-management-panel';

type AdminTab = 'overview' | 'performance' | 'audit' | 'accounts';

const TABS: { value: AdminTab; label: string; icon: string }[] = [
  { value: 'overview', label: 'Visão Geral', icon: '📊' },
  { value: 'performance', label: 'Performance', icon: '⚡' },
  { value: 'audit', label: 'Auditoria', icon: '🛡️' },
  { value: 'accounts', label: 'Contas & Equipe', icon: '👥' },
];

export default function PlatformAdminPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [windowMinutes, setWindowMinutes] = useState(1440);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [auditIpFilter, setAuditIpFilter] = useState('');
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(readInitialIsDark());
  }, []);

  const fetchOverview = useCallback(
    async (silent = false) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const data = await adminApi.overview(windowMinutes);
        setOverview(data);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Não foi possível carregar os indicadores de observabilidade.',
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [windowMinutes],
  );

  useEffect(() => {
    void fetchOverview(false);
  }, [fetchOverview]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void fetchOverview(true);
    }, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchOverview]);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    applyThemePreference(next);
  }

  function handleInspectIp(ip: string) {
    setAuditIpFilter(ip);
    setActiveTab('audit');
  }

  const lastUpdatedLabel = overview
    ? new Date(overview.generatedAt).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-sand">
      {/* Barra superior com safe-top para iOS PWA / Dynamic Island */}
      <header className="safe-top sticky top-0 z-30 border-b border-white/10 bg-inverse pb-3.5 text-on-inverse shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-display text-lg font-extrabold tracking-[0.18em] text-brand">
              RITMO
            </span>
            <span className="hidden rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-extrabold text-on-inverse sm:inline-block">
              🛡️ Administração
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {overview?.externalGrafanaUrl && (
              <a
                href={overview.externalGrafanaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-xs font-extrabold text-on-inverse transition hover:bg-white/15 sm:inline-block"
              >
                Grafana ↗
              </a>
            )}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm transition hover:bg-white/15 active:scale-90"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
            <div className="hidden text-right sm:block">
              <p className="text-xs font-extrabold leading-tight">{user?.name}</p>
              <p className="text-[11px] text-on-inverse-muted">@{user?.username}</p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="shrink-0 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-bold text-on-inverse transition hover:bg-white/15 active:scale-95"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Cabeçalho e navegação em abas */}
      <div className="border-b border-line bg-paper">
        <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6 sm:pt-6 md:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-muted2">
                Observabilidade, performance, auditoria e equipe
              </p>
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-tight sm:text-[32px]">
                Painel Administrativo
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {lastUpdatedLabel && (
                <span className="text-xs font-bold text-muted2">
                  Atualizado às {lastUpdatedLabel}
                </span>
              )}
              <button
                type="button"
                onClick={() => setAutoRefresh((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-xs font-extrabold transition ${
                  autoRefresh
                    ? 'border-done bg-done-bg text-done'
                    : 'border-line bg-card text-muted hover:text-ink'
                }`}
              >
                {autoRefresh ? '● Auto 30s' : 'Auto 30s'}
              </button>
              <button
                type="button"
                disabled={refreshing}
                onClick={() => void fetchOverview(true)}
                className="rounded-xl bg-brand px-3.5 py-2 text-xs font-extrabold text-white shadow-brand transition active:scale-95 disabled:opacity-60"
              >
                {refreshing ? 'Atualizando…' : '↻ Atualizar'}
              </button>
            </div>
          </div>

          <nav
            aria-label="Seções do painel administrativo"
            className="no-scrollbar -mb-px flex gap-5 overflow-x-auto"
          >
            {TABS.map((tab) => {
              const selected = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`flex shrink-0 items-center gap-1.5 border-b-[2.5px] py-3 text-sm font-extrabold transition ${
                    selected
                      ? 'border-brand text-ink'
                      : 'border-transparent text-muted2 hover:text-ink'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Conteúdo */}
      <main className="mx-auto max-w-6xl space-y-5 p-4 pb-16 sm:p-6 md:p-8">
        {error && activeTab !== 'accounts' && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-brand/30 bg-card p-3.5 text-sm font-semibold text-brand">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void fetchOverview(false)}
              className="shrink-0 text-xs font-extrabold underline"
            >
              tentar novamente
            </button>
          </div>
        )}

        {(activeTab === 'overview' || activeTab === 'performance') &&
          loading &&
          !overview && (
            <p className="py-12 text-center text-sm font-semibold text-muted2">
              Carregando telemetria do sistema…
            </p>
          )}

        {activeTab === 'overview' && overview && (
          <AdminOverviewTab overview={overview} onInspectIp={handleInspectIp} />
        )}

        {activeTab === 'performance' && overview && (
          <AdminPerformanceTab
            http={overview.http}
            windowMinutes={windowMinutes}
            onChangeWindow={(mins) => setWindowMinutes(mins)}
          />
        )}

        {activeTab === 'audit' && (
          <AdminAuditLogsTab initialIpFilter={auditIpFilter} />
        )}

        {activeTab === 'accounts' && (
          <AccountManagementPanel mode="ADMIN" embedded />
        )}
      </main>
    </div>
  );
}
