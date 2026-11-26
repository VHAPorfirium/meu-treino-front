'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formataDuracao, nomeExercicio } from '@/lib/exercicios/modo';
import type { HistoryEntry } from '@/lib/types';
import { workoutLogsApi } from '@/lib/api/endpoints';
import {
  collectCompletedDayKeys,
  countCurrentStreak,
  shortWeekdayLabel,
  toLocalDayKey,
} from '@/lib/trainee/workout-history';
import { AppHeader } from '@/components/layout/app-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { SectionTitle } from '@/components/trainee/section-title';
import { StatTile } from '@/components/trainee/stat-tile';
import { Pill } from '@/components/trainee/workout-list-item';

const WEEKDAY_INITIALS = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

function isSameMonth(date: Date, referenceMonth: Date) {
  return date.getMonth() === referenceMonth.getMonth() && date.getFullYear() === referenceMonth.getFullYear();
}

/** Histórico do aluno: calendário do mês, números do mês e as sessões. */
export default function HistoricoPage() {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [displayedMonth, setDisplayedMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  useEffect(() => {
    workoutLogsApi
      .myHistory()
      .then(setHistoryEntries)
      .catch(() => setErrorMessage('Não foi possível carregar o histórico.'));
  }, []);

  const completedDayKeys = useMemo(() => collectCompletedDayKeys(historyEntries ?? []), [historyEntries]);
  const openDayKeys = useMemo(
    () =>
      new Set(
        (historyEntries ?? [])
          .filter((historyEntry) => !historyEntry.completed)
          .map((historyEntry) => toLocalDayKey(new Date(historyEntry.date))),
      ),
    [historyEntries],
  );
  const entriesOfMonth = (historyEntries ?? []).filter((historyEntry) =>
    isSameMonth(new Date(historyEntry.date), displayedMonth),
  );
  const completedEntriesOfMonth = entriesOfMonth.filter((historyEntry) => historyEntry.completed);
  const doneExercisesOfMonth = completedEntriesOfMonth.reduce(
    (sum, historyEntry) =>
      sum + historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status !== 'SKIPPED').length,
    0,
  );

  const monthTitle = displayedMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const isCurrentMonth = isSameMonth(new Date(), displayedMonth);

  function changeMonth(monthOffset: number) {
    setDisplayedMonth(
      (currentMonth) => new Date(currentMonth.getFullYear(), currentMonth.getMonth() + monthOffset, 1),
    );
  }

  return (
    <>
      <AppHeader eyebrow="Seu histórico" title={monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)} />
      <div className="space-y-3.5 p-5 pb-28">
        <Link href="/treino/meus" className="inline-block text-xs font-extrabold text-muted2">
          ← Treinos
        </Link>

        <div className="grid grid-cols-3 gap-2">
          <StatTile value={completedEntriesOfMonth.length} label="treinos no mês" />
          <StatTile value={`🔥 ${countCurrentStreak(completedDayKeys)}`} label="dias seguidos" />
          <StatTile value={doneExercisesOfMonth} label="exercícios feitos" />
        </div>

        <div className="rounded-2xl border border-line bg-card p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Mês anterior"
              className="h-8 w-8 rounded-lg bg-chip font-extrabold text-ink"
            >
              ‹
            </button>
            <p className="text-sm font-extrabold capitalize text-ink">{monthTitle}</p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              disabled={isCurrentMonth}
              aria-label="Próximo mês"
              className="h-8 w-8 rounded-lg bg-chip font-extrabold text-ink disabled:opacity-30"
            >
              ›
            </button>
          </div>
          <MonthCalendar
            displayedMonth={displayedMonth}
            completedDayKeys={completedDayKeys}
            openDayKeys={openDayKeys}
          />
          <p className="mt-2.5 text-xs font-bold text-muted2">
            <span className="text-done">■</span> completo &nbsp; <span className="text-done/40">■</span> em aberto
          </p>
        </div>

        <section>
          <SectionTitle>Sessões</SectionTitle>
          {errorMessage && <p className="py-8 text-center text-brand">{errorMessage}</p>}
          {!historyEntries && !errorMessage && <p className="py-8 text-center text-muted2">Carregando…</p>}
          {historyEntries && entriesOfMonth.length === 0 && (
            <p className="py-8 text-center text-sm font-semibold text-muted2">Nenhum treino neste mês.</p>
          )}
          <div className="space-y-2">
            {entriesOfMonth.map((historyEntry) => (
              <HistoryEntryCard
                key={historyEntry.id}
                historyEntry={historyEntry}
                isExpanded={expandedEntryId === historyEntry.id}
                onToggle={() =>
                  setExpandedEntryId((currentId) => (currentId === historyEntry.id ? null : historyEntry.id))
                }
              />
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function MonthCalendar({
  displayedMonth,
  completedDayKeys,
  openDayKeys,
}: {
  displayedMonth: Date;
  completedDayKeys: Set<string>;
  openDayKeys: Set<string>;
}) {
  const daysInMonth = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 0).getDate();
  const leadingEmptyDays = (displayedMonth.getDay() + 6) % 7; // semana começa na segunda
  const todayDayKey = toLocalDayKey(new Date());

  return (
    <div className="grid grid-cols-7 gap-1.5 text-center">
      {WEEKDAY_INITIALS.map((weekdayInitial, weekdayIndex) => (
        <span key={weekdayIndex} className="text-[10.5px] font-extrabold text-muted2">
          {weekdayInitial}
        </span>
      ))}
      {Array.from({ length: leadingEmptyDays }, (_, emptyIndex) => (
        <span key={`empty-${emptyIndex}`} />
      ))}
      {Array.from({ length: daysInMonth }, (_, dayIndex) => {
        const calendarDate = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth(), dayIndex + 1);
        const calendarDayKey = toLocalDayKey(calendarDate);
        const dayClassName = completedDayKeys.has(calendarDayKey)
          ? 'bg-done text-on-done'
          : openDayKeys.has(calendarDayKey)
            ? 'bg-done-bg text-done'
            : calendarDayKey === todayDayKey
              ? 'border-2 border-brand text-brand'
              : 'bg-chip text-muted2';
        return (
          <span
            key={calendarDayKey}
            className={`flex aspect-square items-center justify-center rounded-[10px] text-[12.5px] font-extrabold ${dayClassName}`}
          >
            {dayIndex + 1}
          </span>
        );
      })}
    </div>
  );
}

function HistoryEntryCard({
  historyEntry,
  isExpanded,
  onToggle,
}: {
  historyEntry: HistoryEntry;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const entryDate = new Date(historyEntry.date);
  const performedCount = historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status !== 'SKIPPED').length;
  const skippedCount = historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'SKIPPED').length;
  const replacedCount = historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'REPLACED').length;
  const summaryParts = [
    `${historyEntry.exerciseLogs.length} exercício${historyEntry.exerciseLogs.length === 1 ? '' : 's'}`,
    skippedCount ? `${skippedCount} pulado${skippedCount > 1 ? 's' : ''}` : '',
    replacedCount ? `${replacedCount} trocado${replacedCount > 1 ? 's' : ''}` : '',
  ].filter(Boolean);

  return (
    <div className="rounded-2xl border border-line bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-chip leading-none">
          <span className="font-display text-[15px] font-extrabold text-ink">{entryDate.getDate()}</span>
          <span className="text-[9px] font-extrabold uppercase text-muted2">
            {shortWeekdayLabel(entryDate.getDay())}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-extrabold text-ink">{historyEntry.workout.name}</span>
          <span className="block truncate text-xs font-bold text-muted2">
            {historyEntry.completed ? summaryParts.join(' · ') : 'Em aberto'}
          </span>
        </span>
        <Pill tone={!historyEntry.completed ? 'neutral' : skippedCount ? 'skip' : 'done'}>
          {performedCount}/{historyEntry.exerciseLogs.length}
        </Pill>
      </button>

      {isExpanded && (
        <div className="space-y-1.5 border-t border-line px-3 py-2.5">
          {historyEntry.exerciseLogs.map((exerciseLog) => (
            <div key={exerciseLog.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate capitalize text-ink2">
                {exerciseLog.status === 'REPLACED' && exerciseLog.actualExercise
                  ? `${nomeExercicio(exerciseLog.workoutExercise.exercise)} → ${nomeExercicio(exerciseLog.actualExercise)}`
                  : nomeExercicio(exerciseLog.workoutExercise.exercise)}
                {exerciseLog.totalSeconds ? (
                  <span className="font-bold text-muted2"> · {formataDuracao(exerciseLog.totalSeconds)}</span>
                ) : exerciseLog.loadUsed ? (
                  <span className="font-bold text-muted2"> · {exerciseLog.loadUsed}kg</span>
                ) : null}
              </span>
              <StatusBadge status={exerciseLog.status} />
            </div>
          ))}
          {historyEntry.exerciseLogs
            .filter((exerciseLog) => exerciseLog.note)
            .map((exerciseLog) => (
              <p key={`note-${exerciseLog.id}`} className="border-l-[3px] border-skip pl-3 text-xs text-muted">
                “{exerciseLog.note}” — <span className="capitalize">{nomeExercicio(exerciseLog.workoutExercise.exercise)}</span>
              </p>
            ))}
        </div>
      )}
    </div>
  );
}
