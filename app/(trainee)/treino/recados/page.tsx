'use client';

import { useEffect, useState } from 'react';
import type { TrainerNote } from '@/lib/types';
import { notesApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { AppHeader } from '@/components/layout/app-header';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/** E6 — recados do personal. Marca como lido ao abrir a tela. */
export default function RecadosPage() {
  const [items, setItems] = useState<TrainerNote[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    notesApi
      .mine()
      .then(async ({ items }) => {
        setItems(items);
        // marca não lidos como lidos (idempotente; best-effort)
        await Promise.all(
          items.filter((n) => !n.readAt).map((n) => notesApi.markRead(n.id).catch(() => {})),
        );
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Sem conexão'));
  }, []);

  return (
    <>
      <AppHeader eyebrow="Do seu personal" title="Recados" />
      <div className="space-y-3 p-5 pb-28">
        {items === null && !error && <p className="py-10 text-center text-muted2">Carregando…</p>}
        {error && <p className="py-10 text-center text-brand">{error}</p>}
        {items && items.length === 0 && (
          <div className="py-16 text-center text-muted2">
            <p className="text-4xl">📝</p>
            <p className="mt-2 font-semibold">Nenhum recado ainda.</p>
          </div>
        )}
        {items?.map((n) => (
          <div
            key={n.id}
            className={`rounded-2xl border bg-card p-4 ${
              n.readAt ? 'border-line' : 'border-brand'
            }`}
          >
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted2">
              <span>{n.from.name}</span>
              <span>{fmt(n.createdAt)}</span>
            </div>
            <p className="whitespace-pre-wrap text-[15px] font-medium text-ink">{n.text}</p>
          </div>
        ))}
      </div>
    </>
  );
}
