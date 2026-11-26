import type { HistoryEntry } from '@/lib/types';

/**
 * Escapa um valor para CSV (aspas, ponto e vírgula, quebras de linha) e
 * neutraliza CSV Formula Injection para abertura segura no Excel/Sheets.
 */
function escapeCsvValue(value: string | number): string {
  let text = String(value);
  if (typeof value === 'string' && (/^[\t\r ]*[=+\-@]/.test(text) || /^[\t\r]/.test(text))) {
    text = `'${text}`;
  }
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Monta o CSV das sessões. Separador ";" e BOM UTF-8 para o Excel em pt-BR
 * abrir com acentos e colunas certas sem precisar importar.
 */
export function buildHistoryCsv(historyEntries: HistoryEntry[]): string {
  const headerRow = ['Data', 'Hora', 'Aluno', 'Treino', 'Programa', 'Feitos', 'Pulados', 'Trocados', 'Status'];
  const dataRows = historyEntries.map((historyEntry) => {
    const entryDate = new Date(historyEntry.date);
    return [
      entryDate.toLocaleDateString('pt-BR'),
      entryDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      historyEntry.user.name,
      historyEntry.workout.name,
      historyEntry.workout.program?.name ?? '',
      historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'DONE').length,
      historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'SKIPPED').length,
      historyEntry.exerciseLogs.filter((exerciseLog) => exerciseLog.status === 'REPLACED').length,
      historyEntry.completed ? 'Concluído' : 'Em andamento',
    ];
  });
  return '﻿' + [headerRow, ...dataRows].map((row) => row.map(escapeCsvValue).join(';')).join('\r\n');
}

/** Baixa o texto como arquivo no navegador. */
export function downloadTextFile(fileContent: string, fileName: string, mimeType: string) {
  const fileUrl = URL.createObjectURL(new Blob([fileContent], { type: mimeType }));
  const downloadLink = document.createElement('a');
  downloadLink.href = fileUrl;
  downloadLink.download = fileName;
  downloadLink.click();
  setTimeout(() => URL.revokeObjectURL(fileUrl), 1000);
}
