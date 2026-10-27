export default function SectionHeading({ id, as: Heading = 'h2', icon, title, actions, className = 'px-4 sm:px-5 border-y' }) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-outline-variant/30 bg-surface-container-low py-3 ${className}`}>
      <Heading id={id} className="flex min-w-0 items-center gap-2 text-base font-semibold text-on-surface">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }} aria-hidden="true">{icon}</span>
        {title}
      </Heading>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
