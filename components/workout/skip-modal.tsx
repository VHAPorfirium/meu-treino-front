'use client';

import { useState } from 'react';
import { triggerHaptic } from '@/lib/haptics';

const REASONS = [
  'Senti dor / desconforto',
  'Máquina ocupada',
  'Sem tempo hoje',
  'Sem energia / fadiga',
  'Falta de equipamento',
];

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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          triggerHaptic('light');
          onClose();
        }
      }}
    >
      <div className="w-full max-w-[440px] rounded-t-3xl border-t border-line bg-paper p-5 pb-[max(env(safe-area-inset-bottom),20px)] shadow-2xl animate-in slide-in-from-bottom duration-200">
        {/* Barra de arrasto (drag handle) */}
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line3" />

        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-skip-bg text-xl font-extrabold text-skip">
              ✕
            </div>
            <div>
              <h2 className="font-display text-[22px] font-extrabold leading-tight tracking-tight">
                Pular exercício?
              </h2>
              <p className="text-xs font-semibold capitalize text-muted2">
                {exerciseName}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-chip text-sm font-bold text-muted2"
          >
            ✕
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          Selecione o motivo ou anote o que aconteceu para seu histórico e acompanhamento:
        </p>

        {/* Chips de motivos rápidos com toque confortável */}
        <div className="mt-3 flex flex-wrap gap-2">
          {REASONS.map((r) => {
            const isSelected = note === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setNote(r);
                }}
                className={`rounded-full px-3.5 py-2 text-xs font-bold transition active:scale-95 ${
                  isSelected
                    ? 'border border-skip bg-skip-bg text-skip'
                    : 'bg-chip text-muted'
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Outro motivo (ex: máquina em manutenção)…"
          className="mt-3 w-full rounded-2xl border-2 border-line2 bg-card px-4 py-2.5 text-sm font-medium text-ink placeholder:text-faint"
        />

        {/* Botões de ação ergonomicamente na zona do polegar */}
        <div className="mt-4 flex flex-col gap-2">
          <button
            onClick={() => {
              triggerHaptic('warning');
              onConfirm(note.trim());
            }}
            className="h-13 w-full rounded-2xl bg-skip py-3.5 text-base font-extrabold text-on-skip shadow-sm transition active:scale-[0.98]"
          >
            Confirmar pulo
          </button>
          <button
            onClick={() => {
              triggerHaptic('light');
              onClose();
            }}
            className="h-11 w-full rounded-2xl border-2 border-line2 bg-chip py-2 text-sm font-bold text-muted transition active:scale-[0.98]"
          >
            Voltar ao treino
          </button>
        </div>
      </div>
    </div>
  );
}
