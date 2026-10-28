import { Fragment } from 'react'
import { formatCount, formatDayMonth } from './cuotaPeriod'

const DONE = 'done'
const PENDING = 'pending'
const MISSED = 'missed'
const CURRENT = 'current'

const STATUS_STYLES = {
  [DONE]: { icon: 'check', label: 'text-on-surface' },
  [CURRENT]: { icon: 'hourglass_top', circle: 'bg-primary/10 text-primary border-primary', label: 'text-on-surface' },
  [PENDING]: { icon: 'schedule', circle: 'bg-surface-container-lowest text-outline border-outline-variant', label: 'text-on-surface-variant' },
  [MISSED]: { icon: 'priority_high', circle: 'bg-error-container text-error border-error/40', label: 'text-error' },
}

const PHASE_TITLES = {
  generation: 'Cuotas generadas',
  first_due: '1° Vencimiento',
  second_due: '2° Vencimiento',
}

const DONE_COLORS = {
  generation: { circle: 'bg-emerald-600 text-surface-container-lowest border-emerald-600', line: 'bg-emerald-600' },
  first_due: { circle: 'bg-amber-500 text-surface-container-lowest border-amber-500', line: 'bg-amber-500' },
  second_due: { circle: 'bg-error text-on-error border-error', line: 'bg-error' },
}

const STATUS_DESCRIPTIONS = {
  [DONE]: 'completada',
  [CURRENT]: 'en curso',
  [PENDING]: 'pendiente',
  [MISSED]: 'sin ejecutar',
}

function generationCaption(phase) {
  if (phase.status === DONE) return phase.executed_at ? `Emitidas el ${formatDayMonth(phase.executed_at)}` : 'Emitidas'
  if (phase.status === MISSED) return `Debían emitirse el ${formatDayMonth(phase.date)}`
  return `Se emiten el ${formatDayMonth(phase.date)}`
}

function dueCaption(phase) {
  if (phase.status === DONE) {
    const count = `${formatCount(phase.applied_count)} ${phase.applied_count === 1 ? 'cuota' : 'cuotas'}`
    return phase.executed_at ? `Aplicado el ${formatDayMonth(phase.executed_at)} a ${count}` : `Aplicado a ${count}`
  }
  const due = `Vence el ${formatDayMonth(phase.date)}`
  if (phase.status === MISSED) return `${due} · debía aplicarse el ${formatDayMonth(phase.run_date)}`
  return `${due} · se aplica el ${formatDayMonth(phase.run_date)}`
}

const phaseCaption = (phase) => (phase.key === 'generation' ? generationCaption(phase) : dueCaption(phase))

function withCurrentStep(phases) {
  const currentIndex = phases.findIndex((phase) => phase.status === PENDING)
  return phases.map((phase, index) => ({ ...phase, visualStatus: index === currentIndex ? CURRENT : phase.status }))
}

function PhaseSkeleton() {
  return (
    <div className="flex flex-1 flex-col sm:flex-row gap-4 animate-pulse" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex flex-1 items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-surface-container-high" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-32 rounded bg-surface-container-high" />
            <div className="h-3 w-24 rounded bg-surface-container" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function BillingPhaseTracker({ phases, isLoading, error }) {
  const steps = withCurrentStep(phases ?? [])
  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4">
      
      {isLoading && steps.length === 0 && <PhaseSkeleton />}
      {!isLoading && error && steps.length === 0 && (
        <p className="text-sm text-error">No se pudo cargar la fase del período.</p>
      )}
      {steps.length > 0 && (
        <ol aria-labelledby="billing-phase-title" className="flex flex-1 flex-col sm:flex-row sm:items-center gap-4 sm:gap-0 min-w-0">
          {steps.map((phase, index) => {
            const style = STATUS_STYLES[phase.visualStatus]
            const doneColors = phase.status === DONE ? DONE_COLORS[phase.key] : null
            const isLast = index === steps.length - 1
            return (
              <Fragment key={phase.key}>
                <li
                  className="flex items-center gap-3 min-w-0 sm:shrink-0"
                  aria-current={phase.visualStatus === CURRENT ? 'step' : undefined}
                >
                  <span className={`w-9 h-9 shrink-0 rounded-full border-2 flex items-center justify-center ${doneColors?.circle ?? style.circle}`} aria-hidden="true">
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{style.icon}</span>
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className={`text-sm font-semibold leading-tight ${style.label}`}>
                      {PHASE_TITLES[phase.key] ?? phase.key}
                      <span className="sr-only">{`, ${STATUS_DESCRIPTIONS[phase.visualStatus]}`}</span>
                    </span>
                    <span className="text-xs text-on-surface-variant tabular-nums">{phaseCaption(phase)}</span>
                  </span>
                </li>
                {!isLast && (
                  <li
                    role="presentation"
                    className={`hidden sm:block flex-1 min-w-6 h-0.5 mx-4 rounded-full ${doneColors?.line ?? 'bg-outline-variant'}`}
                  />
                )}
              </Fragment>
            )
          })}
        </ol>
      )}
    </div>
  )
}
