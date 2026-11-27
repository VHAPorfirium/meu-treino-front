'use client';

import { useEffect, useState } from 'react';
import type { ProgressPhoto } from '@/lib/types';
import { isHeicPath } from '@/components/ui/progress-photo-image';

const formatShortDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();

/** Comparador antes × depois: arraste o controle para revelar uma foto sobre a outra. */
export function PhotoComparison({ beforePhoto, afterPhoto }: { beforePhoto: ProgressPhoto; afterPhoto: ProgressPhoto }) {
  const [dividerPercentage, setDividerPercentage] = useState(50);
  const [beforeFailed, setBeforeFailed] = useState(false);
  const [afterFailed, setAfterFailed] = useState(false);

  useEffect(() => {
    setBeforeFailed(false);
    setAfterFailed(false);
  }, [beforePhoto.url, afterPhoto.url]);

  const daysBetweenPhotos = Math.round(
    (new Date(afterPhoto.takenAt).getTime() - new Date(beforePhoto.takenAt).getTime()) / (24 * 60 * 60 * 1000),
  );
  const hasDecodeError = beforeFailed || afterFailed;
  const anyHeic =
    (beforeFailed && (isHeicPath(beforePhoto.path) || isHeicPath(beforePhoto.url))) ||
    (afterFailed && (isHeicPath(afterPhoto.path) || isHeicPath(afterPhoto.url)));

  return (
    <div>
      {hasDecodeError ? (
        <div className="rounded-3xl border border-line bg-card p-5 text-center">
          <p className="text-3xl" aria-hidden>
            📷
          </p>
          <p className="mt-2 text-sm font-extrabold text-ink">
            {anyHeic
              ? 'Foto em formato HEIC incompatível com este navegador'
              : 'Não foi possível exibir uma das fotos do comparador'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {anyHeic
              ? 'Abra no Safari ou baixe as imagens abaixo para visualizar.'
              : 'Você ainda pode baixar as imagens diretamente.'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {beforePhoto.url && (
              <a
                href={beforePhoto.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="rounded-xl bg-chip px-3 py-1.5 text-xs font-extrabold text-brand-ink underline"
              >
                Baixar Antes ({formatShortDate(beforePhoto.takenAt)})
              </a>
            )}
            {afterPhoto.url && (
              <a
                href={afterPhoto.url}
                target="_blank"
                rel="noopener noreferrer"
                download
                className="rounded-xl bg-chip px-3 py-1.5 text-xs font-extrabold text-brand-ink underline"
              >
                Baixar Depois ({formatShortDate(afterPhoto.takenAt)})
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-chip">
          {afterPhoto.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={afterPhoto.url}
              alt="Depois"
              onError={() => setAfterFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - dividerPercentage}% 0 0)` }}>
            {beforePhoto.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={beforePhoto.url}
                alt="Antes"
                onError={() => setBeforeFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
          </div>
          <div className="pointer-events-none absolute inset-y-0 w-1 -translate-x-1/2 bg-white" style={{ left: `${dividerPercentage}%` }}>
            <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white font-extrabold text-[#191512] shadow-lg">
              ⇆
            </span>
          </div>
          <span className="absolute bottom-2 left-2 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-extrabold text-white">
            {formatShortDate(beforePhoto.takenAt)}
          </span>
          <span className="absolute bottom-2 right-2 rounded-md bg-black/45 px-2 py-0.5 text-[10px] font-extrabold text-white">
            {formatShortDate(afterPhoto.takenAt)}
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={dividerPercentage}
            onChange={(event) => setDividerPercentage(Number(event.target.value))}
            aria-label="Comparar antes e depois"
            className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
          />
        </div>
      )}
      <p className="mt-2 text-center text-xs font-bold text-muted2">
        {hasDecodeError
          ? `${daysBetweenPhotos} dia${daysBetweenPhotos === 1 ? '' : 's'} de diferença`
          : `Arraste para comparar · ${daysBetweenPhotos} dia${daysBetweenPhotos === 1 ? '' : 's'} de diferença`}
      </p>
    </div>
  );
}
