'use client';

import { triggerHaptic } from '@/lib/haptics';

export interface SegmentedOption<OptionValue extends string> {
  value: OptionValue;
  label: string;
}

/** Abas em "pílula" (ex.: Desafio | Outros treinos). */
export function SegmentedControl<OptionValue extends string>({
  options,
  selectedValue,
  onChange,
}: {
  options: SegmentedOption<OptionValue>[];
  selectedValue: OptionValue;
  onChange: (value: OptionValue) => void;
}) {
  return (
    <div className="flex rounded-2xl bg-chip p-1" role="tablist">
      {options.map((option) => {
        const isSelected = option.value === selectedValue;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => {
              triggerHaptic('light');
              onChange(option.value);
            }}
            className={`flex-1 rounded-xl py-2.5 text-[13.5px] font-extrabold transition ${
              isSelected ? 'bg-card text-ink shadow-sm' : 'text-muted'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
