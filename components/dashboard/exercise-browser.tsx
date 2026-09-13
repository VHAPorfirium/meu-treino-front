'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { Exercise, MuscleGroup } from '@/lib/types';
import { exercisesApi, muscleGroupsApi } from '@/lib/api/endpoints';

const STRIPE =
  'repeating-linear-gradient(135deg,#EFE7DC 0 6px,#E5DBCE 6px 12px)';

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

  useEffect(() => {
    muscleGroupsApi.list().then(setGroups).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setLoading(true);
    exercisesApi
      .list({ muscleGroup: group || undefined, search: debounced || undefined })
      .then((r) => setItems(r.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [group, debounced]);

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

      {!loading && items.length === 0 && (
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
