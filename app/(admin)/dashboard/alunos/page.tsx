'use client';

import { useEffect, useState } from 'react';
import type { ProgressPhoto, TrainerNote, UserSummary } from '@/lib/types';
import { notesApi, photosApi, usersApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHead } from '@/components/dashboard/page-head';

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

function msg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

/** E6 — por aluno: enviar recados e ver fotos de progresso. */
export default function AlunosPage() {
  const [trainees, setTrainees] = useState<UserSummary[]>([]);
  const [selected, setSelected] = useState<UserSummary | null>(null);
  const [notes, setNotes] = useState<TrainerNote[]>([]);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'recados' | 'fotos'>('recados');

  useEffect(() => {
    usersApi
      .list({ role: 'TRAINEE' })
      .then((list) => {
        setTrainees(list);
        if (list[0]) setSelected(list[0]);
      })
      .catch((e) => setError(msg(e, 'Não foi possível carregar alunos')));
  }, []);

  useEffect(() => {
    if (!selected) return;
    setError(null);
    Promise.all([notesApi.forUser(selected.id), photosApi.ofUser(selected.id)])
      .then(([n, p]) => {
        setNotes(n);
        setPhotos(p);
      })
      .catch((e) => setError(msg(e, 'Não foi possível carregar dados do aluno')));
  }, [selected]);

  async function send() {
    if (!selected || !text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const n = await notesApi.send(selected.id, text.trim());
      setNotes((ns) => [n, ...ns]);
      setText('');
    } catch (e) {
      setError(msg(e, 'Não foi possível enviar'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead eyebrow="Acompanhamento" title="Alunos" />
      <div className="mx-auto max-w-4xl space-y-4 p-6 md:p-8">
        {error && (
          <p className="rounded-2xl border border-line bg-card p-3 text-sm font-semibold text-brand">{error}</p>
        )}

        {/* seletor de aluno */}
        <div className="flex flex-wrap gap-2">
          {trainees.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelected(t)}
              className={`rounded-full px-4 py-2 text-sm font-extrabold ${
                selected?.id === t.id ? 'bg-ink text-white' : 'bg-chip text-muted'
              }`}
            >
              {t.name}
            </button>
          ))}
          {trainees.length === 0 && <p className="text-sm text-muted2">Nenhum aluno cadastrado.</p>}
        </div>

        {selected && (
          <>
            <div className="flex gap-2 border-b border-line">
              {(['recados', 'fotos'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-extrabold capitalize ${
                    tab === t ? 'border-brand text-ink' : 'border-transparent text-muted2'
                  }`}
                >
                  {t === 'recados' ? `Recados (${notes.length})` : `Fotos (${photos.length})`}
                </button>
              ))}
            </div>

            {tab === 'recados' && (
              <div className="space-y-3">
                <div className="space-y-2 rounded-2xl border border-line bg-card p-4">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    placeholder={`Recado pra ${selected.name.split(' ')[0]}… (ex: "Semana que vem sobe a carga do agachamento")`}
                    className="w-full rounded-xl border border-line2 bg-white px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-faint"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted2">{text.length}/1000</span>
                    <button
                      onClick={send}
                      disabled={busy || !text.trim()}
                      className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand disabled:opacity-50"
                    >
                      {busy ? 'Enviando…' : 'Enviar recado'}
                    </button>
                  </div>
                </div>
                {notes.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted2">Nenhum recado enviado ainda.</p>
                )}
                {notes.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-line bg-card p-4">
                    <div className="mb-1 flex items-center justify-between text-xs font-bold text-muted2">
                      <span>{fmt(n.createdAt)}</span>
                      <span>{n.readAt ? `✓ lido ${fmt(n.readAt)}` : 'não lido'}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[15px] text-ink">{n.text}</p>
                  </div>
                ))}
              </div>
            )}

            {tab === 'fotos' && (
              <div>
                {photos.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted2">
                    {selected.name.split(' ')[0]} ainda não enviou fotos.
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {photos.map((p) => (
                    <figure key={p.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                      {p.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.url} alt={p.note ?? 'Foto de progresso'} className="aspect-[3/4] w-full object-cover" />
                      ) : (
                        <div className="aspect-[3/4] w-full bg-chip" />
                      )}
                      <figcaption className="p-2.5">
                        <p className="text-xs font-extrabold">{fmtDay(p.takenAt)}</p>
                        {p.note && <p className="truncate text-[11px] text-muted2">{p.note}</p>}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
