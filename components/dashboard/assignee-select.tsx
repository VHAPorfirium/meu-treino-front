'use client';

import { useEffect, useState } from 'react';
import type { Assignee, UserSummary } from '@/lib/types';
import { usersApi, workoutsApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';

/**
 * E1.1 — "Pra quem é este treino?" Multi-select de alunos (TRAINEE) com salvamento
 * imediato via PUT /workouts/:id/assignees (conjunto inteiro, idempotente).
 */
export function AssigneeSelect({
  workoutId,
  value,
  onChange,
}: {
  workoutId: string;
  value: Assignee[];
  onChange: (assignees: Assignee[]) => void;
}) {
  const [trainees, setTrainees] = useState<UserSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    usersApi
      .list({ role: 'TRAINEE' })
      .then(setTrainees)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Falha ao carregar alunos'));
  }, []);

  const selected = new Set(value.map((a) => a.id));

  async function toggle(u: UserSummary) {
    const next = selected.has(u.id)
      ? value.filter((a) => a.id !== u.id)
      : [...value, { id: u.id, name: u.name }];
    setBusy(true);
    setError(null);
    try {
      const res = await workoutsApi.setAssignees(workoutId, next.map((a) => a.id));
      onChange(res.assignees);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Não foi possível salvar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted2">
        Pra quem é este treino
      </p>
      {trainees === null && !error && (
        <p className="text-sm text-muted2">Carregando alunos…</p>
      )}
      {trainees && trainees.length === 0 && (
        <p className="text-sm text-muted2">Nenhum aluno cadastrado.</p>
      )}
      <div className="flex flex-wrap gap-1.5">
        {trainees?.map((u) => {
          const on = selected.has(u.id);
          return (
            <button
              key={u.id}
              type="button"
              disabled={busy}
              onClick={() => toggle(u)}
              aria-pressed={on}
              className={`rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-60 ${
                on ? 'bg-brand text-white shadow-brand' : 'bg-chip text-muted'
              }`}
            >
              {on ? '✓ ' : ''}
              {u.name}
            </button>
          );
        })}
      </div>
      {value.length === 0 && trainees && trainees.length > 0 && (
        <p className="mt-1.5 text-xs font-semibold text-brand">
          Sem destinatário: nenhum aluno vê este treino.
        </p>
      )}
      {error && <p className="mt-1.5 text-xs font-semibold text-brand">{error}</p>}
    </div>
  );
}
