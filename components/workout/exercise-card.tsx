'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type {
  AlternativeExercise,
  LastPerformance,
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

/**
 * Linhas de série iniciais: do log (se houver) ou N linhas conforme o treino,
 * já com a carga sugerida pela "última vez" quando existir.
 */
function initialRows(
  item: TodayExercise,
  log?: WorkoutExerciseLog,
  suggestedWeight?: number | null,
): SetRow[] {
  if (log?.sets && log.sets.length) {
    return log.sets.map((s) => ({
      weight: s.weight != null ? String(s.weight) : '',
      reps: s.reps != null ? String(s.reps) : '',
    }));
  }
  const n = Math.max(1, item.sets);
  return Array.from({ length: n }, () => ({
    weight:
      log?.loadUsed != null
        ? String(log.loadUsed)
        : suggestedWeight != null
          ? String(suggestedWeight)
          : '',
    reps: '',
  }));
}

/** Aceita tanto "42.5" quanto "42,5" (teclado numérico pt-BR) e rejeita NaN/negativos. */
function parseDecimal(raw: string): number | undefined {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return undefined;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Reps precisa ser inteiro >= 0 (o backend valida com @IsInt). */
function parseNonNegativeInt(raw: string): number | undefined {
  const value = parseDecimal(raw);
  return value === undefined ? undefined : Math.round(value);
}

function toSets(rows: SetRow[]): SetLogInput[] {
  return rows
    .map((r, i) => ({
      setNumber: i + 1,
      weight: parseDecimal(r.weight),
      reps: parseNonNegativeInt(r.reps),
    }))
    .filter((s) => s.weight !== undefined || s.reps !== undefined);
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
  lastPerformance,
  isCurrent = false,
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
  /** Como o aluno fez este exercício da última vez + carga sugerida para hoje. */
  lastPerformance?: LastPerformance;
  /** Exercício da vez: fica destacado e já abre com as séries. */
  isCurrent?: boolean;
}) {
  const [open, setOpen] = useState(isCurrent);
  const [showAlts, setShowAlts] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [activeRowIdx, setActiveRowIdx] = useState<number>(0);
  const ehTempo = item.mode === 'TIME';

  // E13 — o rascunho vence: ele é mais NOVO que o log
  const [rows, setRows] = useState<SetRow[]>(
    () => rascunho?.linhas ?? initialRows(item, log, lastPerformance?.suggestedWeight),
  );

  // E10 — no modo TIME o registro é um bloco de minutos
  const [minutos, setMinutos] = useState<string>(() => {
    if (rascunho?.minutos !== undefined) return rascunho.minutos;
    const seg =
      log?.sets?.[0]?.durationSeconds ?? log?.totalSeconds ?? item.durationSeconds;
    return seg ? String(Math.round(seg / 60)) : '';
  });

  const [note, setNote] = useState(rascunho?.nota ?? log?.note ?? '');
  // Hidrata a troca a partir do log salvo (sobrevive a recarregamento de página)
  const [replaced, setReplaced] = useState<AlternativeExercise | null>(() => {
    if (log?.status !== 'REPLACED' || !log.actualExerciseId) return null;
    return item.alternatives.find((alt) => alt.id === log.actualExerciseId) ?? null;
  });
  const [saving, setSaving] = useState(false);
  // Só persiste no onBlur quando houve digitação real, sem bloquear cliques em botões.
  const dirtyRef = useRef(false);

  const status = log?.status;
  const bar = status ? STATUS_COLOR[status].fg : 'transparent';

  const effectiveActualExerciseId =
    status === 'REPLACED'
      ? (replaced?.id ?? log?.actualExerciseId ?? undefined)
      : undefined;
  const effectiveReplaced =
    status === 'REPLACED'
      ? (replaced ??
        (effectiveActualExerciseId
          ? (item.alternatives.find((alt) => alt.id === effectiveActualExerciseId) ?? null)
          : null))
      : replaced;

  // carga/séries derivadas das linhas (aceita overrides para evitar closures obsoletas)
  function buildCommon(overrides?: {
    rows?: SetRow[];
    minutos?: string;
    note?: string;
  }): Partial<PatchExercisePayload> {
    const currentRows = overrides?.rows ?? rows;
    const currentMinutos = overrides?.minutos ?? minutos;
    const currentNote = overrides?.note ?? note;
    if (ehTempo) {
      const seg = Math.round((parseDecimal(currentMinutos) ?? 0) * 60);
      return {
        // Envia `sets: []` ao zerar o tempo para limpar SetLog órfãos no servidor.
        sets: seg > 0 ? [{ setNumber: 1, durationSeconds: seg }] : [],
        totalSeconds: seg > 0 ? seg : undefined,
        note: currentNote.trim() || undefined,
      };
    }
    const sets = toSets(currentRows);
    const weights = sets.map((s) => s.weight).filter((w): w is number => w !== undefined);
    return {
      sets,
      loadUsed: weights.length ? Math.max(...weights) : undefined,
      setsCompleted: sets.length ? sets.length : undefined,
      note: currentNote.trim() || undefined,
    };
  }

  async function mark(
    payload: PatchExercisePayload,
    options?: { silent?: boolean },
  ) {
    if (disabled) return;
    dirtyRef.current = false;
    const silent = Boolean(options?.silent);
    if (!silent) {
      unlockAudio();
      triggerHaptic('light');
      setSaving(true);
    }
    try {
      await onPatch(item.id, payload);
    } finally {
      if (!silent) {
        setSaving(false);
      }
    }
  }

  function persist(
    overrides?: { rows?: SetRow[]; minutos?: string; note?: string },
    options?: { silent?: boolean },
  ) {
    if (disabled || !status) return;
    if (status === 'REPLACED' && !effectiveActualExerciseId) return;
    return mark(
      {
        status,
        ...buildCommon(overrides),
        actualExerciseId: effectiveActualExerciseId,
      },
      options,
    );
  }

  /**
   * Persiste edições de input no onBlur sem acionar `setSaving(true)`, evitando que
   * um toque direto em `✓`, `+2.5kg`, `+1 rep` ou `✓ Feito` seja engolido entre
   * `pointerdown` (`blur`) e `pointerup` (`click`).
   */
  function persistOnBlur(overrides?: { rows?: SetRow[]; minutos?: string; note?: string }) {
    if (!dirtyRef.current) return;
    void persist(overrides, { silent: true });
  }

  async function pickAlternative(alt: AlternativeExercise) {
    if (disabled) return;
    unlockAudio();
    triggerHaptic('medium');
    setReplaced(alt);
    setShowAlts(false);
    setOpen(true);
    await mark({ status: 'REPLACED', actualExerciseId: alt.id, ...buildCommon() });
  }

  function updateRow(i: number, patch: Partial<SetRow>) {
    if (disabled) return;
    dirtyRef.current = true;
    setRows((rs) => {
      const novo = rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
      onRascunho?.(item.id, { linhas: novo });
      return novo;
    });
  }

  /** Ajuste rápido de carga para a série selecionada */
  function adjustWeight(delta: number) {
    if (disabled) return;
    triggerHaptic('light');
    const idx = Math.min(Math.max(0, activeRowIdx), rows.length - 1);
    const current = parseDecimal(rows[idx]?.weight ?? '') ?? 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    const nextRows = rows.map((r, rowIdx) =>
      rowIdx === idx ? { ...r, weight: next === 0 ? '' : String(next) } : r,
    );
    setRows(nextRows);
    onRascunho?.(item.id, { linhas: nextRows });
    void persist({ rows: nextRows }, { silent: true });
  }

  /** Ajuste rápido de repetições para a série selecionada */
  function adjustReps(delta: number) {
    if (disabled) return;
    triggerHaptic('light');
    const idx = Math.min(Math.max(0, activeRowIdx), rows.length - 1);
    const current = parseNonNegativeInt(rows[idx]?.reps ?? '') ?? 0;
    const next = Math.max(0, current + delta);
    const nextRows = rows.map((r, rowIdx) =>
      rowIdx === idx ? { ...r, reps: next === 0 ? '' : String(next) } : r,
    );
    setRows(nextRows);
    onRascunho?.(item.id, { linhas: nextRows });
    void persist({ rows: nextRows }, { silent: true });
  }

  /** Copia carga e repetições da série anterior */
  function copyPreviousRow(i: number) {
    if (disabled || i <= 0) return;
    triggerHaptic('light');
    const prev = rows[i - 1];
    const nextRows = rows.map((r, rowIdx) =>
      rowIdx === i ? { ...r, weight: prev.weight, reps: prev.reps } : r,
    );
    setRows(nextRows);
    onRascunho?.(item.id, { linhas: nextRows });
    void persist({ rows: nextRows }, { silent: true });
  }

  /** "Feito ✓" numa série: salva, vibra e dispara o timer de descanso. */
  function completeSet(i: number) {
    if (disabled) return;
    unlockAudio();
    triggerHaptic('success');
    const r = rows[i];
    let nextRows = rows;
    if (!r.reps.trim()) {
      const defaultReps = String((item.reps ?? '').split(/[^\d]/)[0] || '');
      nextRows = rows.map((row, rowIdx) =>
        rowIdx === i ? { ...row, reps: defaultReps } : row,
      );
      setRows(nextRows);
      onRascunho?.(item.id, { linhas: nextRows });
    }
    void (status
      ? persist({ rows: nextRows }, { silent: true })
      : mark({ status: 'DONE', ...buildCommon({ rows: nextRows }) }, { silent: true }));
    onTimer?.(item.restSeconds, `Descanso · Série ${i + 1}/${nextRows.length}`);
  }

  const filledCount = rows.filter((r) => r.weight.trim() || r.reps.trim()).length;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-card shadow-sm transition ${
        isCurrent ? 'border-2 border-brand' : 'border-line'
      }`}
    >
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
          {lastPerformance && <LastPerformanceLine lastPerformance={lastPerformance} isTimeMode={ehTempo} />}
          {(effectiveReplaced || (status === 'REPLACED' && effectiveActualExerciseId)) && (
            <p className="mt-1 text-xs font-bold text-replace">
              ⇄ trocado por{' '}
              <span className="capitalize">
                {effectiveReplaced ? nomeExercicio(effectiveReplaced) : 'exercício substituto'}
              </span>
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
            setReplaced(null);
            setOpen(true);
            void mark({ status: 'DONE', ...buildCommon() });
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
                  inputMode="decimal"
                  value={minutos}
                  onChange={(e) => {
                    dirtyRef.current = true;
                    setMinutos(e.target.value);
                    onRascunho?.(item.id, { minutos: e.target.value });
                  }}
                  onBlur={(e) => persistOnBlur({ minutos: e.currentTarget.value })}
                  placeholder={
                    item.durationSeconds
                      ? String(Math.round(item.durationSeconds / 60))
                      : 'min'
                  }
                  disabled={disabled}
                  className="mt-1 w-full rounded-xl border-2 border-line2 bg-card px-3 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint disabled:opacity-60"
                />
              </label>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  unlockAudio();
                  triggerHaptic('medium');
                  onTimer?.(
                    Math.round((parseDecimal(minutos) ?? 0) * 60) ||
                      item.durationSeconds ||
                      0,
                    nomeExercicio(item.exercise),
                  );
                }}
                className="h-[44px] rounded-xl bg-inverse px-4 text-sm font-extrabold text-on-inverse shadow-sm transition active:scale-95 disabled:bg-chip disabled:text-muted2 disabled:shadow-none"
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
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => adjustWeight(-2)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-muted transition active:scale-90 disabled:opacity-40"
                >
                  -2kg
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => adjustWeight(1)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-ink transition active:scale-90 disabled:opacity-40"
                >
                  +1kg
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => adjustWeight(2.5)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-ink transition active:scale-90 disabled:opacity-40"
                >
                  +2.5kg
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => adjustWeight(5)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-ink transition active:scale-90 disabled:opacity-40"
                >
                  +5kg
                </button>
                <span className="text-muted2/50">|</span>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => adjustReps(1)}
                  className="rounded-lg bg-chip px-2 py-1 text-[11px] font-bold text-brand transition active:scale-90 disabled:opacity-40"
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
                      onBlur={() => persistOnBlur()}
                      placeholder={i > 0 && rows[i - 1].weight ? rows[i - 1].weight : 'kg'}
                      disabled={disabled}
                      className="min-w-0 w-full rounded-xl border-2 border-line2 bg-card px-2.5 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint disabled:opacity-60"
                    />
                    <input
                      inputMode="numeric"
                      value={r.reps}
                      onFocus={() => setActiveRowIdx(i)}
                      onChange={(e) => updateRow(i, { reps: e.target.value })}
                      onBlur={() => persistOnBlur()}
                      placeholder={item.reps ?? ''}
                      disabled={disabled}
                      className="min-w-0 w-full rounded-xl border-2 border-line2 bg-card px-2.5 py-2 text-center text-base font-bold text-ink placeholder:font-medium placeholder:text-faint disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => completeSet(i)}
                      disabled={disabled}
                      aria-label={`Concluir série ${i + 1} e descansar`}
                      title="Concluir série e iniciar descanso"
                      className={`h-11 w-full rounded-xl text-base font-extrabold transition active:scale-95 disabled:opacity-40 ${
                        r.weight.trim() || r.reps.trim()
                          ? 'bg-done-bg text-done-ink border border-done/40 shadow-sm'
                          : 'bg-chip text-muted'
                      }`}
                    >
                      ✓
                    </button>
                  </div>

                  {/* Sugestão de copiar série anterior com 1 toque */}
                  {!disabled && canCopy && (
                    <div className="flex justify-end pr-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => copyPreviousRow(i)}
                        className="text-[11px] font-bold text-brand hover:underline disabled:opacity-40"
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
                disabled={disabled}
                onClick={() => {
                  if (disabled) return;
                  triggerHaptic('light');
                  const nextRows = [...rows, { weight: '', reps: '' }];
                  setRows(nextRows);
                  onRascunho?.(item.id, { linhas: nextRows });
                  setActiveRowIdx(nextRows.length - 1);
                }}
                className="flex-1 rounded-xl bg-chip py-2.5 text-xs font-bold text-ink transition active:scale-95 disabled:opacity-40"
              >
                + Adicionar série
              </button>
              {rows.length > 1 && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    if (disabled || rows.length <= 1) return;
                    triggerHaptic('light');
                    const nextRows = rows.slice(0, -1);
                    setRows(nextRows);
                    onRascunho?.(item.id, { linhas: nextRows });
                    setActiveRowIdx((prev) => Math.min(prev, nextRows.length - 1));
                    void persist({ rows: nextRows }, { silent: true });
                  }}
                  className="rounded-xl bg-chip px-4 py-2.5 text-xs font-bold text-muted transition active:scale-95 disabled:opacity-40"
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
              disabled={disabled}
              maxLength={500}
              onChange={(e) => {
                dirtyRef.current = true;
                setNote(e.target.value);
                onRascunho?.(item.id, { nota: e.target.value });
              }}
              onBlur={(e) => persistOnBlur({ note: e.currentTarget.value })}
              rows={2}
              placeholder="Ex: senti ombro na 3ª série, subir peso na próxima…"
              className="mt-1 w-full rounded-xl border-2 border-line2 bg-card px-3 py-2 text-sm font-medium text-ink placeholder:text-faint disabled:opacity-60"
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
            setReplaced(null);
            setNote(skipNote);
            setShowSkip(false);
            void mark({ status: 'SKIPPED', ...buildCommon({ note: skipNote }), note: skipNote || undefined });
          }}
        />
      )}
    </div>
  );
}

/** "Última vez: 40 kg × 12 · tente 42,5 kg" */
function LastPerformanceLine({
  lastPerformance,
  isTimeMode,
}: {
  lastPerformance: LastPerformance;
  isTimeMode: boolean;
}) {
  const heaviestSet = [...lastPerformance.sets]
    .filter((performedSet) => performedSet.weight != null)
    .sort((first, second) => (second.weight ?? 0) - (first.weight ?? 0))[0];

  const lastPerformanceDescription = isTimeMode
    ? lastPerformance.totalSeconds
      ? `${Math.round(lastPerformance.totalSeconds / 60)} min`
      : null
    : heaviestSet
      ? `${formatWeight(heaviestSet.weight)} kg${heaviestSet.reps ? ` × ${heaviestSet.reps}` : ''}`
      : lastPerformance.loadUsed != null
        ? `${formatWeight(lastPerformance.loadUsed)} kg`
        : null;

  if (!lastPerformanceDescription) return null;

  return (
    <p className="mt-1.5 rounded-lg bg-chip px-2 py-1 text-xs font-bold text-muted">
      <span className="text-muted2">Última vez:</span> {lastPerformanceDescription}
      {lastPerformance.suggestionKind === 'increase' && lastPerformance.suggestedWeight != null && (
        <span className="text-done"> · tente {formatWeight(lastPerformance.suggestedWeight)} kg</span>
      )}
    </p>
  );
}

/** 42.5 → "42,5" */
function formatWeight(weight: number | null): string {
  return weight == null ? '' : weight.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
}
