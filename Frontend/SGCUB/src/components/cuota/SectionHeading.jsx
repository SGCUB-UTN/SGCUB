export default function SectionHeading({ id, icon, title, actions }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-y border-outline-variant/30 bg-surface-container-low px-4 sm:px-5 py-3">
      <h2 id={id} className="flex min-w-0 items-center gap-2 text-base font-semibold text-on-surface">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }} aria-hidden="true">{icon}</span>
        {title}
      </h2>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
