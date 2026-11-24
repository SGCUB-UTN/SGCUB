import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="w-full max-w-xl mx-auto flex flex-col items-start gap-4 py-16">
      <span className="material-symbols-outlined text-[40px] text-on-surface-variant" aria-hidden="true">explore_off</span>
      <h1 className="text-2xl font-semibold text-on-surface">No encontramos esta página</h1>
      <p className="text-base text-on-surface-variant">
        La dirección puede estar mal escrita o la página ya no existe. Usá el menú o el buscador para llegar a lo que necesitás.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-on-primary hover:bg-primary/90 rounded-lg text-base font-semibold shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">home</span>
        Volver al inicio
      </Link>
    </div>
  )
}
