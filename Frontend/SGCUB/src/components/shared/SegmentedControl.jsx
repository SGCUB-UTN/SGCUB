export default function SegmentedControl({ label, options, value, onChange, className = '' }) {
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex max-w-full gap-1 p-1 overflow-x-auto rounded-lg bg-surface-container ${className}`}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.description}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center justify-center h-9 px-4 rounded-md text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${active ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
