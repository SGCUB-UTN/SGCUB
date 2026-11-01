import { formatCount } from '../cuota/cuotaPeriod'
import { tabId, tabPanelId } from './tabIds'

const ARROW_STEPS = { ArrowRight: 1, ArrowLeft: -1 }

export default function TableTabs({ id, label, options, value, onChange, className = '' }) {
  const handleKeyDown = (event, index) => {
    const step = ARROW_STEPS[event.key]
    if (!step) return
    event.preventDefault()
    const next = (index + step + options.length) % options.length
    onChange(options[next].value)
    event.currentTarget.parentElement.children[next].focus()
  }

  return (
    <div role="tablist" aria-label={label} className={`flex gap-6 overflow-x-auto px-4 sm:px-5 border-b border-outline-variant/30 bg-surface-container-low ${className}`}>
      {options.map((option, index) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            id={tabId(id, option.value)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={tabPanelId(id)}
            tabIndex={active ? 0 : -1}
            title={option.description}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`inline-flex items-center gap-2 h-11 border-b-2 text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ${active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant'}`}
          >
            {option.label}
            {option.count != null && (
              <span className={`min-w-6 px-1.5 rounded-full text-xs text-center tabular-nums ${active ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                {formatCount(option.count)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
