'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProgressPhoto } from '@/lib/types';
import { photosApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { AppHeader } from '@/components/layout/app-header';

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

const ALLOWED = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

/**
 * E6 — fotos de progresso. Upload DIRETO pro Supabase com URL assinada
 * (a foto não passa pela API); depois registra o caminho.
 */
export default function FotosPage() {
  const [items, setItems] = useState<ProgressPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = () =>
    photosApi
      .mine()
      .then(setItems)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Sem conexão'));

  useEffect(() => {
    void load();
  }, []);

  async function upload(file: File) {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED.includes(ext)) {
      setError('Formato não suportado (use jpg, png, webp ou heic).');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Foto muito grande (máx. 15 MB).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { path, uploadUrl } = await photosApi.requestUpload(ext);
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!put.ok) throw new Error(`upload falhou (${put.status})`);
      await photosApi.register({ path, note: note.trim() || undefined });
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message ?? 'Falha no upload');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function remove(p: ProgressPhoto) {
    if (!confirm('Apagar esta foto?')) return;
    try {
      await photosApi.remove(p.id);
      setItems((it) => it?.filter((x) => x.id !== p.id) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível apagar');
    }
  }

  return (
    <>
      <AppHeader eyebrow="Evolução" title="Fotos de progresso" />
      <div className="space-y-3 p-5 pb-28">
        <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Observação (opcional) — ex: 12 semanas"
            className="w-full rounded-xl border border-line2 bg-white px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-faint"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="w-full rounded-xl bg-brand py-3 text-sm font-extrabold text-white shadow-brand disabled:opacity-50"
          >
            {busy ? 'Enviando…' : '📷 Adicionar foto'}
          </button>
          <p className="text-center text-[11px] text-muted2">
            Suas fotos ficam privadas — só você e seu personal veem.
          </p>
        </div>

        {error && (
          <p className="rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold text-brand">
            {error}
          </p>
        )}
        {items === null && !error && <p className="py-6 text-center text-muted2">Carregando…</p>}
        {items && items.length === 0 && (
          <p className="py-10 text-center text-muted2">Nenhuma foto ainda.</p>
        )}

        <div className="grid grid-cols-2 gap-3">
          {items?.map((p) => (
            <figure key={p.id} className="overflow-hidden rounded-2xl border border-line bg-card">
              {p.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.url} alt={p.note ?? 'Foto de progresso'} className="aspect-[3/4] w-full object-cover" />
              ) : (
                <div className="aspect-[3/4] w-full bg-chip" />
              )}
              <figcaption className="flex items-start justify-between gap-2 p-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold">{fmt(p.takenAt)}</p>
                  {p.note && <p className="truncate text-[11px] text-muted2">{p.note}</p>}
                </div>
                <button
                  onClick={() => remove(p)}
                  aria-label="Apagar foto"
                  className="shrink-0 text-xs font-bold text-brand"
                >
                  ✕
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </>
  );
}
