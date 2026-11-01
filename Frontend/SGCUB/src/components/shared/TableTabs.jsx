import { formatCount } from '../cuota/cuotaPeriod'
import { tabId, tabPanelId } from './tabIds'

const ARROW_STEPS = { ArrowRight: 1, ArrowLeft: -1 }
const TAB_CLASS = 'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 -mb-px text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-surface-container-low'

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
    <div role="tablist" aria-label={label} className={`flex gap-1 overflow-x-auto px-4 sm:px-5 border-b border-outline-variant/30 ${className}`}>
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
            className={`${TAB_CLASS} ${active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            {option.label}
            {option.count != null && (
              <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${option.badgeClass ?? (active ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant')}`}>
                {formatCount(option.count)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
