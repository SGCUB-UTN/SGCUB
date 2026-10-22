export default function ProfileBadge({ icon, children }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-semibold text-primary whitespace-nowrap">
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{icon}</span>
      {children}
    </span>
  )
}
