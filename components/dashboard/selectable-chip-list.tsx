'use client';

export interface SelectableChipOption {
  id: string;
  label: string;
}

/** Lista de chips liga/desliga — usada para escolher treinos e alunos. */
export function SelectableChipList({
  title,
  options,
  selectedIds,
  onToggle,
  emptyMessage,
  disabled = false,
}: {
  title: string;
  options: SelectableChipOption[] | null;
  selectedIds: Set<string>;
  onToggle: (optionId: string) => void;
  emptyMessage: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted2">{title}</p>
      {options === null && <p className="text-sm text-muted2">Carregando…</p>}
      {options?.length === 0 && <p className="text-sm text-muted2">{emptyMessage}</p>}
      <div className="flex flex-wrap gap-1.5">
        {options?.map((option) => {
          const isSelected = selectedIds.has(option.id);
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(option.id)}
              aria-pressed={isSelected}
              className={`max-w-full rounded-full px-3 py-1.5 text-left text-xs font-bold transition disabled:opacity-60 ${
                isSelected ? 'bg-brand text-white shadow-brand' : 'bg-chip text-muted'
              }`}
            >
              {isSelected ? '✓ ' : ''}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Devolve um novo Set com o id adicionado ou removido. */
export function toggleIdInSet(currentIds: Set<string>, toggledId: string): Set<string> {
  const nextIds = new Set(currentIds);
  if (nextIds.has(toggledId)) nextIds.delete(toggledId);
  else nextIds.add(toggledId);
  return nextIds;
}
