import type { ProgramType } from '@/lib/types';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';

export function ProgramTypeBadge({ programType }: { programType: ProgramType }) {
  const programTypeRule = PROGRAM_TYPE_RULES[programType];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold ${programTypeRule.badgeClassName}`}
    >
      {programTypeRule.icon} {programTypeRule.label}
    </span>
  );
}
