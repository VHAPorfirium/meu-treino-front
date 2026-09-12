'use client';

import { useState } from 'react';

const REASONS = ['Senti dor', 'Máquina ocupada', 'Sem tempo', 'Sem energia'];

export function SkipModal({
  exerciseName,
  onConfirm,
  onClose,
}: {
  exerciseName: string;
  onConfirm: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 px-5">
      <div className="w-full max-w-sm rounded-3xl bg-paper p-6">
        <div className="mb-3 flex h-13 w-13 items-center justify-center rounded-full bg-skip-bg text-2xl font-extrabold text-skip" style={{ height: 52, width: 52 }}>
          ✕
        </div>
        <h2 className="font-display text-[24px] font-extrabold leading-tight tracking-tight">
          Pular {exerciseName}?
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-muted2">
          Conta o que aconteceu — isso aparece no acompanhamento.
        </p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Ex: senti dor no ombro, máquina ocupada…"
          className="mt-4 w-full rounded-2xl border-2 border-line2 bg-white px-4 py-3 text-base font-medium text-ink placeholder:text-faint"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setNote((n) => (n ? n : r))}
              className="rounded-full bg-chip px-3.5 py-2 text-[13px] font-bold text-muted"
            >
              {r}
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={() => onConfirm(note.trim())}
            className="h-14 rounded-2xl bg-skip text-[17px] font-extrabold text-white"
          >
            Confirmar pulo
          </button>
          <button
            onClick={onClose}
            className="h-12 rounded-2xl border-2 border-ink text-base font-extrabold"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
