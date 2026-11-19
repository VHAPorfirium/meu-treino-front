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
import {
  descrevePrescricao,
  equipamentoExercicio,
  nomeExercicio,
} from '@/lib/exercicios/modo';
import type { RascunhoExercicio } from '@/lib/offline/rascunho';
import { StatusBadge, STATUS_COLOR } from '@/components/ui/status-badge';
import { AlternativesModal } from './alternatives-modal';
import { SkipModal } from './skip-modal';
import { triggerHaptic } from '@/lib/haptics';
import { unlockAudio } from '@/lib/audio';

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
  rascunho,
  onRascunho,
}: {
  item: TodayExercise;
  log?: WorkoutExerciseLog;
  disabled?: boolean;
  /** true = última escrita ficou na fila offline (E5) */
  pending?: boolean;
  onPatch: (weId: string, payload: PatchExercisePayload) => Promise<void>;
  /** E3/E10 — pede ao pai que abra o cronômetro (descanso ou bloco de cardio) */
  onTimer?: (seconds: number | null, label: string) => void;
  /** E13 — o que foi digitado e ainda não salvo, recuperado ao voltar pro app */
  rascunho?: RascunhoExercicio;
  /** E13 — avisa cada digitação pro pai gravar o rascunho (com atraso) */
  onRascunho?: (weId: string, dados: RascunhoExercicio) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showAlts, setShowAlts] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [activeRowIdx, setActiveRowIdx] = useState<number>(0);
  const ehTempo = item.mode === 'TIME';

  // E13 — o rascunho vence: ele é mais NOVO que o log
  const [rows, setRows] = useState<SetRow[]>(
    () => rascunho?.linhas ?? initialRows(item, log),
  );

  // E10 — no modo TIME o registro é um bloco de minutos
  const [minutos, setMinutos] = useState<string>(() => {
    if (rascunho?.minutos !== undefined) return rascunho.minutos;
    const seg =
      log?.sets?.[0]?.durationSeconds ?? log?.totalSeconds ?? item.durationSeconds;
    return seg ? String(Math.round(seg / 60)) : '';
  });

  const [note, setNote] = useState(rascunho?.nota ?? log?.note ?? '');
  const [replaced, setReplaced] = useState<AlternativeExercise | null>(null);
  const [saving, setSaving] = useState(false);

  const status = log?.status;
  const bar = status ? STATUS_COLOR[status].fg : 'transparent';

  // carga/séries derivadas das linhas
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
    unlockAudio();
    triggerHaptic('light');
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
    unlockAudio();
    triggerHaptic('medium');
    setReplaced(alt);
    setShowAlts(false);
    setOpen(true);
    await mark({ status: 'REPLACED', actualExerciseId: alt.id, ...common() });
  }

  function updateRow(i: number, patch: Partial<SetRow>) {
    setRows((rs) => {
      const novo = rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
      onRascunho?.(item.id, { linhas: novo });
      return novo;
    });
  }

  /** Ajuste rápido de carga para a série selecionada */
  function adjustWeight(delta: number) {
    triggerHaptic('light');
    const idx = Math.min(Math.max(0, activeRowIdx), rows.length - 1);
    const current = Number(rows[idx]?.weight) || 0;
    const next = Math.max(0, current + delta);
    updateRow(idx, { weight: next === 0 ? '' : String(next) });
    setTimeout(persist, 0);
  }

  /** Ajuste rápido de repetições para a série selecionada */
  function adjustReps(delta: number) {
    triggerHaptic('light');
    const idx = Math.min(Math.max(0, activeRowIdx), rows.length - 1);
    const current = Number(rows[idx]?.reps) || 0;
    const next = Math.max(0, current + delta);
    updateRow(idx, { reps: next === 0 ? '' : String(next) });
    setTimeout(persist, 0);
  }

  /** Copia carga e repetições da série anterior */
  function copyPreviousRow(i: number) {
    if (i <= 0) return;
    triggerHaptic('light');
    const prev = rows[i - 1];
    updateRow(i, { weight: prev.weight, reps: prev.reps });
    setTimeout(persist, 0);
  }

  /** "Feito ✓" numa série: salva, vibra e dispara o timer de descanso. */
  function completeSet(i: number) {
    unlockAudio();
    triggerHaptic('success');
    const r = rows[i];
    if (!r.reps.trim()) {
      updateRow(i, { reps: String((item.reps ?? '').split(/[^\d]/)[0] || '') });
    }
    setTimeout(() => {
      void (status ? persist() : mark({ status: 'DONE', ...common() }));
      onTimer?.(item.restSeconds, `Descanso · Série ${i + 1}/${rows.length}`);
    }, 0);
  }

  const filledCount = rows.filter((r) => r.weight.trim() || r.reps.trim()).length;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-card shadow-sm transition">
      <div className="absolute bottom-0 left-0 top-0 w-[5px]" style={{ background: bar }} />

      <div className="flex items-center gap-3 p-3 pl-4">
        <Link href={`/treino/exercicio/${item.exercise.id}`} className="shrink-0">
          {item.exercise.thumbnailUrl ? (
            <Image
              src={item.exercise.thumbnailUrl}
              alt={nomeExercicio(item.exercise)}
              width={68}
              height={68}
              className="h-[68px] w-[68px] rounded-[14px] bg-card object-cover"
              unoptimized
            />
          ) : (
            <div className="h-[68px] w-[68px] rounded-[14px]" style={{ background: STRIPE }} />
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/treino/exercicio/${item.exercise.id}`}>
              <p className="text-[16px] font-extrabold capitalize leading-tight text-ink">
                {nomeExercicio(item.exercise)}
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
            <span className="capitalize"> · {equipamentoExercicio(item.exercise)}</span>
          </p>
          {replaced && (
            <p className="mt-1 text-xs font-bold text-replace">
              ⇄ trocado por <span className="capitalize">{replaced.name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Botões de Ação na Zona do Polegar */}
      <div className="flex gap-2 px-3 pb-3 pl-4">
        <Button
          variant="done"
          active={status === 'DONE'}
          disabled={disabled || saving}
          className="flex-1 py-3 text-sm font-extrabold"
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
          className="flex-1 py-3 text-sm font-extrabold"
          onClick={() => {
            unlockAudio();
            triggerHaptic('light');
            setShowSkip(true);
          }}
        >
          ✕ Pular
        </Button>
        <Button
          variant="replace"
          active={status === 'REPLACED'}
          disabled={disabled || saving}
          className="flex-1 py-3 text-sm font-extrabold"
          onClick={() => {
            unlockAudio();
            triggerHaptic('light');
            setShowAlts(true);
          }}
        >
          ⇄ Trocar
        </Button>
      </div>

      <button
        onClick={() => {
          triggerHaptic('light');
          setOpen((o) => !o);
        }}
        className="flex w-full items-center justify-center gap-1.5 border-t border-line py-2.5 text-xs font-bold text-muted2 transition active:bg-chip/50"
      >
        <span>
          {open
            ? '▲ Ocultar séries'
            : ehTempo
              ? `▼ Tempo${minutos ? ` (${minutos} min)` : ''} / observação`
              : `▼ Séries${filledCount ? ` (${filledCount}/${rows.length})` : ''} / observação`}
        </span>
      </button>

      {open && (
        <div className="space-y-3.5 border-t border-line p-3 pl-4 bg-paper/30">
          {/* E10 — cardio/prancha: um bloco de tempo com cronômetro */}
          {ehTempo && (
            <div className="flex items-end gap-2">
              <label className="flex-1 text-[11px] font-extrabold uppercase tracking-wide text-muted2">
                Tempo (min)
                <input
                  inputMode="numeric"
                  value={minutos}
                  onChange={(e) => {
                    setMinutos(e.target.value);
                    onRascunho?.(item.id, { minutos: e.target.value });
                  }}
                  onBlur={persist}
                  placeholder={
                    item.durationSeconds
                      ? String(Math.round(item.durationSeconds / 60))
                      : 'min'
                  }
                  disabled={disabled}
                  className="mt-1 w-full rounded-xl border-2 border-line2 bg-card px-3 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint"
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  unlockAudio();
                  triggerHaptic('medium');
                  onTimer?.(
                    Math.round((Number(minutos) || 0) * 60) ||
                      item.durationSeconds ||
                      0,
                    nomeExercicio(item.exercise),
                  );
                }}
                className="h-[44px] rounded-xl bg-ink px-4 text-sm font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                ▶ Cronômetro
              </button>
            </div>
          )}

          {/* E4 — registro por série (modo REPS) */}
          <div className={`space-y-2 ${ehTempo ? 'hidden' : ''}`}>
            {/* Atalhos rápidos de carga/repetição para mãos cansadas */}
            <div className="flex flex-wrap items-center justify-between gap-1 pb-1 border-b border-line/60 text-xs">
              <span className="text-[11px] font-extrabold text-muted2">
                Série #{activeRowIdx + 1}:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => adjustWeight(-2)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-muted transition active:scale-90"
                >
                  -2kg
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(1)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-ink transition active:scale-90"
                >
                  +1kg
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(2.5)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-ink transition active:scale-90"
                >
                  +2.5kg
                </button>
                <button
                  type="button"
                  onClick={() => adjustWeight(5)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-ink transition active:scale-90"
                >
                  +5kg
                </button>
                <span className="text-muted2/50">|</span>
                <button
                  type="button"
                  onClick={() => adjustReps(1)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-brand transition active:scale-90"
                >
                  +1 rep
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[28px_1fr_1fr_48px] gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wide text-muted2">
              <span className="text-center">#</span>
              <span>Peso (kg)</span>
              <span>Reps</span>
              <span className="text-center">Feito</span>
            </div>

            {rows.map((r, i) => {
              const isSelected = activeRowIdx === i;
              const isEmpty = !r.weight.trim() && !r.reps.trim();
              const canCopy = i > 0 && isEmpty && (rows[i - 1].weight || rows[i - 1].reps);

              return (
                <div key={i} className="space-y-1">
                  <div
                    onClick={() => setActiveRowIdx(i)}
                    className={`grid grid-cols-[28px_1fr_1fr_48px] items-center gap-2 rounded-xl p-0.5 transition ${
                      isSelected ? 'ring-2 ring-brand/40 bg-card/60' : ''
                    }`}
                  >
                    <span className="text-center text-sm font-extrabold text-muted2">{i + 1}</span>
                    <input
                      inputMode="decimal"
                      value={r.weight}
                      onFocus={() => setActiveRowIdx(i)}
                      onChange={(e) => updateRow(i, { weight: e.target.value })}
                      onBlur={persist}
                      placeholder={i > 0 && rows[i - 1].weight ? rows[i - 1].weight : 'kg'}
                      disabled={disabled}
                      className="w-full rounded-xl border-2 border-line2 bg-card px-2.5 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint"
                    />
                    <input
                      inputMode="numeric"
                      value={r.reps}
                      onFocus={() => setActiveRowIdx(i)}
                      onChange={(e) => updateRow(i, { reps: e.target.value })}
                      onBlur={persist}
                      placeholder={item.reps ?? ''}
                      disabled={disabled}
                      className="w-full rounded-xl border-2 border-line2 bg-card px-2.5 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint"
                    />
                    <button
                      type="button"
                      onClick={() => completeSet(i)}
                      disabled={disabled || saving}
                      aria-label={`Concluir série ${i + 1} e descansar`}
                      title="Concluir série e iniciar descanso"
                      className={`h-11 w-full rounded-xl text-base font-extrabold transition active:scale-95 ${
                        r.weight.trim() || r.reps.trim()
                          ? 'bg-done-bg text-done-ink border border-done/40 shadow-sm'
                          : 'bg-chip text-muted'
                      }`}
                    >
                      ✓
                    </button>
                  </div>

                  {/* Sugestão de copiar série anterior com 1 toque */}
                  {canCopy && (
                    <div className="flex justify-end pr-1">
                      <button
                        type="button"
                        onClick={() => copyPreviousRow(i)}
                        className="text-[11px] font-bold text-brand hover:underline"
                      >
                        ↳ Repetir série {i} ({rows[i - 1].weight || '0'}kg × {rows[i - 1].reps || '0'} reps)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setRows((rs) => {
                    const novo = [...rs, { weight: '', reps: '' }];
                    onRascunho?.(item.id, { linhas: novo });
                    return novo;
                  });
                  setActiveRowIdx(rows.length);
                }}
                className="flex-1 rounded-xl bg-chip py-2.5 text-xs font-bold text-ink transition active:scale-95"
              >
                + Adicionar série
              </button>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setRows((rs) => {
                      const novo = rs.slice(0, -1);
                      onRascunho?.(item.id, { linhas: novo });
                      return novo;
                    });
                    setActiveRowIdx((prev) => Math.min(prev, rows.length - 2));
                    setTimeout(persist, 0);
                  }}
                  className="rounded-xl bg-chip px-4 py-2.5 text-xs font-bold text-muted transition active:scale-95"
                >
                  − Remover
                </button>
              )}
            </div>
          </div>

          <label className="block text-xs font-bold text-muted2">
            Observações pessoais
            <textarea
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                onRascunho?.(item.id, { nota: e.target.value });
              }}
              onBlur={persist}
              rows={2}
              placeholder="Ex: senti ombro na 3ª série, subir peso na próxima…"
              className="mt-1 w-full rounded-xl border-2 border-line2 bg-card px-3 py-2 text-sm font-medium text-ink placeholder:text-faint"
            />
          </label>
        </div>
      )}

      {showAlts && (
        <AlternativesModal
          exerciseId={item.exercise.id}
          exerciseName={nomeExercicio(item.exercise)}
          onPick={pickAlternative}
          onClose={() => setShowAlts(false)}
        />
      )}

      {showSkip && (
        <SkipModal
          exerciseName={nomeExercicio(item.exercise)}
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
