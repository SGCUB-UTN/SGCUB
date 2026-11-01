export default function SectionDivider({ children, actions }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${actions ? '-mt-2' : 'pt-2'}`} role={actions ? undefined : 'presentation'}>
      <span className="text-xs font-bold uppercase tracking-widest text-outline whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 min-w-8 bg-outline-variant/40" />
      {actions}
    </div>
  )
}
