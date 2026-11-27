'use client';

import { useEffect, useState } from 'react';
import type { ProgramReport } from '@/lib/types';
import { triggerHaptic } from '@/lib/haptics';
import { buildAchievementStatsLine, buildAchievementTitle } from '@/lib/programs/achievement-summary';
import { shareAchievement } from '@/lib/programs/achievement-share-card';

const CONFETTI_PIECES = ['🎉', '✨', '🏆', '🎊', '💪', '⭐', '🔥', '🎉', '✨', '🎊'];

/** Tela cheia de "Desafio Concluído! 🏆" com medalha, relatório e compartilhamento. */
export function ChallengeCompletedCelebration({
  programReport,
  onClose,
}: {
  programReport: ProgramReport;
  onClose: () => void;
}) {
  const [isSharing, setIsSharing] = useState(false);
  const [shareErrorMessage, setShareErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    triggerHaptic('celebration');
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function handleShare() {
    setIsSharing(true);
    setShareErrorMessage(null);
    try {
      await shareAchievement(programReport);
    } catch (error) {
      // cancelar o menu de compartilhar não é erro
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setShareErrorMessage('Não foi possível compartilhar agora.');
      }
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conquista desbloqueada"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 p-6"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {CONFETTI_PIECES.map((confettiPiece, pieceIndex) => (
          <span
            key={pieceIndex}
            className="absolute animate-bounce text-3xl"
            style={{
              left: `${(pieceIndex * 97) % 100}%`,
              top: `${(pieceIndex * 37) % 90}%`,
              animationDelay: `${(pieceIndex % 5) * 150}ms`,
            }}
          >
            {confettiPiece}
          </span>
        ))}
      </div>

      <div className="relative w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-soft">
        <p className="text-7xl">🥇</p>
        <p className="mt-3 text-[11px] font-extrabold uppercase tracking-wider text-gold">
          Conquista desbloqueada
        </p>
        <h2 className="mt-1 font-display text-[24px] font-extrabold leading-tight text-ink">
          {buildAchievementTitle(programReport)}
        </h2>
        <p className="mt-1 font-bold text-muted">{programReport.programName}</p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ReportStat value={String(programReport.totalDays)} label="dias de foco" />
          <ReportStat value={String(programReport.completedWorkoutsCount)} label="treinos" />
          <ReportStat
            value={
              programReport.loadEvolutionPercentage == null
                ? '—'
                : `${programReport.loadEvolutionPercentage >= 0 ? '+' : ''}${programReport.loadEvolutionPercentage}%`
            }
            label="carga"
          />
        </div>
        <p className="mt-3 text-xs font-semibold text-muted2">{buildAchievementStatsLine(programReport)}</p>

        <button
          type="button"
          disabled={isSharing}
          onClick={handleShare}
          className="mt-5 w-full rounded-2xl bg-gradient-to-br from-amber-600 to-amber-800 py-3.5 text-[16px] font-extrabold text-white disabled:opacity-60"
        >
          {isSharing ? 'Gerando card…' : 'Compartilhar conquista'}
        </button>
        {shareErrorMessage && (
          <p className="mt-2 text-xs font-semibold text-brand">{shareErrorMessage}</p>
        )}
        <button type="button" onClick={onClose} className="mt-3 w-full py-2 text-sm font-extrabold text-muted">
          Fechar
        </button>
      </div>
    </div>
  );
}

function ReportStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl bg-chip px-2 py-3">
      <p className="font-display text-[22px] font-extrabold text-ink">{value}</p>
      <p className="text-[11px] font-bold text-muted2">{label}</p>
    </div>
  );
}
