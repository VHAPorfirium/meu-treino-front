'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { Exercise, MuscleGroup } from '@/lib/types';
import { exercisesApi, muscleGroupsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';

const STRIPE =
  'repeating-linear-gradient(135deg,#EFE7DC 0 6px,#E5DBCE 6px 12px)';

function errorMessage(e: unknown): string {
  return e instanceof ApiError
    ? `${e.message} (HTTP ${e.status})`
    : 'Falha de rede — verifique sua conexão.';
}

export function ExerciseBrowser({
  onPick,
}: {
  onPick?: (ex: Exercise) => void;
}) {
  const [groups, setGroups] = useState<MuscleGroup[]>([]);
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [items, setItems] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  // Erro real da requisição — antes era engolido e virava "Nada encontrado".
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0); // incrementa pra "tentar de novo"

  useEffect(() => {
    muscleGroupsApi
      .list()
      .then(setGroups)
      .catch((e) => setError(errorMessage(e)));
  }, [attempt]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    exercisesApi
      .list({ muscleGroup: group || undefined, search: debounced || undefined })
      .then((r) => setItems(r.items))
      .catch((e) => {
        setItems([]);
        setError(errorMessage(e));
      })
      .finally(() => setLoading(false));
  }, [group, debounced, attempt]);

  const chips = useMemo(
    () => [{ id: '', name: '', displayName: 'Todos', exerciseCount: 0 }, ...groups],
    [groups],
  );

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nome ou equipamento…"
        className="mb-3 w-full rounded-xl border border-line2 bg-card px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-faint"
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {chips.map((g) => (
          <button
            key={g.id || 'all'}
            onClick={() => setGroup(g.name)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
              group === g.name ? 'bg-ink text-white' : 'bg-chip text-muted'
            }`}
          >
            {g.displayName}
          </button>
        ))}
      </div>

      {loading && <p className="py-6 text-center text-muted2">Carregando…</p>}

      {!loading && error && (
        <div className="my-4 rounded-2xl border border-line bg-card p-4 text-center">
          <p className="text-sm font-extrabold text-brand">
            Não foi possível carregar o catálogo.
          </p>
          <p className="mt-1 text-xs font-semibold text-muted2">{error}</p>
          <button
            onClick={() => setAttempt((n) => n + 1)}
            className="mt-3 rounded-full bg-ink px-4 py-2 text-xs font-bold text-white"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {onPick ? (
        <div className="space-y-2">
          {items.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center gap-3 rounded-2xl border border-line bg-card p-2.5"
            >
              <Thumb url={ex.thumbnailUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold capitalize">{ex.name}</p>
                <p className="text-xs font-semibold capitalize text-muted2">
                  {ex.target} · {ex.equipment ?? '—'}
                </p>
              </div>
              <button
                onClick={() => onPick(ex)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-chip text-lg font-extrabold text-ink"
              >
                +
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((ex) => (
            <div
              key={ex.id}
              className="overflow-hidden rounded-2xl border border-line bg-card"
            >
              {ex.thumbnailUrl ? (
                <Image
                  src={ex.thumbnailUrl}
                  alt={ex.name}
                  width={200}
                  height={120}
                  className="h-24 w-full bg-white object-cover"
                  unoptimized
                />
              ) : (
                <div className="h-24" style={{ background: STRIPE }} />
              )}
              <div className="p-3">
                <p className="truncate text-[13px] font-extrabold capitalize leading-tight">
                  {ex.name}
                </p>
                <p className="mt-1 text-[11px] font-semibold capitalize text-muted2">
                  {ex.equipment ?? '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="py-8 text-center text-muted2">Nada encontrado.</p>
      )}
    </div>
  );
}

function Thumb({ url }: { url: string | null }) {
  return url ? (
    <Image
      src={url}
      alt=""
      width={44}
      height={44}
      className="h-11 w-11 rounded-xl bg-white object-cover"
      unoptimized
    />
  ) : (
    <div className="h-11 w-11 rounded-xl" style={{ background: STRIPE }} />
  );
}
