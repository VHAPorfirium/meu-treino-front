'use client';

import { useEffect, useState } from 'react';
import type { HistoryEntry } from '@/lib/types';
import { workoutLogsApi } from '@/lib/api/endpoints';
import { PageHead } from '@/components/dashboard/page-head';

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });
}

export default function AdminHistoricoPage() {
  const [rows, setRows] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workoutLogsApi
      .history()
      .then(setRows)
      .catch(() => setError('Não foi possível carregar o histórico.'));
  }, []);

  return (
    <>
      <PageHead eyebrow="Acompanhamento" title="Todas as sessões" />
      <div className="mx-auto max-w-5xl p-6 md:p-8">
        {error && <p className="text-brand">{error}</p>}
        {!rows && !error && <p className="text-muted2">Carregando…</p>}

        {rows && (
          <div className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="grid grid-cols-[90px_1fr_70px_70px_70px_90px] gap-2 bg-tableHead px-4 py-3 text-[11px] font-extrabold uppercase tracking-wide text-muted2">
              <div>Data</div>
              <div>Treino</div>
              <div className="text-center">Feitos</div>
              <div className="text-center">Pulados</div>
              <div className="text-center">Trocados</div>
              <div className="text-right">Status</div>
            </div>

            {rows.length === 0 && (
              <p className="px-4 py-10 text-center text-muted2">
                Nenhuma sessão registrada ainda.
              </p>
            )}

            {rows.map((r) => {
              const done = r.exerciseLogs.filter((x) => x.status === 'DONE').length;
              const skip = r.exerciseLogs.filter((x) => x.status === 'SKIPPED').length;
              const swap = r.exerciseLogs.filter((x) => x.status === 'REPLACED').length;
              return (
                <div
                  key={r.id}
                  className="grid grid-cols-[90px_1fr_70px_70px_70px_90px] items-center gap-2 border-t border-line px-4 py-3 text-sm"
                >
                  <div className="font-bold">{fmt(r.date)}</div>
                  <div className="truncate font-bold">{r.workout.name}</div>
                  <div className="text-center font-extrabold text-done">{done}</div>
                  <div className="text-center font-extrabold text-skip">{skip}</div>
                  <div className="text-center font-extrabold text-replace">{swap}</div>
                  <div className="text-right">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                        r.completed ? 'bg-done-bg text-done-ink' : 'bg-chip text-muted'
                      }`}
                    >
                      {r.completed ? 'Concluído' : 'Aberto'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
