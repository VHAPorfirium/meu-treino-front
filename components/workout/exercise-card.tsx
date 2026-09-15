'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type {
  AlternativeExercise,
  PatchExercisePayload,
  SetLogInput,
  TodayExercise,
  WorkoutExerciseLog,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { descrevePrescricao } from '@/lib/exercicios/modo';
import { StatusBadge, STATUS_COLOR } from '@/components/ui/status-badge';
import { AlternativesModal } from './alternatives-modal';
import { SkipModal } from './skip-modal';

const STRIPE =
  'repeating-linear-gradient(135deg,#EFE7DC 0 6px,#E5DBCE 6px 12px)';

type SetRow = { weight: string; reps: string };

/** Linhas de série iniciais: do log (se houver) ou N vazias conforme o treino. */
function initialRows(item: TodayExercise, log?: WorkoutExerciseLog): SetRow[] {
  if (log?.sets && log.sets.length) {
    return log.sets.map((s) => ({
      weight: s.weight != null ? String(s.weight) : '',
      reps: s.reps != null ? String(s.reps) : '',
    }));
  }
  const n = Math.max(1, item.sets);
  return Array.from({ length: n }, () => ({
    weight: log?.loadUsed != null ? String(log.loadUsed) : '',
    reps: '',
  }));
}

function toSets(rows: SetRow[]): SetLogInput[] | undefined {
  const filled = rows
    .map((r, i) => ({
      setNumber: i + 1,
      weight: r.weight.trim() === '' ? undefined : Number(r.weight),
      reps: r.reps.trim() === '' ? undefined : Number(r.reps),
    }))
    .filter((s) => s.weight !== undefined || s.reps !== undefined);
  return filled.length ? filled : undefined;
}

export function ExerciseCard({
  item,
  log,
  disabled,
  pending,
  onPatch,
  onTimer,
}: {
  item: TodayExercise;
  log?: WorkoutExerciseLog;
  disabled?: boolean;
  /** true = última escrita ficou na fila offline (E5) */
  pending?: boolean;
  onPatch: (weId: string, payload: PatchExercisePayload) => Promise<void>;
  /** E3/E10 — pede ao pai que abra o cronômetro (descanso ou bloco de cardio) */
  onTimer?: (seconds: number | null, label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAlts, setShowAlts] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const ehTempo = item.mode === 'TIME';
  const [rows, setRows] = useState<SetRow[]>(() => initialRows(item, log));
  // E10 — no modo TIME o registro é um bloco de minutos, não uma tabela de séries
  const [minutos, setMinutos] = useState<string>(() => {
    const seg =
      log?.sets?.[0]?.durationSeconds ?? log?.totalSeconds ?? item.durationSeconds;
    return seg ? String(Math.round(seg / 60)) : '';
  });
  const [note, setNote] = useState(log?.note ?? '');
  const [replaced, setReplaced] = useState<AlternativeExercise | null>(null);
  const [saving, setSaving] = useState(false);

  const status = log?.status;
  const bar = status ? STATUS_COLOR[status].fg : 'transparent';

  // carga/séries derivadas das linhas (compat) + `sets[]` (E4)
  const common = (): Partial<PatchExercisePayload> => {
    if (ehTempo) {
      const seg = Math.round((Number(minutos) || 0) * 60);
      return {
        sets: seg > 0 ? [{ setNumber: 1, durationSeconds: seg }] : undefined,
        totalSeconds: seg > 0 ? seg : undefined,
        note: note.trim() || undefined,
      };
    }
    const sets = toSets(rows);
    const weights = (sets ?? []).map((s) => s.weight).filter((w): w is number => w !== undefined);
    return {
      sets,
      loadUsed: weights.length ? Math.max(...weights) : undefined,
      setsCompleted: sets ? sets.length : undefined,
      note: note.trim() || undefined,
    };
  };

  async function mark(payload: PatchExercisePayload) {
    setSaving(true);
    try {
      await onPatch(item.id, payload);
    } finally {
      setSaving(false);
    }
  }

  const persist = () =>
    status && mark({ status, ...common(), actualExerciseId: replaced?.id });

  async function pickAlternative(alt: AlternativeExercise) {
    setReplaced(alt);
    setShowAlts(false);
    setOpen(true);
    await mark({ status: 'REPLACED', actualExerciseId: alt.id, ...common() });
  }

  function updateRow(i: number, patch: Partial<SetRow>) {
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  /** "Feito ✓" numa série: salva e dispara o timer de descanso. */
  function completeSet(i: number) {
    const r = rows[i];
    if (!r.reps.trim())
      updateRow(i, { reps: String((item.reps ?? '').split(/[^\d]/)[0] || '') });
    // dá um tick pro estado atualizar antes de persistir
    setTimeout(() => {
      void (status ? persist() : mark({ status: 'DONE', ...common() }));
      onTimer?.(item.restSeconds, 'Descanso');
    }, 0);
  }

  const filledCount = rows.filter((r) => r.weight.trim() || r.reps.trim()).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
      <div className="absolute bottom-0 left-0 top-0 w-[5px]" style={{ background: bar }} />

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
            <div className="h-[68px] w-[68px] rounded-[14px]" style={{ background: STRIPE }} />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/treino/exercicio/${item.exercise.id}`}>
              <p className="text-[16px] font-extrabold capitalize leading-tight">
                {item.exercise.name}
              </p>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              {pending && (
                <span title="Salvo no aparelho — envia quando voltar a rede" className="text-xs">
                  ⏳
                </span>
              )}
              {status && <StatusBadge status={status} />}
            </div>
          </div>
          <p className="mt-1 text-[13px] font-semibold text-muted2">
            {descrevePrescricao(item)}
            {item.restSeconds ? ` · ${item.restSeconds}s desc.` : ''}
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
        {open
          ? 'Ocultar'
          : ehTempo
            ? `Tempo${minutos ? ` (${minutos} min)` : ''} / observação`
            : `Séries${filledCount ? ` (${filledCount}/${rows.length})` : ''} / observação`}
      </button>

      {open && (
        <div className="space-y-3 border-t border-line p-3 pl-4">
          {/* E10 — cardio/prancha: um bloco de tempo, com cronômetro */}
          {ehTempo && (
            <div className="flex items-end gap-2">
              <label className="flex-1 text-[10px] font-extrabold uppercase tracking-wide text-muted2">
                Tempo (min)
                <input
                  inputMode="numeric"
                  value={minutos}
                  onChange={(e) => setMinutos(e.target.value)}
                  onBlur={persist}
                  placeholder={
                    item.durationSeconds
                      ? String(Math.round(item.durationSeconds / 60))
                      : 'min'
                  }
                  disabled={disabled}
                  className="mt-1 w-full rounded-xl border-2 border-line2 bg-white px-3 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint"
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() =>
                  onTimer?.(
                    Math.round((Number(minutos) || 0) * 60) ||
                      item.durationSeconds ||
                      0,
                    item.exercise.name,
                  )
                }
                className="h-[42px] rounded-xl bg-ink px-4 text-sm font-extrabold text-white disabled:opacity-50"
              >
                ▶ Cronômetro
              </button>
            </div>
          )}

          {/* E4 — registro por série (só no modo REPS) */}
          <div className={`space-y-1.5 ${ehTempo ? 'hidden' : ''}`}>
            <div className="grid grid-cols-[28px_1fr_1fr_44px] gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wide text-muted2">
              <span>#</span>
              <span>Peso (kg)</span>
              <span>Reps</span>
              <span />
            </div>
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[28px_1fr_1fr_44px] items-center gap-2">
                <span className="text-center text-sm font-extrabold text-muted2">{i + 1}</span>
                <input
                  inputMode="decimal"
                  value={r.weight}
                  onChange={(e) => updateRow(i, { weight: e.target.value })}
                  onBlur={persist}
                  placeholder={i > 0 && rows[i - 1].weight ? rows[i - 1].weight : 'kg'}
                  disabled={disabled}
                  className="w-full rounded-xl border-2 border-line2 bg-white px-3 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint"
                />
                <input
                  inputMode="numeric"
                  value={r.reps}
                  onChange={(e) => updateRow(i, { reps: e.target.value })}
                  onBlur={persist}
                  placeholder={item.reps ?? ''}
                  disabled={disabled}
                  className="w-full rounded-xl border-2 border-line2 bg-white px-3 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint"
                />
                <button
                  type="button"
                  onClick={() => completeSet(i)}
                  disabled={disabled || saving}
                  aria-label={`Concluir série ${i + 1} e descansar`}
                  title="Concluir série e iniciar descanso"
                  className={`h-10 rounded-xl text-sm font-extrabold ${
                    r.weight.trim() || r.reps.trim()
                      ? 'bg-done-bg text-done-ink'
                      : 'bg-chip text-muted'
                  }`}
                >
                  ✓
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setRows((rs) => [...rs, { weight: '', reps: '' }])}
                className="rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-ink"
              >
                + série
              </button>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setRows((rs) => rs.slice(0, -1));
                    setTimeout(persist, 0);
                  }}
                  className="rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted"
                >
                  − série
                </button>
              )}
            </div>
          </div>

          <label className="block text-xs font-bold text-muted2">
            Observação
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={persist}
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
            mark({ status: 'SKIPPED', ...common(), note: skipNote || undefined });
          }}
        />
      )}
    </div>
  );
}
