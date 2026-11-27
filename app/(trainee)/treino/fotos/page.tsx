'use client';

import { useEffect, useRef, useState } from 'react';
import type { ProgressPhoto } from '@/lib/types';
import { photosApi } from '@/lib/api/endpoints';
import { ApiError } from '@/lib/api/client';
import { AppHeader } from '@/components/layout/app-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SectionTitle } from '@/components/trainee/section-title';
import { PhotoComparison } from '@/components/trainee/photo-comparison';
import { ProgressPhotoImage } from '@/components/ui/progress-photo-image';

const formatShortDate = (isoDate: string) =>
  new Date(isoDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '').toUpperCase();

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
const MAXIMUM_PHOTO_SIZE_IN_BYTES = 15 * 1024 * 1024;

/**
 * Converte fotos HEIC/HEIF para JPEG quando o navegador sabe decodificá-las (ex.: Safari/iOS),
 * garantindo que o personal no desktop (Chrome/Firefox/Edge) consiga visualizar a foto.
 */
async function convertHeicToJpeg(file: File): Promise<Blob | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  try {
    let width = 0;
    let height = 0;
    let source: CanvasImageSource;
    let cleanup: (() => void) | null = null;

    if (typeof createImageBitmap === 'function') {
      const bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
      source = bitmap;
      cleanup = () => bitmap.close();
    } else {
      const objectUrl = URL.createObjectURL(file);
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const el = new Image();
          el.onload = () => resolve(el);
          el.onerror = () => reject(new Error('decode failed'));
          el.src = objectUrl;
        });
        width = img.naturalWidth;
        height = img.naturalHeight;
        source = img;
        cleanup = () => URL.revokeObjectURL(objectUrl);
      } catch {
        URL.revokeObjectURL(objectUrl);
        return null;
      }
    }

    try {
      if (!width || !height) return null;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(source, 0, 0, width, height);
      return await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.88),
      );
    } finally {
      cleanup?.();
    }
  } catch {
    return null;
  }
}

type PhotosView = 'comparison' | 'timeline';

/**
 * Fotos de progresso: comparador antes × depois e linha do tempo.
 * Upload DIRETO pro Supabase com URL assinada (a foto não passa pela API).
 */
export default function FotosPage() {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [photoNote, setPhotoNote] = useState('');
  const [selectedView, setSelectedView] = useState<PhotosView>('comparison');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = () =>
    photosApi
      .mine()
      .then(setPhotos)
      .catch((error) => setErrorMessage(error instanceof ApiError ? error.message : 'Sem conexão'));

  useEffect(() => {
    void loadPhotos();
  }, []);

  async function uploadPhoto(photoFile: File) {
    const rawExtension = (photoFile.name.split('.').pop() ?? '').toLowerCase();
    const isHeic =
      rawExtension === 'heic' ||
      rawExtension === 'heif' ||
      /heic|heif/i.test(photoFile.type);
    if (!isHeic && !ALLOWED_EXTENSIONS.includes(rawExtension)) {
      setErrorMessage('Formato não suportado. Use JPG, PNG ou WebP.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (photoFile.size > MAXIMUM_PHOTO_SIZE_IN_BYTES) {
      setErrorMessage('Foto muito grande (máx. 15 MB).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setIsUploading(true);
    setErrorMessage(null);
    try {
      let uploadBody: Blob = photoFile;
      let uploadContentType = photoFile.type || 'application/octet-stream';
      let uploadExtension = rawExtension;

      if (isHeic) {
        const converted = await convertHeicToJpeg(photoFile);
        if (!converted) {
          setErrorMessage(
            'Este navegador não converte fotos .heic. Selecione ou exporte a foto em JPG, PNG ou WebP para garantir visualização em todos os aparelhos.',
          );
          return;
        }
        uploadBody = converted;
        uploadContentType = 'image/jpeg';
        uploadExtension = 'jpg';
      }

      const { path, uploadUrl } = await photosApi.requestUpload(uploadExtension);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadContentType },
        body: uploadBody,
      });
      if (!uploadResponse.ok) throw new Error(`upload falhou (${uploadResponse.status})`);
      await photosApi.register({ path, note: photoNote.trim() || undefined });
      setPhotoNote('');
      await loadPhotos();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : ((error as Error).message ?? 'Falha no upload'));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function confirmRemovePhoto(photo: ProgressPhoto) {
    setDeletingId(photo.id);
    setErrorMessage(null);
    try {
      await photosApi.remove(photo.id);
      setConfirmDeleteId(null);
      setPhotos((currentPhotos) => currentPhotos?.filter((currentPhoto) => currentPhoto.id !== photo.id) ?? null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Não foi possível apagar');
    } finally {
      setDeletingId(null);
    }
  }

  const photosByDate = [...(photos ?? [])].sort(
    (first, second) => new Date(first.takenAt).getTime() - new Date(second.takenAt).getTime(),
  );
  const oldestPhoto = photosByDate[0];
  const newestPhoto = photosByDate[photosByDate.length - 1];
  const newestFirstPhotos = [...photosByDate].reverse();

  return (
    <>
      <AppHeader eyebrow="Evolução" title="Fotos" />
      <div className="space-y-3.5 p-5 pb-28">
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <input
            value={photoNote}
            onChange={(event) => setPhotoNote(event.target.value)}
            placeholder="Observação (opcional)"
            className="min-w-0 flex-1 rounded-xl border border-line bg-card px-3.5 py-2.5 text-base font-medium text-ink placeholder:text-muted2 focus:border-brand focus:outline-none"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => event.target.files?.[0] && uploadPhoto(event.target.files[0])}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-extrabold text-white shadow-brand disabled:opacity-50"
          >
            {isUploading ? 'Enviando…' : '＋ Nova foto'}
          </button>
        </div>

        {errorMessage && (
          <p className="rounded-2xl border border-line bg-card p-3 text-center text-sm font-semibold text-brand-ink">
            {errorMessage}
          </p>
        )}
        {photos === null && !errorMessage && <p className="py-6 text-center text-muted2">Carregando…</p>}
        {photos?.length === 0 && (
          <div className="py-12 text-center text-muted2">
            <p className="text-4xl">📷</p>
            <p className="mt-2 font-semibold">Nenhuma foto ainda.</p>
            <p className="mt-1 text-sm">Tire a primeira hoje e compare daqui a algumas semanas.</p>
          </div>
        )}

        {photos && photos.length > 0 && (
          <>
            <SegmentedControl<PhotosView>
              options={[
                { value: 'comparison', label: 'Antes × Depois' },
                { value: 'timeline', label: 'Linha do tempo' },
              ]}
              selectedValue={selectedView}
              onChange={setSelectedView}
            />

            {selectedView === 'comparison' &&
              (photosByDate.length >= 2 ? (
                <PhotoComparison beforePhoto={oldestPhoto} afterPhoto={newestPhoto} />
              ) : (
                <p className="rounded-2xl bg-chip p-4 text-center text-sm font-bold text-muted">
                  Adicione mais uma foto para comparar o antes e o depois.
                </p>
              ))}

            <section>
              <SectionTitle>Todas as fotos · {photos.length}</SectionTitle>
              <div className={`grid gap-2 ${selectedView === 'timeline' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                {newestFirstPhotos.map((photo) => {
                  const isConfirming = confirmDeleteId === photo.id;
                  const isDeleting = deletingId === photo.id;
                  return (
                    <figure key={photo.id} className="relative overflow-hidden rounded-2xl bg-chip">
                      <ProgressPhotoImage
                        src={photo.url}
                        storagePath={photo.path}
                        alt={photo.note ?? 'Foto de progresso'}
                        className="aspect-[3/4] w-full object-cover"
                        compact={selectedView === 'comparison'}
                      />
                      {isConfirming ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 p-2 text-center">
                          <p className="text-[11px] font-extrabold text-white">Apagar foto?</p>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-lg bg-white/20 px-2.5 py-1 text-[11px] font-extrabold text-white"
                            >
                              Não
                            </button>
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => void confirmRemovePhoto(photo)}
                              className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-extrabold text-white disabled:opacity-50"
                            >
                              {isDeleting ? '…' : 'Sim'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <figcaption className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1">
                          <span className="truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                            {formatShortDate(photo.takenAt)}
                            {selectedView === 'timeline' && photo.note ? ` · ${photo.note}` : ''}
                          </span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(photo.id)}
                            aria-label="Apagar foto"
                            className="shrink-0 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-extrabold text-white"
                          >
                            ✕
                          </button>
                        </figcaption>
                      )}
                    </figure>
                  );
                })}
              </div>
            </section>
            <p className="text-center text-[11px] text-muted2">
              Suas fotos ficam privadas — só você e o personal do vínculo atual veem.
            </p>
          </>
        )}
      </div>
    </>
  );
}
