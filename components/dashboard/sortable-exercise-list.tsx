'use client';

import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ExerciseMode, WorkoutExerciseItem } from '@/lib/types';
import { descrevePrescricao, nomeExercicio } from '@/lib/exercicios/modo';

/**
 * E1 + E2 — lista de exercícios do treino: arrastar pra reordenar, editar inline
 * (séries/reps/descanso) e remover. Toda escrita é delegada ao pai.
 */
export function SortableExerciseList({
  items,
  onReorder,
  onUpdate,
  onRemove,
}: {
  items: WorkoutExerciseItem[];
  onReorder: (ordered: WorkoutExerciseItem[]) => Promise<void>;
  onUpdate: (
    weId: string,
    data: {
      mode?: ExerciseMode;
      sets?: number;
      reps?: string | null;
      durationSeconds?: number | null;
      restSeconds?: number | null;
    },
  ) => Promise<void>;
  onRemove: (weId: string) => Promise<void>;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    await onReorder(arrayMove(items, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((we) => (
            <Row key={we.id} item={we} onUpdate={onUpdate} onRemove={onRemove} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function Row({
  item,
  onUpdate,
  onRemove,
}: {
  item: WorkoutExerciseItem;
  onUpdate: SortableExerciseListProps['onUpdate'];
  onRemove: SortableExerciseListProps['onRemove'];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const [editing, setEditing] = useState(false);
  const [mode, setMode] = useState<ExerciseMode>(item.mode);
  const [sets, setSets] = useState(String(item.sets));
  const [reps, setReps] = useState(item.reps ?? '');
  const [minutes, setMinutes] = useState(
    item.durationSeconds != null ? String(Math.round(item.durationSeconds / 60)) : '20',
  );
  const [rest, setRest] = useState(item.restSeconds != null ? String(item.restSeconds) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const style = { transform: CSS.Transform.toString(transform), transition };

  function cancelEdit() {
    setMode(item.mode);
    setSets(String(item.sets));
    setReps(item.reps ?? '');
    setMinutes(
      item.durationSeconds != null ? String(Math.round(item.durationSeconds / 60)) : '20',
    );
    setRest(item.restSeconds != null ? String(item.restSeconds) : '');
    setError(null);
    setEditing(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const restTrimmed = rest.trim();
      const parsedRest = restTrimmed === '' ? null : Number(restTrimmed);
      const restSeconds =
        parsedRest === null
          ? null
          : Number.isFinite(parsedRest) && parsedRest >= 0
            ? Math.round(parsedRest)
            : null;
      const parsedSets = Math.round(Number(sets));
      const validSets = Number.isFinite(parsedSets) && parsedSets >= 1 ? parsedSets : item.sets;
      const parsedMinutes = Number(minutes);
      const validMinutes = Number.isFinite(parsedMinutes) && parsedMinutes > 0 ? parsedMinutes : 20;

      // E10 — os dois modos são exclusivos: TIME zera `reps`, REPS zera a duração,
      // pra não deixar no banco uma linha do tipo "3 × 10 durante 20 min".
      await onUpdate(
        item.id,
        mode === 'TIME'
          ? {
              mode,
              sets: 1,
              reps: null,
              durationSeconds: Math.round(validMinutes * 60),
              restSeconds,
            }
          : {
              mode,
              sets: validSets,
              reps: reps.trim() || item.reps || '10-12',
              durationSeconds: null,
              restSeconds,
            },
      );
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível salvar');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Remover "${nomeExercicio(item.exercise)}" do treino?`)) return;
    setBusy(true);
    setError(null);
    try {
      await onRemove(item.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível remover');
      setBusy(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`min-w-0 rounded-xl border border-line bg-paper px-2.5 py-2.5 text-sm ${
        isDragging ? 'opacity-70 shadow-lg' : ''
      }`}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-label="Arrastar pra reordenar"
            className="shrink-0 cursor-grab touch-none select-none px-1 text-lg text-muted2 active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
          <span className="w-5 shrink-0 text-center font-extrabold text-muted2">{item.order}</span>
          <span className="min-w-0 flex-1 break-words font-semibold capitalize leading-snug text-ink2 sm:truncate">
            {nomeExercicio(item.exercise)}
          </span>
        </div>

        {!editing && (
          <div className="flex shrink-0 items-center justify-between gap-2 pl-8 sm:justify-end sm:pl-0">
            <span className="text-xs font-extrabold text-muted2 sm:text-sm">
              {descrevePrescricao(item)}
              {item.restSeconds != null ? ` · ${item.restSeconds}s` : ''}
            </span>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg bg-chip px-2.5 py-1 text-xs font-bold text-ink"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                aria-label="Remover exercício"
                className="rounded-lg bg-chip px-2.5 py-1 text-xs font-bold text-brand disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="mt-2.5 space-y-2.5 border-t border-line pt-2.5 sm:pl-8">
          <div
            className={`grid gap-2 ${
              mode === 'TIME' ? 'grid-cols-2' : 'grid-cols-3'
            }`}
          >
            {mode === 'TIME' ? (
              <Field label="Minutos" value={minutes} onChange={setMinutes} />
            ) : (
              <>
                <Field label="Séries" value={sets} onChange={setSets} />
                <Field label="Reps" value={reps} onChange={setReps} text />
              </>
            )}
            <Field label="Desc. (s)" value={rest} onChange={setRest} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setMode((m) => (m === 'TIME' ? 'REPS' : 'TIME'))}
              className="text-[11px] font-bold text-muted2 underline"
            >
              {mode === 'TIME' ? 'medir por séries e repetições' : 'medir por tempo'}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="rounded-lg border-2 border-ink px-3 py-1.5 text-xs font-extrabold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
              >
                {busy ? '…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {error && <p className="mt-1.5 text-xs font-semibold text-brand sm:pl-8">{error}</p>}
    </div>
  );
}

type SortableExerciseListProps = Parameters<typeof SortableExerciseList>[0];

function Field({
  label,
  value,
  onChange,
  text,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  text?: boolean;
}) {
  return (
    <label className="min-w-0 text-[10px] font-extrabold uppercase tracking-wide text-muted2">
      {label}
      <input
        inputMode={text ? 'text' : 'numeric'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 min-w-0 w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-center text-sm font-extrabold text-ink focus:border-brand focus:outline-none"
      />
    </label>
  );
}
