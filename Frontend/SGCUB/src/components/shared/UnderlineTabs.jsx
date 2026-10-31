export default function UnderlineTabs({ label, tabs, value, onChange, panelId, className = '' }) {
  return (
    <div role="tablist" aria-label={label} className={`flex gap-6 overflow-x-auto border-b border-outline-variant/40 ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            id={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            onClick={() => onChange(tab.value)}
            className={`-mb-px inline-flex items-center gap-2 py-3 border-b-2 text-base whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${active ? 'border-primary text-primary font-semibold' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'}`}
          >
            {tab.icon && <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">{tab.icon}</span>}
            {tab.label}
            {tab.count != null && <span className="font-normal text-on-surface-variant">({tab.count})</span>}
          </button>
        )
      })}
    </div>
  )
}
