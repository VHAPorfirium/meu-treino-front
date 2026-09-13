'use client';

import { useEffect, useState } from 'react';
import type { Exercise, Workout, WorkoutDetail } from '@/lib/types';
import { workoutsApi } from '@/lib/api/endpoints';
import { PageHead } from '@/components/dashboard/page-head';
import { ExerciseBrowser } from '@/components/dashboard/exercise-browser';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function TreinosPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [day, setDay] = useState<number | ''>('');
  const [picker, setPicker] = useState(false);

  async function refresh() {
    setWorkouts(await workoutsApi.list());
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function createWorkout() {
    if (!name.trim()) return;
    await workoutsApi.create({
      name: name.trim(),
      dayOfWeek: day === '' ? undefined : Number(day),
    });
    setName('');
    setDay('');
    setCreating(false);
    await refresh();
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
                <DayChip
                  key={d}
                  active={day === i}
                  onClick={() => setDay(i)}
                  label={d}
                />
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
              onClick={() =>
                detail?.id === w.id ? setDetail(null) : openDetail(w.id)
              }
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-chip font-display text-base font-extrabold text-ink">
                {String.fromCharCode(65 + (idx % 26))}
              </div>
              <div className="flex-1 text-left">
                <p className="font-extrabold">{w.name}</p>
                <p className="text-[13px] font-semibold text-muted2">
                  {w.dayOfWeek != null ? DAYS[w.dayOfWeek] : 'Sem dia fixo'}
                  {w._count ? ` · ${w._count.exercises} exercícios` : ''}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                  w.active ? 'bg-done-bg text-done-ink' : 'bg-chip text-muted'
                }`}
              >
                {w.active ? 'Ativo' : 'Inativo'}
              </span>
              <span className="text-muted2">{detail?.id === w.id ? '▲' : '▼'}</span>
            </button>

            {detail?.id === w.id && (
              <div className="mt-3 space-y-2 border-t border-line pt-3">
                {detail.exercises.length === 0 && (
                  <p className="text-sm text-muted2">Sem exercícios ainda.</p>
                )}
                {detail.exercises.map((we) => (
                  <div
                    key={we.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2 text-sm"
                  >
                    <span className="capitalize font-semibold text-ink2">
                      {we.order}. {we.exercise.name}
                    </span>
                    <span className="shrink-0 font-extrabold text-muted2">
                      {we.sets}×{we.reps}
                    </span>
                  </div>
                ))}
                <button
                  onClick={() => setPicker(true)}
                  className="mt-1 w-full rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold"
                >
                  + Adicionar exercício
                </button>
              </div>
            )}
          </div>
        ))}

        {workouts.length === 0 && !creating && (
          <p className="py-10 text-center text-muted2">
            Nenhum treino criado ainda.
          </p>
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

  async function confirm() {
    if (!picked) return;
    setBusy(true);
    try {
      await workoutsApi.addExercise(workout.id, {
        exerciseId: picked.id,
        order: workout.exercises.length + 1,
        sets: Number(sets) || 3,
        reps: reps || '10-12',
        restSeconds: rest ? Number(rest) : undefined,
      });
      onAdded();
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
          <button onClick={onClose} className="rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted">
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
