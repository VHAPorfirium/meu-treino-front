'use client';

import { useEffect, useState } from 'react';
import {
  healthApi,
  type HealthCacheSummary,
  type HealthDbSummary,
} from '@/lib/api/endpoints';
import { AccountManagementPanel } from '@/components/accounts/account-management-panel';

export default function PlatformAdminPage() {
  const [dbHealth, setDbHealth] = useState<HealthDbSummary | null>(null);
  const [cacheHealth, setCacheHealth] = useState<HealthCacheSummary | null>(null);

  useEffect(() => {
    healthApi.db().then(setDbHealth).catch(() => {});
    healthApi.cache().then(setCacheHealth).catch(() => {});
  }, []);

  const healthBanner = (
    <section className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-muted2">
            Saúde do sistema
          </p>
          <p className="mt-0.5 text-sm font-extrabold text-ink">
            Banco, migrations e cache em tempo real
          </p>
        </div>
        <span className="rounded-full bg-chip px-3 py-1 text-[11px] font-extrabold text-muted">
          Observabilidade completa (métricas HTTP + AccessLog) na v2.1
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
          <p className="text-[11px] font-bold text-muted2">Banco de dados</p>
          <p
            className={`mt-0.5 text-sm font-extrabold ${
              dbHealth?.status === 'ok'
                ? 'text-done'
                : dbHealth
                  ? 'text-skip'
                  : 'text-muted2'
            }`}
          >
            {dbHealth ? (dbHealth.status === 'ok' ? '● Operacional' : '⚠ Degradado') : 'Verificando…'}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
          <p className="text-[11px] font-bold text-muted2">Tabelas / Migrations</p>
          <p className="mt-0.5 text-sm font-extrabold text-ink">
            {dbHealth
              ? `${dbHealth.tableCount ?? '–'} tabelas · ${dbHealth.migrations?.length ?? '–'} mig.`
              : '–'}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
          <p className="text-[11px] font-bold text-muted2">Cache em memória</p>
          <p className="mt-0.5 text-sm font-extrabold text-ink">
            {cacheHealth
              ? cacheHealth.enabled
                ? `${cacheHealth.taxaAcerto}% hit (${cacheHealth.entradas} chaves)`
                : 'Desligado'
              : '–'}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-paper px-3 py-2.5">
          <p className="text-[11px] font-bold text-muted2">Integridade schema</p>
          <p className="mt-0.5 text-sm font-extrabold text-ink">
            {dbHealth
              ? (dbHealth.missingTables?.length ?? 0) === 0 &&
                (dbHealth.missingColumns?.length ?? 0) === 0
                ? '✔ 100% íntegro'
                : 'Pendências detectadas'
              : '–'}
          </p>
        </div>
      </div>
    </section>
  );

  return <AccountManagementPanel mode="ADMIN" headerExtra={healthBanner} />;
}
