'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type {
  AlternativeExercise,
  PatchExercisePayload,
  TodayExercise,
  WorkoutExerciseLog,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { StatusBadge, STATUS_COLOR } from '@/components/ui/status-badge';
import { AlternativesModal } from './alternatives-modal';
import { SkipModal } from './skip-modal';

const STRIPE =
  'repeating-linear-gradient(135deg,#EFE7DC 0 6px,#E5DBCE 6px 12px)';

export function ExerciseCard({
  item,
  log,
  disabled,
  onPatch,
}: {
  item: TodayExercise;
  log?: WorkoutExerciseLog;
  disabled?: boolean;
  onPatch: (weId: string, payload: PatchExercisePayload) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [showAlts, setShowAlts] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [load, setLoad] = useState(log?.loadUsed?.toString() ?? '');
  const [setsDone, setSetsDone] = useState(log?.setsCompleted?.toString() ?? '');
  const [note, setNote] = useState(log?.note ?? '');
  const [replaced, setReplaced] = useState<AlternativeExercise | null>(null);
  const [saving, setSaving] = useState(false);

  const status = log?.status;
  const bar = status ? STATUS_COLOR[status].fg : 'transparent';

  const common = () => ({
    loadUsed: load ? Number(load) : undefined,
    setsCompleted: setsDone ? Number(setsDone) : undefined,
    note: note.trim() || undefined,
  });

  async function mark(payload: PatchExercisePayload) {
    setSaving(true);
    try {
      await onPatch(item.id, payload);
    } finally {
      setSaving(false);
    }
  }

  async function pickAlternative(alt: AlternativeExercise) {
    setReplaced(alt);
    setShowAlts(false);
    setOpen(true);
    await mark({ status: 'REPLACED', actualExerciseId: alt.id, ...common() });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
      <div
        className="absolute bottom-0 left-0 top-0 w-[5px]"
        style={{ background: bar }}
      />

      <div className="flex items-center gap-3 p-3 pl-4">
        <Link href={`/treino/exercicio/${item.exercise.id}`} className="shrink-0">
          {item.exercise.thumbnailUrl ? (
            <Image
              src={item.exercise.thumbnailUrl}
              alt={item.exercise.name}
              width={68}
              height={68}
              className="h-[68px] w-[68px] rounded-[14px] bg-white object-cover"
              unoptimized
            />
          ) : (
            <div
              className="h-[68px] w-[68px] rounded-[14px]"
              style={{ background: STRIPE }}
            />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/treino/exercicio/${item.exercise.id}`}>
              <p className="text-[16px] font-extrabold capitalize leading-tight">
                {item.exercise.name}
              </p>
            </Link>
            {status && <StatusBadge status={status} />}
          </div>
          <p className="mt-1 text-[13px] font-semibold text-muted2">
            {item.sets} × {item.reps}
            <span className="capitalize"> · {item.exercise.equipment ?? '—'}</span>
          </p>
          {replaced && (
            <p className="mt-1 text-xs font-bold text-replace">
              ⇄ trocado por <span className="capitalize">{replaced.name}</span>
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 px-3 pb-3 pl-4">
        <Button
          variant="done"
          active={status === 'DONE'}
          disabled={disabled || saving}
          className="flex-1 py-2.5 text-sm"
          onClick={() => {
            setOpen(true);
            mark({ status: 'DONE', ...common() });
          }}
        >
          ✓ Feito
        </Button>
        <Button
          variant="skip"
          active={status === 'SKIPPED'}
          disabled={disabled || saving}
          className="flex-1 py-2.5 text-sm"
          onClick={() => setShowSkip(true)}
        >
          ✕ Pular
        </Button>
        <Button
          variant="replace"
          active={status === 'REPLACED'}
          disabled={disabled || saving}
          className="flex-1 py-2.5 text-sm"
          onClick={() => setShowAlts(true)}
        >
          ⇄ Trocar
        </Button>
      </div>

      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full border-t border-line py-2 text-xs font-bold text-muted2"
      >
        {open ? 'Ocultar' : 'Carga / observação'}
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-3 pl-4">
          <div className="flex gap-2">
            <Field
              label="Carga (kg)"
              value={load}
              onChange={setLoad}
              onBlur={() =>
                status &&
                mark({ status, ...common(), actualExerciseId: replaced?.id })
              }
              placeholder="ex: 20"
            />
            <Field
              label="Séries feitas"
              value={setsDone}
              onChange={setSetsDone}
              onBlur={() =>
                status &&
                mark({ status, ...common(), actualExerciseId: replaced?.id })
              }
              placeholder={`${item.sets}`}
            />
          </div>
          <label className="block text-xs font-bold text-muted2">
            Observação
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={() =>
                status &&
                mark({ status, ...common(), actualExerciseId: replaced?.id })
              }
              rows={2}
              placeholder="ex: senti dor no ombro"
              className="mt-1 w-full rounded-xl border-2 border-line2 bg-white px-3 py-2 text-base font-medium text-ink placeholder:text-faint"
            />
          </label>
        </div>
      )}

      {showAlts && (
        <AlternativesModal
          exerciseId={item.exercise.id}
          exerciseName={item.exercise.name}
          onPick={pickAlternative}
          onClose={() => setShowAlts(false)}
        />
      )}

      {showSkip && (
        <SkipModal
          exerciseName={item.exercise.name}
          onClose={() => setShowSkip(false)}
          onConfirm={(skipNote) => {
            setNote(skipNote);
            setShowSkip(false);
            mark({
              status: 'SKIPPED',
              loadUsed: load ? Number(load) : undefined,
              setsCompleted: setsDone ? Number(setsDone) : undefined,
              note: skipNote || undefined,
            });
          }}
        />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
}) {
  return (
    <label className="flex-1 text-xs font-bold text-muted2">
      {label}
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border-2 border-line2 bg-white px-3 py-2 text-base font-bold text-ink placeholder:font-medium placeholder:text-faint"
      />
    </label>
  );
}
