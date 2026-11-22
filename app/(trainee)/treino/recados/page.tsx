'use client';

import { useEffect, useState } from 'react';
import type { TrainerNote } from '@/lib/types';
import { notesApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { toLocalDayKey } from '@/lib/trainee/workout-history';
import { AppHeader } from '@/components/layout/app-header';

const formatTime = (isoDate: string) =>
  new Date(isoDate).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "Hoje", "Ontem" ou "Quinta, 19 nov". */
function formatDayLabel(isoDate: string): string {
  const noteDate = new Date(isoDate);
  const todayDayKey = toLocalDayKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (toLocalDayKey(noteDate) === todayDayKey) return 'Hoje';
  if (toLocalDayKey(noteDate) === toLocalDayKey(yesterday)) return 'Ontem';
  const dayLabel = noteDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'short' });
  return dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1).replace('.', '');
}

/** Recados do personal em formato de conversa, agrupados por dia. Marca como lido ao abrir. */
export default function RecadosPage() {
  const [notes, setNotes] = useState<TrainerNote[] | null>(null);
  // guardados ANTES de marcar como lido, para o destaque de "novo" continuar visível
  const [unreadNoteIds, setUnreadNoteIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    notesApi
      .mine()
      .then(async ({ items }) => {
        setNotes(items);
        const unreadNotes = items.filter((note) => !note.readAt);
        setUnreadNoteIds(new Set(unreadNotes.map((note) => note.id)));
        await Promise.all(unreadNotes.map((note) => notesApi.markRead(note.id).catch(() => {})));
      })
      .catch((error) => setErrorMessage(error instanceof ApiError ? error.message : 'Sem conexão'));
  }, []);

  const notesGroupedByDay: { dayLabel: string; dayNotes: TrainerNote[] }[] = [];
  for (const note of notes ?? []) {
    const dayLabel = formatDayLabel(note.createdAt);
    const lastGroup = notesGroupedByDay[notesGroupedByDay.length - 1];
    if (lastGroup?.dayLabel === dayLabel) lastGroup.dayNotes.push(note);
    else notesGroupedByDay.push({ dayLabel, dayNotes: [note] });
  }
  const personalTrainerName = notes?.[0]?.from.name;

  return (
    <>
      <AppHeader
        eyebrow="Do seu personal"
        title="Recados"
        subtitle={personalTrainerName ? `Conversa com ${personalTrainerName}` : undefined}
      />
      <div className="p-5 pb-28">
        {notes === null && !errorMessage && <p className="py-10 text-center text-muted2">Carregando…</p>}
        {errorMessage && <p className="py-10 text-center text-brand">{errorMessage}</p>}
        {notes && notes.length === 0 && (
          <div className="py-16 text-center text-muted2">
            <p className="text-4xl">📝</p>
            <p className="mt-2 font-semibold">Nenhum recado ainda.</p>
            <p className="mt-1 text-sm">Quando seu personal mandar um recado, ele aparece aqui.</p>
          </div>
        )}

        {notesGroupedByDay.map(({ dayLabel, dayNotes }) => (
          <section key={dayLabel} className="mb-3">
            <p className="my-2 text-center">
              <span className="rounded-full bg-chip px-3 py-1 text-[11px] font-extrabold text-muted">{dayLabel}</span>
            </p>
            {dayNotes.map((note) => {
              const isUnread = unreadNoteIds.has(note.id);
              return (
                <div key={note.id} className="mb-3">
                  {isUnread && <p className="mb-1 ml-1 text-[11px] font-extrabold uppercase tracking-wider text-brand">● Novo</p>}
                  <div
                    className={`max-w-[88%] whitespace-pre-wrap rounded-[18px] rounded-bl-md border bg-card px-3.5 py-2.5 text-[14.5px] font-semibold leading-snug text-ink ${
                      isUnread ? 'border-brand shadow-[0_0_0_3px_rgba(238,78,34,0.12)]' : 'border-line'
                    }`}
                  >
                    {note.text}
                  </div>
                  <p className="ml-1 mt-1 text-[11px] font-bold text-muted2">
                    {note.from.name} · {formatTime(note.createdAt)}
                  </p>
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </>
  );
}
