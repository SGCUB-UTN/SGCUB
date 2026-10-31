import { useRef } from 'react'
import { currentPeriod, formatPeriod, formatShortPeriod } from '../shared/periodFormat'
import { isValidPeriod, shiftPeriod } from './cuotaPeriod'

const CONTROL_CLASS = 'h-10 shrink-0 flex items-center justify-center gap-1.5 rounded border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const DIVIDER_CONTROL_CLASS = 'h-full shrink-0 flex items-center justify-center gap-1.5 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60'

const VARIANTS = {
  header: {
    wrapper: 'flex items-center gap-1.5',
    today: `${CONTROL_CLASS} px-3 text-sm font-semibold text-primary`,
    group: 'contents',
    arrow: `${CONTROL_CLASS} w-10`,
    picker: 'relative',
    period: `${CONTROL_CLASS} w-56 px-3 text-sm font-semibold text-on-surface`,
    calendar: 'text-on-surface-variant',
    iconSize: 20,
    keepTodaySpace: true,
    todayLabel: 'Mes actual',
    todayIcon: 'today',
    format: formatPeriod,
  },
  divider: {
    wrapper: 'flex items-center gap-2',
    today: 'h-8 shrink-0 inline-flex items-center gap-1 px-1 rounded text-sm font-semibold text-primary hover:text-primary/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
    group: 'flex items-center h-8 rounded-full border border-outline-variant/60 bg-surface-container-low shadow-sm overflow-hidden divide-x divide-outline-variant/40',
    arrow: `${DIVIDER_CONTROL_CLASS} w-8`,
    picker: 'relative h-full',
    period: `${DIVIDER_CONTROL_CLASS} w-40 px-3 text-sm font-semibold text-on-surface`,
    calendar: 'text-primary',
    iconSize: 16,
    keepTodaySpace: false,
    todayLabel: 'Hoy',
    todayIcon: 'undo',
    format: formatShortPeriod,
  },
}

function ArrowButton({ icon, label, onClick, className, iconSize }) {
  return (
    <button type="button" onClick={onClick} className={className} aria-label={label} title={label}>
      <span className="material-symbols-outlined" style={{ fontSize: iconSize }} aria-hidden="true">{icon}</span>
    </button>
  )
}

function openPicker(input) {
  try {
    input.showPicker()
  } catch {
    input.focus()
  }
}

export default function PeriodSelector({ value, onChange, variant = 'header' }) {
  const inputRef = useRef(null)
  const today = currentPeriod()
  const isCurrent = value === today
  const styles = VARIANTS[variant]

  return (
    <div className={styles.wrapper}>
      {(!isCurrent || styles.keepTodaySpace) && (
        <button
          type="button"
          onClick={() => onChange(today)}
          disabled={isCurrent}
          className={`${styles.today} ${isCurrent ? 'invisible' : ''}`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">{styles.todayIcon}</span>
          {styles.todayLabel}
        </button>
      )}
      <div className={styles.group}>
        <ArrowButton icon="chevron_left" label="Período anterior" onClick={() => onChange(shiftPeriod(value, -1))} className={styles.arrow} iconSize={styles.iconSize} />
        <div className={styles.picker}>
          <button
            type="button"
            onClick={() => openPicker(inputRef.current)}
            className={styles.period}
            aria-label={`Período: ${formatPeriod(value)}. Elegir mes y año`}
          >
            <span className={`material-symbols-outlined ${styles.calendar}`} style={{ fontSize: 18 }} aria-hidden="true">calendar_month</span>
            {styles.format(value)}
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }} aria-hidden="true">expand_more</span>
          </button>
          <input
            ref={inputRef}
            type="month"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 opacity-0 pointer-events-none"
            value={value}
            onChange={(event) => isValidPeriod(event.target.value) && onChange(event.target.value)}
          />
        </div>
        <ArrowButton icon="chevron_right" label="Período siguiente" onClick={() => onChange(shiftPeriod(value, 1))} className={styles.arrow} iconSize={styles.iconSize} />
      </div>
    </div>
  )
}
