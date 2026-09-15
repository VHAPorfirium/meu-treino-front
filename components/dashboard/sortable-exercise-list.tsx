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
import { descrevePrescricao } from '@/lib/exercicios/modo';

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

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const restSeconds = rest.trim() === '' ? null : Math.max(0, Number(rest) || 0);
      // E10 — os dois modos são exclusivos: TIME zera `reps`, REPS zera a duração,
      // pra não deixar no banco uma linha do tipo "3 × 10 durante 20 min".
      await onUpdate(
        item.id,
        mode === 'TIME'
          ? {
              mode,
              sets: 1,
              reps: null,
              durationSeconds: Math.round(Math.max(1, Number(minutes) || 20) * 60),
              restSeconds,
            }
          : {
              mode,
              sets: Math.max(1, Number(sets) || item.sets),
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
    if (!confirm(`Remover "${item.exercise.name}" do treino?`)) return;
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
      className={`rounded-xl border border-line bg-paper px-2 py-2 text-sm ${
        isDragging ? 'opacity-70 shadow-lg' : ''
      }`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Arrastar pra reordenar"
          className="cursor-grab touch-none select-none px-1.5 text-lg text-muted2 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <span className="w-6 shrink-0 text-center font-extrabold text-muted2">{item.order}</span>
        <span className="min-w-0 flex-1 truncate capitalize font-semibold text-ink2">
          {item.exercise.name}
        </span>
        {!editing && (
          <>
            <span className="shrink-0 font-extrabold text-muted2">
              {descrevePrescricao(item)}
              {item.restSeconds != null ? ` · ${item.restSeconds}s` : ''}
            </span>
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
          </>
        )}
      </div>

      {editing && (
        <div className="mt-2 pl-8">
          <div className="grid grid-cols-[1fr_1fr_1fr_auto_auto] items-end gap-2">
            {mode === 'TIME' ? (
              <>
                <Field label="Minutos" value={minutes} onChange={setMinutes} />
                <span />
              </>
            ) : (
              <>
                <Field label="Séries" value={sets} onChange={setSets} />
                <Field label="Reps" value={reps} onChange={setReps} text />
              </>
            )}
            <Field label="Desc. (s)" value={rest} onChange={setRest} />
            <button
              type="button"
              onClick={() => setEditing(false)}
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
          <button
            type="button"
            onClick={() => setMode((m) => (m === 'TIME' ? 'REPS' : 'TIME'))}
            className="mt-1.5 text-[11px] font-bold text-muted2 underline"
          >
            {mode === 'TIME' ? 'medir por séries e repetições' : 'medir por tempo'}
          </button>
        </div>
      )}
      {error && <p className="mt-1 pl-8 text-xs font-semibold text-brand">{error}</p>}
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
    <label className="text-[10px] font-extrabold uppercase tracking-wide text-muted2">
      {label}
      <input
        inputMode={text ? 'text' : 'numeric'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-lg border border-line2 bg-white px-2 py-1.5 text-center text-sm font-extrabold text-ink"
      />
    </label>
  );
}
