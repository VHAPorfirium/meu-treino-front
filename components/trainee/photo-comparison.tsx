'use client';

import { useState } from 'react';
import type { ProgressPhoto } from '@/lib/types';

const formatShortDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();

/** Comparador antes × depois: arraste o controle para revelar uma foto sobre a outra. */
export function PhotoComparison({ beforePhoto, afterPhoto }: { beforePhoto: ProgressPhoto; afterPhoto: ProgressPhoto }) {
  const [dividerPercentage, setDividerPercentage] = useState(50);
  const daysBetweenPhotos = Math.round(
    (new Date(afterPhoto.takenAt).getTime() - new Date(beforePhoto.takenAt).getTime()) / (24 * 60 * 60 * 1000),
  );

  return (
    <div>
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl bg-chip">
        {afterPhoto.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={afterPhoto.url} alt="Depois" className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - dividerPercentage}% 0 0)` }}>
          {beforePhoto.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={beforePhoto.url} alt="Antes" className="absolute inset-0 h-full w-full object-cover" />
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
      <p className="mt-2 text-center text-xs font-bold text-muted2">
        Arraste para comparar · {daysBetweenPhotos} dia{daysBetweenPhotos === 1 ? '' : 's'} de diferença
      </p>
    </div>
  );
}
