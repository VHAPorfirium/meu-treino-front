'use client';

import { useEffect, useState } from 'react';
import type { UserSummary } from '@/lib/types';
import { usersApi } from '@/lib/api/endpoints';

/**
 * Filtro por aluno das telas de acompanhamento (dashboard e evolução).
 *
 * `value === ''` significa **todos os alunos somados**. O aviso existe porque no
 * modo agregado "sequência" e o mapa de frequência mudam de sentido: viram
 * "dias em que alguém treinou", não a constância de uma pessoa.
 *
 * Some da tela quando não há nenhum aluno cadastrado — um filtro de um item só
 * é ruído.
 */
export function FiltroAluno({
  value,
  onChange,
}: {
  value: string;
  onChange: (userId: string) => void;
}) {
  const [alunos, setAlunos] = useState<UserSummary[]>([]);

  useEffect(() => {
    usersApi
      .list({ role: 'TRAINEE' })
      .then(setAlunos)
      .catch(() => {});
  }, []);

  if (alunos.length === 0) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip ativo={value === ''} onClick={() => onChange('')} label="Todos os alunos" />
        {alunos.map((a) => (
          <Chip
            key={a.id}
            ativo={value === a.id}
            onClick={() => onChange(a.id)}
            label={a.name.split(' ')[0]}
          />
        ))}
      </div>
      {value === '' && alunos.length > 1 && (
        <p className="mt-1.5 text-[11px] font-semibold text-muted2">
          Somando as sessões de todos os alunos — aqui “sequência” e o mapa de
          frequência querem dizer “dias em que alguém treinou”.
        </p>
      )}
    </div>
  );
}

/** Nome do aluno selecionado, pro título da página. `null` = todos. */
export function useNomeAluno(userId: string): string | null {
  const [nome, setNome] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setNome(null);
      return;
    }
    let cancelado = false;
    usersApi
      .list({ role: 'TRAINEE' })
      .then((lista) => {
        if (cancelado) return;
        setNome(lista.find((a) => a.id === userId)?.name ?? null);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [userId]);

  return nome;
}

function Chip({
  ativo,
  onClick,
  label,
}: {
  ativo: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={ativo}
      className={`rounded-full px-3.5 py-1.5 text-xs font-bold capitalize transition ${
        ativo ? 'bg-ink text-white' : 'bg-chip text-muted'
      }`}
    >
      {label}
    </button>
  );
}
