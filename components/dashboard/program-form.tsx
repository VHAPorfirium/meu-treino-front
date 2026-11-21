'use client';

import { useState } from 'react';
import type { CreateProgramPayload, ProgramType } from '@/lib/types';
import { PROGRAM_TYPE_RULES } from '@/lib/programs/program-type-rules';
import { ProgramTypeSelector } from './program-type-selector';
import {
  SelectableChipList,
  type SelectableChipOption,
  toggleIdInSet,
} from './selectable-chip-list';

const INPUT_CLASS_NAME =
  'w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-muted2 focus:border-brand focus:outline-none';

/** Formulário de criação: nome, tipo, duração (só quando o tipo pede), treinos e alunos. */
export function ProgramForm({
  workoutOptions,
  traineeOptions,
  onSubmit,
  onCancel,
}: {
  workoutOptions: SelectableChipOption[] | null;
  traineeOptions: SelectableChipOption[] | null;
  onSubmit: (payload: CreateProgramPayload) => Promise<void>;
  onCancel: () => void;
}) {
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [selectedProgramType, setSelectedProgramType] = useState<ProgramType>('CONTINUOUS');
  const [durationValue, setDurationValue] = useState('');
  const [selectedWorkoutIds, setSelectedWorkoutIds] = useState<Set<string>>(new Set());
  const [selectedTraineeIds, setSelectedTraineeIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  const selectedTypeRule = PROGRAM_TYPE_RULES[selectedProgramType];

  function handleProgramTypeChange(programType: ProgramType) {
    setSelectedProgramType(programType);
    // a duração de um tipo não vale para o outro (o back recusaria)
    setDurationValue('');
  }

  function buildPayload(): CreateProgramPayload | string {
    if (!programName.trim()) return 'Dê um nome ao programa.';

    const payload: CreateProgramPayload = {
      name: programName.trim(),
      description: programDescription.trim() || undefined,
      type: selectedProgramType,
      workoutIds: Array.from(selectedWorkoutIds),
      userIds: Array.from(selectedTraineeIds),
    };

    if (selectedTypeRule.durationField) {
      const parsedDuration = Number(durationValue);
      const maximumDuration = selectedTypeRule.maximumDuration ?? Infinity;
      if (!Number.isInteger(parsedDuration) || parsedDuration < 1 || parsedDuration > maximumDuration) {
        return `Informe a duração em ${selectedTypeRule.durationUnitLabel} (1 a ${maximumDuration}).`;
      }
      payload[selectedTypeRule.durationField] = parsedDuration;
    }
    return payload;
  }

  async function handleSubmit() {
    const payloadOrMessage = buildPayload();
    if (typeof payloadOrMessage === 'string') {
      setValidationMessage(payloadOrMessage);
      return;
    }
    setValidationMessage(null);
    setIsSubmitting(true);
    try {
      await onSubmit(payloadOrMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-4">
      <input
        value={programName}
        onChange={(event) => setProgramName(event.target.value)}
        placeholder="Nome (ex: Desafio 30 Dias: Pernas de Aço)"
        className={INPUT_CLASS_NAME}
      />
      <textarea
        value={programDescription}
        onChange={(event) => setProgramDescription(event.target.value)}
        placeholder="Descrição (opcional)"
        rows={2}
        className={INPUT_CLASS_NAME}
      />

      <ProgramTypeSelector
        selectedProgramType={selectedProgramType}
        onChange={handleProgramTypeChange}
      />

      {selectedTypeRule.durationField && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-wide text-muted2">
            Duração ({selectedTypeRule.durationUnitLabel})
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={selectedTypeRule.maximumDuration ?? undefined}
            value={durationValue}
            onChange={(event) => setDurationValue(event.target.value)}
            placeholder={selectedProgramType === 'CHALLENGE' ? '30' : '4'}
            className={`${INPUT_CLASS_NAME} max-w-[160px]`}
          />
        </label>
      )}

      <SelectableChipList
        title="Treinos do programa"
        options={workoutOptions}
        selectedIds={selectedWorkoutIds}
        onToggle={(workoutId) => setSelectedWorkoutIds((current) => toggleIdInSet(current, workoutId))}
        emptyMessage="Crie os treinos primeiro na aba Treinos."
      />

      <SelectableChipList
        title="Alunos participantes"
        options={traineeOptions}
        selectedIds={selectedTraineeIds}
        onToggle={(traineeId) => setSelectedTraineeIds((current) => toggleIdInSet(current, traineeId))}
        emptyMessage="Nenhum aluno cadastrado."
      />
      <p className="text-xs font-semibold text-muted2">
        Quem já estiver em outro programa sai dele e entra neste. Os treinos escolhidos aparecem
        na hora para os alunos.
      </p>

      {validationMessage && (
        <p className="text-sm font-semibold text-brand">{validationMessage}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border-2 border-ink py-2.5 text-sm font-extrabold"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={handleSubmit}
          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {isSubmitting
            ? 'Salvando…'
            : selectedTypeRule.hasDeadline
              ? `Ativar ${selectedTypeRule.label.toLowerCase()}`
              : 'Criar programa'}
        </button>
      </div>
    </div>
  );
}
