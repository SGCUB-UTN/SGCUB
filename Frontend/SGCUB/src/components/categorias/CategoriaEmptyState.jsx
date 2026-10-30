export default function CategoriaEmptyState({ icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-1 py-10 px-4 border-2 border-dashed border-outline-variant rounded-lg bg-surface-container-low">
      <span className="material-symbols-outlined text-outline" style={{ fontSize: 28 }} aria-hidden="true">{icon}</span>
      <p className="text-base font-semibold text-on-surface">{title}</p>
      {description && <p className="text-sm text-on-surface-variant max-w-md">{description}</p>}
    </div>
  )
}
