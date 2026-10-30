export default function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-3 pt-2" role="presentation">
      <span className="text-xs font-bold uppercase tracking-widest text-outline whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-outline-variant/40" />
    </div>
  )
}
f