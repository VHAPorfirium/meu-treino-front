'use client';

import { useEffect, useState } from 'react';

/** Verifica se a URL ou storagePath indica foto em formato HEIC/HEIF (iOS). */
export function isHeicPath(pathOrUrl?: string | null): boolean {
  if (!pathOrUrl) return false;
  return /\.hei[cf](?:[?#].*)?$/i.test(pathOrUrl);
}

/**
 * Renderiza foto de progresso com fallback amigável quando o navegador não consegue
 * decodificar o arquivo (ex.: fotos `.heic` antigas abertas no Chrome/Firefox/Edge).
 */
export function ProgressPhotoImage({
  src,
  storagePath,
  alt,
  className,
  compact = false,
}: {
  src?: string | null;
  storagePath?: string | null;
  alt: string;
  className: string;
  compact?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src) {
    return <div className={`${className} bg-chip`} aria-hidden />;
  }

  if (failed) {
    const heic = isHeicPath(storagePath) || isHeicPath(src);
    return (
      <div
        className={`${className} flex flex-col items-center justify-center gap-1.5 bg-chip px-2 text-center text-muted`}
      >
        <span className={compact ? 'text-xl' : 'text-2xl'} aria-hidden>
          📷
        </span>
        <p className="text-[11px] font-extrabold leading-tight text-ink">
          {heic ? 'Formato HEIC' : 'Foto indisponível'}
        </p>
        {!compact && (
          <p className="text-[10.5px] leading-snug text-muted2">
            {heic
              ? 'Este navegador não exibe HEIC.'
              : 'Não foi possível carregar a imagem.'}
          </p>
        )}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          download
          className="mt-0.5 rounded-lg bg-card px-2 py-1 text-[10.5px] font-extrabold text-brand-ink underline shadow-sm"
        >
          Baixar foto
        </a>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
