'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Exercise, Workout, WorkoutDetail, WorkoutExerciseItem } from '@/lib/types';
import { workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { PageHead } from '@/components/dashboard/page-head';
import { ExerciseBrowser } from '@/components/dashboard/exercise-browser';
import { AssigneeSelect } from '@/components/dashboard/assignee-select';
import { SortableExerciseList } from '@/components/dashboard/sortable-exercise-list';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function msg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

export default function TreinosPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [day, setDay] = useState<number | ''>('');
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setWorkouts(await workoutsApi.list());
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(msg(e, 'Não foi possível carregar os treinos')));
  }, [refresh]);

  async function createWorkout() {
    if (!name.trim()) return;
    try {
      const w = await workoutsApi.create({
        name: name.trim(),
        dayOfWeek: day === '' ? undefined : Number(day),
      });
      setName('');
      setDay('');
      setCreating(false);
      await refresh();
      await openDetail(w.id); // já abre pra configurar destinatários/exercícios
    } catch (e) {
      setError(msg(e, 'Não foi possível criar'));
    }
  }

  async function openDetail(id: string) {
    setDetail(await workoutsApi.get(id));
  }

  return (
    <>
      <PageHead
        eyebrow="Programação"
        title="Treinos"
        actions={
          <button
            onClick={() => setCreating((c) => !c)}
            className="rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand"
          >
            + Criar treino
          </button>
        }
      />

      <div className="mx-auto max-w-3xl space-y-3 p-6 md:p-8">
        {error && (
          <div className="rounded-2xl border border-line bg-card p-3 text-sm font-semibold text-brand">
            {error}{' '}
            <button onClick={() => setError(null)} className="ml-2 underline">
              fechar
            </button>
          </div>
        )}

        {creating && (
          <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome (ex: Treino A - Inferiores)"
              className="w-full rounded-xl border border-line2 bg-white px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-faint"
            />
            <div className="flex flex-wrap gap-1.5">
              <DayChip active={day === ''} onClick={() => setDay('')} label="Sem dia" />
              {DAYS.map((d, i) => (
                <DayChip key={d} active={day === i} onClick={() => setDay(i)} label={d} />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCreating(false)}
                className="flex-1 rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold"
              >
                Cancelar
              </button>
              <button
                onClick={createWorkout}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white"
              >
                Criar
              </button>
            </div>
          </div>
        )}

        {workouts.map((w, idx) => (
          <div key={w.id} className="rounded-2xl border border-line bg-card p-4">
            <button
              className="flex w-full items-center gap-4"
              onClick={() => (detail?.id === w.id ? setDetail(null) : openDetail(w.id))}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chip font-display text-base font-extrabold text-ink">
                {String.fromCharCode(65 + (idx % 26))}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate font-extrabold">{w.name}</p>
                <p className="text-[13px] font-semibold text-muted2">
                  {w.dayOfWeek != null ? DAYS[w.dayOfWeek] : 'Sem dia fixo'}
                  {w._count ? ` · ${w._count.exercises} exercícios` : ''}
                  {w.assignees && w.assignees.length > 0
                    ? ` · ${w.assignees.map((a) => a.name.split(' ')[0]).join(', ')}`
                    : ' · sem aluno'}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-extrabold ${
                  w.active ? 'bg-done-bg text-done-ink' : 'bg-chip text-muted'
                }`}
              >
                {w.active ? 'Ativo' : 'Inativo'}
              </span>
              <span className="text-muted2">{detail?.id === w.id ? '▲' : '▼'}</span>
            </button>

            {detail?.id === w.id && (
              <WorkoutEditor
                detail={detail}
                onChanged={async (d) => {
                  setDetail(d);
                  await refresh();
                }}
                onDeleted={async () => {
                  setDetail(null);
                  await refresh();
                }}
                onAddExercise={() => setPicker(true)}
                onError={setError}
              />
            )}
          </div>
        ))}

        {workouts.length === 0 && !creating && (
          <p className="py-10 text-center text-muted2">Nenhum treino criado ainda.</p>
        )}
      </div>

      {picker && detail && (
        <AddExerciseModal
          workout={detail}
          onClose={() => setPicker(false)}
          onAdded={async () => {
            setPicker(false);
            await openDetail(detail.id);
            await refresh();
          }}
        />
      )}
    </>
  );
}

/** Painel expandido de um treino: nome/dia/ativo, destinatários, exercícios, duplicar/excluir. */
function WorkoutEditor({
  detail,
  onChanged,
  onDeleted,
  onAddExercise,
  onError,
}: {
  detail: WorkoutDetail;
  onChanged: (d: WorkoutDetail) => Promise<void>;
  onDeleted: () => Promise<void>;
  onAddExercise: () => void;
  onError: (m: string) => void;
}) {
  const [name, setName] = useState(detail.name);
  const [busy, setBusy] = useState(false);

  useEffect(() => setName(detail.name), [detail.id, detail.name]);

  async function reload() {
    await onChanged(await workoutsApi.get(detail.id));
  }

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    try {
      await fn();
      await reload();
    } catch (e) {
      onError(msg(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  const saveName = () => {
    const n = name.trim();
    if (!n || n === detail.name) return;
    void run(() => workoutsApi.update(detail.id, { name: n }), 'Não foi possível renomear');
  };
  const setDayOfWeek = (d: number | null) =>
    run(() => workoutsApi.update(detail.id, { dayOfWeek: d }), 'Não foi possível mudar o dia');
  const toggleActive = () =>
    run(
      () => workoutsApi.update(detail.id, { active: !detail.active }),
      'Não foi possível alterar o status',
    );
  const duplicate = () =>
    run(() => workoutsApi.duplicate(detail.id), 'Não foi possível duplicar');

  async function remove() {
    if (!confirm(`Excluir o treino "${detail.name}"? Essa ação não pode ser desfeita.`)) return;
    setBusy(true);
    try {
      await workoutsApi.remove(detail.id);
      await onDeleted();
    } catch (e) {
      // 409: tem histórico → orienta a desativar
      onError(msg(e, 'Não foi possível excluir'));
    } finally {
      setBusy(false);
    }
  }

  const reorder = async (ordered: WorkoutExerciseItem[]) => {
    await workoutsApi.reorder(
      detail.id,
      ordered.map((we, i) => ({ workoutExerciseId: we.id, order: i + 1 })),
    );
    await reload();
  };
  const updateEx = async (
    weId: string,
    data: { sets?: number; reps?: string; restSeconds?: number | null },
  ) => {
    await workoutsApi.updateExercise(detail.id, weId, data);
    await reload();
  };
  const removeEx = async (weId: string) => {
    await workoutsApi.removeExercise(detail.id, weId);
    await reload();
  };

  return (
    <div className="mt-3 space-y-4 border-t border-line pt-3">
      {/* nome + dia + ativo */}
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded-xl border border-line2 bg-white px-3.5 py-2 text-base font-extrabold text-ink"
          aria-label="Nome do treino"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <DayChip
            active={detail.dayOfWeek == null}
            onClick={() => setDayOfWeek(null)}
            label="Sem dia"
          />
          {DAYS.map((d, i) => (
            <DayChip
              key={d}
              active={detail.dayOfWeek === i}
              onClick={() => setDayOfWeek(i)}
              label={d}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <button
            onClick={toggleActive}
            disabled={busy}
            className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
              detail.active ? 'bg-done-bg text-done-ink' : 'bg-chip text-muted'
            }`}
          >
            {detail.active ? 'Ativo' : 'Inativo'}
          </button>
        </div>
      </div>

      {/* destinatários (E1.1) */}
      <AssigneeSelect
        workoutId={detail.id}
        value={detail.assignees ?? []}
        onChange={(assignees) => void onChanged({ ...detail, assignees })}
      />

      {/* exercícios (E1/E2) */}
      <div>
        <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted2">
          Exercícios {detail.exercises.length > 1 ? '· arraste pra reordenar' : ''}
        </p>
        {detail.exercises.length === 0 && (
          <p className="text-sm text-muted2">Sem exercícios ainda.</p>
        )}
        <SortableExerciseList
          items={detail.exercises}
          onReorder={reorder}
          onUpdate={updateEx}
          onRemove={removeEx}
        />
        <button
          onClick={onAddExercise}
          className="mt-2 w-full rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold"
        >
          + Adicionar exercício
        </button>
      </div>

      {/* ações */}
      <div className="flex gap-2 border-t border-line pt-3">
        <button
          onClick={duplicate}
          disabled={busy}
          className="flex-1 rounded-xl bg-chip py-2.5 text-sm font-extrabold text-ink disabled:opacity-50"
        >
          Duplicar treino
        </button>
        <button
          onClick={remove}
          disabled={busy}
          className="flex-1 rounded-xl bg-chip py-2.5 text-sm font-extrabold text-brand disabled:opacity-50"
        >
          Excluir treino
        </button>
      </div>
    </div>
  );
}

function DayChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold ${
        active ? 'bg-ink text-white' : 'bg-chip text-muted'
      }`}
    >
      {label}
    </button>
  );
}

function AddExerciseModal({
  workout,
  onClose,
  onAdded,
}: {
  workout: WorkoutDetail;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [picked, setPicked] = useState<Exercise | null>(null);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10-12');
  const [rest, setRest] = useState('60');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await workoutsApi.addExercise(workout.id, {
        exerciseId: picked.id,
        order: workout.exercises.length + 1,
        sets: Number(sets) || 3,
        reps: reps || '10-12',
        restSeconds: rest ? Number(rest) : undefined,
      });
      onAdded();
    } catch (e) {
      setError(msg(e, 'Não foi possível adicionar'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/55 md:items-center">
      <div className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-paper p-5 md:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-extrabold">
            {picked ? 'Configurar' : 'Escolher exercício'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted"
          >
            Fechar
          </button>
        </div>

        {!picked && <ExerciseBrowser onPick={setPicked} />}

        {picked && (
          <div className="space-y-4">
            <p className="capitalize font-extrabold text-ink">{picked.name}</p>
            <div className="grid grid-cols-3 gap-2">
              <NumField label="Séries" value={sets} onChange={setSets} />
              <NumField label="Reps" value={reps} onChange={setReps} text />
              <NumField label="Descanso (s)" value={rest} onChange={setRest} />
            </div>
            {error && <p className="text-sm font-semibold text-brand">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => setPicked(null)}
                className="flex-1 rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold"
              >
                Voltar
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {busy ? 'Adicionando…' : 'Adicionar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({
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
    <label className="text-[11px] font-extrabold uppercase tracking-wide text-muted2">
      {label}
      <input
        inputMode={text ? 'text' : 'numeric'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-line2 bg-white px-3 py-2 text-center text-base font-extrabold text-ink"
      />
    </label>
  );
}
