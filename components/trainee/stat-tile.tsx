import type { ReactNode } from 'react';

/** Número grande + legenda (ex.: "14 · treinos no mês"). */
export function StatTile({ value, label, valueClassName = '' }: { value: ReactNode; label: string; valueClassName?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-3">
      <p className={`font-display text-[24px] font-extrabold leading-tight text-ink ${valueClassName}`}>{value}</p>
      <p className="text-[11.5px] font-bold text-muted2">{label}</p>
    </div>
  );
}
