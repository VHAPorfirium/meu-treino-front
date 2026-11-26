import Link from 'next/link';

/** Página 404 amigável e coerente com o tema claro/escuro do app. */
export default function NotFound() {
  return (
    <div className="app-shell safe-top safe-bottom items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card p-6 shadow-soft">
        <p className="font-display text-4xl font-extrabold text-brand">404</p>
        <h1 className="mt-2 font-display text-[22px] font-extrabold text-ink">
          Página não encontrada
        </h1>
        <p className="mt-1.5 text-sm font-semibold text-muted">
          O endereço que você tentou abrir não existe ou foi movido.
        </p>
        <Link
          href="/"
          className="mt-5 block w-full rounded-2xl bg-brand py-3 text-sm font-extrabold text-white shadow-brand transition active:scale-[0.98]"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
