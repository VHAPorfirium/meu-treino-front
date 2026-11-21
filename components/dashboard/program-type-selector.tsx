'use client';

import type { ProgramType } from '@/lib/types';
import {
  PROGRAM_TYPE_RULES,
  PROGRAM_TYPES_IN_DISPLAY_ORDER,
} from '@/lib/programs/program-type-rules';

/** Os 3 cards que definem se é treino normal constante, mesociclo ou desafio. */
export function ProgramTypeSelector({
  selectedProgramType,
  onChange,
}: {
  selectedProgramType: ProgramType;
  onChange: (programType: ProgramType) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted2">
        Tipo de programa
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        {PROGRAM_TYPES_IN_DISPLAY_ORDER.map((programType) => {
          const programTypeRule = PROGRAM_TYPE_RULES[programType];
          const isSelected = programType === selectedProgramType;
          return (
            <button
              key={programType}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(programType)}
              className={`rounded-2xl border-2 p-3 text-left transition ${
                isSelected ? 'border-brand bg-paper' : 'border-line bg-card hover:bg-chip'
              }`}
            >
              <p className="text-xl">{programTypeRule.icon}</p>
              <p className="mt-1 text-sm font-extrabold text-ink">{programTypeRule.label}</p>
              <p className="text-xs font-semibold text-muted2">{programTypeRule.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
