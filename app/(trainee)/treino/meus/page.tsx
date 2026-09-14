'use client';

import { useEffect, useState } from 'react';
import type { Workout } from '@/lib/types';
import { workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { AppHeader } from '@/components/layout/app-header';

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

/** E1.1 — treinos direcionados à aluna logada. */
export default function MeusTreinosPage() {
  const [items, setItems] = useState<Workout[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    workoutsApi
      .mine()
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Sem conexão'));
  }, []);

  return (
    <>
      <AppHeader eyebrow="Programação" title="Meus treinos" />
      <div className="space-y-3 p-5 pb-28">
        {items === null && !error && <p className="py-10 text-center text-muted2">Carregando…</p>}
        {error && <p className="py-10 text-center text-brand">{error}</p>}
        {items && items.length === 0 && (
          <div className="py-16 text-center text-muted2">
            <p className="text-4xl">📋</p>
            <p className="mt-2 font-semibold">Nenhum treino atribuído ainda.</p>
          </div>
        )}
        {items?.map((w) => (
          <div key={w.id} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-extrabold">{w.name}</p>
                <p className="mt-0.5 text-[13px] font-semibold text-muted2">
                  {w.dayOfWeek != null ? DAYS[w.dayOfWeek] : 'Sem dia fixo'}
                  {w._count ? ` · ${w._count.exercises} exercícios` : ''}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${
                  w.active ? 'bg-done-bg text-done-ink' : 'bg-chip text-muted'
                }`}
              >
                {w.active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
          </div>
        ))}
        <p className="pt-2 text-center text-xs text-muted2">
          O treino de hoje segue o dia da semana; sem treino marcado, o app sugere um dos ativos.
        </p>
      </div>
    </>
  );
}
