import Link from 'next/link';

/** Quadradinho de treino na grade "Prefere outro hoje?". */
export function WorkoutTile({
  href,
  letter,
  title,
  caption,
}: {
  href: string;
  letter: string;
  title: string;
  caption: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-line bg-card p-3 transition active:scale-[.98]">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-chip font-display text-base font-extrabold text-ink">
        {letter}
      </span>
      <span className="mt-2 block truncate text-sm font-extrabold text-ink">{title}</span>
      <span className="block truncate text-[11.5px] font-bold text-muted2">{caption}</span>
    </Link>
  );
}
