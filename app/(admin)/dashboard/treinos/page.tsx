'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ConfigExercicio,
  Exercise,
  ExercicioSelecionado,
  Workout,
  WorkoutDetail,
  WorkoutExerciseItem,
} from '@/lib/types';
import { workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { modoSugerido, nomeExercicio } from '@/lib/exercicios/modo';
import { PageHead } from '@/components/dashboard/page-head';
import { ExerciseBrowser } from '@/components/dashboard/exercise-browser';
import { AssigneeSelect } from '@/components/dashboard/assignee-select';
import { SortableExerciseList } from '@/components/dashboard/sortable-exercise-list';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';

type WorkoutListFilter = 'all' | 'in-program' | 'standalone';

const WORKOUT_LIST_FILTERS: { value: WorkoutListFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'in-program', label: 'Em programa' },
  { value: 'standalone', label: 'Avulsos' },
];

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function msg(e: unknown, fallback: string) {
  return e instanceof ApiError ? e.message : fallback;
}

export default function TreinosPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [detail, setDetail] = useState<WorkoutDetail | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingBusy, setCreatingBusy] = useState(false);
  const [name, setName] = useState('');
  const [day, setDay] = useState<number | ''>('');
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [listFilter, setListFilter] = useState<WorkoutListFilter>('all');
  // no desktop o editor fica ao lado da lista; no celular, abre embaixo do treino
  const isWideScreen = useMediaQuery('(min-width: 1024px)');

  const visibleWorkouts = workouts.filter((workout) => {
    const matchesSearch = workout.name
      .toLocaleLowerCase('pt-BR')
      .includes(searchText.trim().toLocaleLowerCase('pt-BR'));
    const matchesFilter =
      listFilter === 'all' || (listFilter === 'in-program' ? Boolean(workout.program) : !workout.program);
    return matchesSearch && matchesFilter;
  });

  const refresh = useCallback(async () => {
    setWorkouts(await workoutsApi.list());
  }, []);

  useEffect(() => {
    refresh().catch((e) => setError(msg(e, 'Não foi possível carregar os treinos')));
  }, [refresh]);

  async function createWorkout() {
    if (!name.trim() || creatingBusy) return;
    setCreatingBusy(true);
    try {
      const w = await workoutsApi.create({
        name: name.trim(),
        dayOfWeek: day === '' ? undefined : Number(day),
      });
      setName('');
      setDay('');
      setCreating(false);
      // o treino JÁ foi criado aqui. Se a recarga da lista falhar, a mensagem
      // tem que falar de recarga — dizer "não foi possível criar" era mentira.
      try {
        await refresh();
        await openDetail(w.id); // já abre pra configurar destinatários/exercícios
      } catch (e) {
        setError(msg(e, 'Treino criado, mas não foi possível recarregar a lista'));
      }
    } catch (e) {
      setError(msg(e, 'Não foi possível criar'));
    } finally {
      setCreatingBusy(false);
    }
  }

  async function openDetail(id: string) {
    try {
      setDetail(await workoutsApi.get(id));
    } catch (e) {
      setError(msg(e, 'Não foi possível abrir o treino'));
    }
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

      <div className="mx-auto max-w-6xl space-y-3 p-4 sm:p-6 md:p-8">
        {error && (
          <div className="rounded-2xl border border-line bg-card p-3 text-sm font-semibold text-brand-ink">
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
              className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
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
                disabled={creatingBusy}
                className="flex-1 rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={createWorkout}
                disabled={creatingBusy || !name.trim()}
                className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
              >
                {creatingBusy ? 'Criando…' : 'Criar'}
              </button>
            </div>
          </div>
        )}

        <div className="grid min-w-0 gap-4 lg:grid-cols-[340px_1fr]">
          <div className="min-w-0 space-y-2.5 lg:self-start">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="🔍 Buscar treino"
              className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-sm font-semibold text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {WORKOUT_LIST_FILTERS.map((workoutListFilter) => (
                <DayChip
                  key={workoutListFilter.value}
                  active={listFilter === workoutListFilter.value}
                  onClick={() => setListFilter(workoutListFilter.value)}
                  label={workoutListFilter.label}
                />
              ))}
            </div>

            {visibleWorkouts.map((w) => {
              const isSelected = detail?.id === w.id;
              return (
                <div
                  key={w.id}
                  className={`min-w-0 overflow-hidden rounded-2xl border bg-card p-3 ${isSelected ? 'border-2 border-brand' : 'border-line'}`}
                >
                  <button
                    className="flex w-full min-w-0 items-center gap-3 text-left"
                    onClick={() => (isSelected ? setDetail(null) : openDetail(w.id))}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chip font-display text-base font-extrabold text-ink">
                      {String.fromCharCode(65 + (workouts.indexOf(w) % 26))}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-extrabold">{w.name}</p>
                        {w.clonedFromId && (
                          <span className="shrink-0 rounded-full bg-chip px-2 py-0.5 text-[10px] font-extrabold text-muted">
                            Portado
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs font-bold text-muted2">
                        {w.program
                          ? `${PROGRAM_TYPE_RULES[w.program.type].icon} ${w.program.name}`
                          : 'Avulso'}
                        {w._count ? ` · ${w._count.exercises} ex.` : ''}
                        {w.dayOfWeek != null ? ` · ${DAYS[w.dayOfWeek]}` : ''}
                        {w.assignees && w.assignees.length > 0
                          ? ` · ${w.assignees.map((a) => a.name.split(' ')[0]).join(', ')}`
                          : ' · sem aluno'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        w.active ? 'bg-done-bg text-done-ink' : 'bg-chip text-muted'
                      }`}
                    >
                      {w.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </button>

                  {isSelected && detail && !isWideScreen && (
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
              );
            })}

            {workouts.length === 0 && !creating && !error && (
              <p className="py-10 text-center text-muted2">Nenhum treino criado ainda.</p>
            )}
            {workouts.length > 0 && visibleWorkouts.length === 0 && (
              <p className="py-6 text-center text-sm text-muted2">Nenhum treino com esse filtro.</p>
            )}
          </div>

          {isWideScreen && (
            <div className="min-w-0 lg:sticky lg:top-6 lg:self-start">
              {detail ? (
                <div className="min-w-0 rounded-2xl border border-line bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-muted2">
                      {detail.program
                        ? `Programa: ${PROGRAM_TYPE_RULES[detail.program.type].icon} ${detail.program.name}`
                        : 'Treino avulso (fora de programa)'}
                    </p>
                    {detail.clonedFromId && (
                      <span className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-extrabold text-muted">
                        Portado de personal anterior
                      </span>
                    )}
                  </div>
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
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-line3 p-10 text-center text-muted2">
                  <p className="text-3xl">📋</p>
                  <p className="mt-2 font-semibold">Selecione um treino para editar</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {picker && detail && (
        <AddExerciseModal
          workout={detail}
          onClose={() => setPicker(false)}
          onAdded={async () => {
            setPicker(false);
            try {
              await openDetail(detail.id);
              await refresh();
            } catch (e) {
              setError(msg(e, 'Exercícios adicionados, mas não foi possível recarregar o treino'));
            }
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(detail.name);
    setConfirmDelete(false);
  }, [detail.id, detail.name]);

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

  async function confirmRemove() {
    setBusy(true);
    try {
      await workoutsApi.remove(detail.id);
      setConfirmDelete(false);
      await onDeleted();
    } catch (e) {
      // 409: tem histórico → orienta a desativar
      onError(msg(e, 'Não foi possível excluir'));
    } finally {
      setBusy(false);
    }
  }

  const reorder = async (ordered: WorkoutExerciseItem[]) => {
    try {
      await workoutsApi.reorder(
        detail.id,
        ordered.map((we, i) => ({ workoutExerciseId: we.id, order: i + 1 })),
      );
      await reload();
    } catch (e) {
      onError(msg(e, 'Não foi possível reordenar os exercícios'));
    }
  };
  const updateEx = async (
    weId: string,
    data: {
      mode?: 'REPS' | 'TIME';
      sets?: number;
      reps?: string | null;
      durationSeconds?: number | null;
      restSeconds?: number | null;
    },
  ) => {
    try {
      await workoutsApi.updateExercise(detail.id, weId, data);
      await reload();
    } catch (e) {
      const m = msg(e, 'Não foi possível atualizar o exercício');
      onError(m);
      throw new Error(m);
    }
  };
  const removeEx = async (weId: string) => {
    try {
      await workoutsApi.removeExercise(detail.id, weId);
      await reload();
    } catch (e) {
      const m = msg(e, 'Não foi possível remover o exercício');
      onError(m);
      throw new Error(m);
    }
  };

  return (
    <div className="mt-3 min-w-0 space-y-4 border-t border-line pt-3">
      {/* nome + dia + ativo */}
      <div className="space-y-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className="w-full rounded-xl border border-line bg-paper px-3.5 py-2 text-base font-extrabold text-ink focus:border-brand focus:outline-none"
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
          <span className="mx-1 hidden h-5 w-px bg-line sm:inline-block" />
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
      <div className="min-w-0">
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
      <div className="space-y-2 border-t border-line pt-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={duplicate}
            disabled={busy}
            className="min-w-[120px] flex-1 rounded-xl bg-chip py-2.5 text-sm font-extrabold text-ink disabled:opacity-50"
          >
            Duplicar treino
          </button>
          <button
            onClick={() => setConfirmDelete((v) => !v)}
            disabled={busy}
            className="min-w-[120px] flex-1 rounded-xl bg-chip py-2.5 text-sm font-extrabold text-brand-ink disabled:opacity-50"
          >
            Excluir treino
          </button>
        </div>
        {confirmDelete && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand/30 bg-paper p-3">
            <p className="text-xs font-bold text-ink">
              Excluir &ldquo;{detail.name}&rdquo;? Essa ação não pode ser desfeita.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border border-line px-3 py-1.5 text-xs font-extrabold text-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmRemove()}
                className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-extrabold text-white disabled:opacity-50"
              >
                {busy ? 'Excluindo…' : 'Sim, excluir'}
              </button>
            </div>
          </div>
        )}
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
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
        active ? 'bg-brand text-white shadow-sm' : 'bg-chip text-muted hover:text-ink'
      }`}
    >
      {label}
    </button>
  );
}

/** Defaults do painel inline: quem só quer marcar vários não precisa digitar nada. */
const CONFIG_PADRAO: Omit<ConfigExercicio, 'mode'> = {
  sets: '3',
  reps: '10-12',
  minutes: '20',
  rest: '60',
};

/**
 * Picker de exercícios com **seleção múltipla** (E7).
 *
 * Antes: escolher um exercício trocava a tela inteira pelo formulário de
 * séries/reps, e voltar zerava filtro, busca e página — montar um treino de 8
 * exercícios eram 8 idas e voltas. Agora a configuração abre embaixo do próprio
 * card, a seleção mora aqui (não na lista), então atravessa páginas e filtros, e
 * tudo entra de uma vez num único POST transacional.
 */
function AddExerciseModal({
  workout,
  onClose,
  onAdded,
}: {
  workout: WorkoutDetail;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [selecionados, setSelecionados] = useState<Map<string, ExercicioSelecionado>>(
    () => new Map(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onToggle = useCallback((ex: Exercise) => {
    setSelecionados((atual) => {
      const proximo = new Map(atual);
      if (proximo.has(ex.id)) proximo.delete(ex.id);
      else
        proximo.set(ex.id, {
          exercise: ex,
          // E10 — cardio já entra medido em tempo; o admin pode trocar no painel
          config: { ...CONFIG_PADRAO, mode: modoSugerido(ex) },
        });
      return proximo;
    });
  }, []);

  const onConfig = useCallback((exerciseId: string, patch: Partial<ConfigExercicio>) => {
    setSelecionados((atual) => {
      const item = atual.get(exerciseId);
      if (!item) return atual;
      const proximo = new Map(atual);
      proximo.set(exerciseId, { ...item, config: { ...item.config, ...patch } });
      return proximo;
    });
  }, []);

  // Map preserva ordem de inserção → a ordem no treino é a ordem em que o admin marcou
  const escolhidos = Array.from(selecionados.values());

  async function confirmar() {
    if (escolhidos.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await workoutsApi.addExercisesBatch(
        workout.id,
        escolhidos.map(({ exercise, config }) => {
          const restTrimmed = config.rest.trim();
          const rest = restTrimmed === '' ? NaN : Number(restTrimmed);
          const restSeconds =
            Number.isFinite(rest) && rest >= 0 ? Math.round(rest) : undefined;

          if (config.mode === 'TIME') {
            const min = Number(config.minutes);
            return {
              exerciseId: exercise.id,
              mode: 'TIME' as const,
              durationSeconds: Math.round(
                (Number.isFinite(min) && min > 0 ? min : 20) * 60,
              ),
              restSeconds,
            };
          }
          const parsedSets = Math.round(Number(config.sets));
          return {
            exerciseId: exercise.id,
            mode: 'REPS' as const,
            sets: Number.isFinite(parsedSets) && parsedSets >= 1 ? parsedSets : 3,
            reps: config.reps.trim() || '10-12',
            restSeconds,
          };
        }),
      );
      onAdded();
    } catch (e) {
      setError(msg(e, 'Não foi possível adicionar'));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escolher exercícios"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 md:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-3xl bg-paper md:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
          <h2 className="font-display text-[22px] font-extrabold">Escolher exercícios</h2>
          <button
            onClick={onClose}
            className="rounded-full bg-chip px-3 py-1.5 text-xs font-bold text-muted"
          >
            Fechar
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <ExerciseBrowser selecao={{ itens: selecionados, onToggle, onConfig }} />
        </div>

        {/* barra fixa: a seleção continua visível mesmo com a lista rolada ou filtrada */}
        <div className="shrink-0 space-y-2.5 rounded-b-3xl border-t border-line bg-paper p-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {escolhidos.length > 0 && (
            <div className="flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
              {escolhidos.map(({ exercise }) => (
                <button
                  key={exercise.id}
                  onClick={() => onToggle(exercise)}
                  title="Remover da seleção"
                  className="flex max-w-full items-center gap-1 rounded-full bg-chip px-2.5 py-1 text-[11px] font-bold capitalize text-ink"
                >
                  <span className="truncate">{nomeExercicio(exercise)}</span>
                  <span className="text-muted2">×</span>
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-sm font-semibold text-brand-ink">{error}</p>}

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted2">
              {escolhidos.length === 0
                ? 'Nenhum selecionado'
                : `${escolhidos.length} selecionado${escolhidos.length > 1 ? 's' : ''}`}
            </span>
            <button
              onClick={confirmar}
              disabled={busy || escolhidos.length === 0}
              className="ml-auto rounded-xl bg-brand px-5 py-2.5 text-sm font-extrabold text-white shadow-brand disabled:opacity-50"
            >
              {busy ? 'Adicionando…' : 'Adicionar ao treino'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
