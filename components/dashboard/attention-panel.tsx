'use client';

import Link from 'next/link';
import type { AttentionItem } from '@/lib/types';
import { TraineeAvatar } from './trainee-avatar';

/** "Precisa de atenção": quem parou de treinar ou vive pulando o mesmo exercício. */
export function AttentionPanel({
  attentionItems,
  hasTrainees = true,
}: {
  attentionItems: AttentionItem[] | null;
  hasTrainees?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-line bg-card p-5">
      <h2 className="mb-3 text-base font-extrabold">⚠️ Precisa de atenção</h2>
      {attentionItems === null && <p className="text-sm text-muted2">Carregando…</p>}
      {attentionItems?.length === 0 && (
        <p className="text-sm text-muted2">
          {hasTrainees
            ? 'Tudo certo: todo mundo treinando em dia 💪'
            : 'Nenhum aluno vinculado ainda. Vincule alunos na aba Alunos para acompanhar alertas.'}
        </p>
      )}
      <div className="divide-y divide-line">
        {attentionItems?.map((attentionItem) => (
          <div key={`${attentionItem.userId}-${attentionItem.kind}`} className="flex items-center gap-3 py-2.5">
            <TraineeAvatar name={attentionItem.userName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-extrabold">{attentionItem.userName}</p>
              <p
                className={`truncate text-xs font-bold ${
                  attentionItem.kind === 'inactive' ? 'text-skip' : 'text-muted2'
                }`}
              >
                {attentionItem.description}
              </p>
            </div>
            <Link
              href={`/dashboard/alunos?aluno=${attentionItem.userId}`}
              className="shrink-0 rounded-full bg-chip px-2.5 py-1 text-[11px] font-extrabold text-muted"
            >
              {attentionItem.kind === 'inactive' ? 'Recado' : 'Ver'}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
