import { useState } from 'react'
import TaskRunList from './TaskRunList'
import { formatDateTime } from './cuotaPeriod'

const HISTORY_ID = 'automation-history'
const TOGGLE_BUTTON_CLASS = 'inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 shrink-0'

const latestRun = (runs) => runs.reduce((latest, run) => (run.fecha_inicio > latest.fecha_inicio ? run : latest))

function runsStatus(runs, isLoading, error) {
  if (!runs) {
    if (isLoading) return { icon: 'progress_activity', iconClass: 'text-outline animate-spin', text: 'Cargando…' }
    return { icon: 'error', iconClass: 'text-error', text: error ? 'No se pudo cargar el estado.' : '' }
  }
  if (runs.length === 0) {
    return { icon: 'schedule', iconClass: 'text-outline', text: 'Todavía no hay ejecuciones en este período' }
  }
  const failed = runs.filter((run) => !run.exitosa).length
  const date = formatDateTime(latestRun(runs).fecha_inicio)
  if (failed > 0) {
    return {
      icon: 'error',
      iconClass: 'text-error',
      text: `${failed} ${failed === 1 ? 'ejecución con fallos' : 'ejecuciones con fallos'} (${date})`,
    }
  }
  return { icon: 'check_circle', iconClass: 'text-emerald-600', text: `Aplicadas correctamente, sin fallos (${date})` }
}

export default function AutomationStatus({ runs, isLoading, error, onOpenLog }) {
  const [expanded, setExpanded] = useState(false)
  const status = runsStatus(runs, isLoading, error)

  return (
    <div role="region" aria-label="Automatizaciones">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-outline-variant/30 bg-surface-container-low">
        <p className="flex items-center gap-2 text-sm text-on-surface min-w-0">
          <span className={`material-symbols-outlined shrink-0 ${status.iconClass}`} style={{ fontSize: 20 }} aria-hidden="true">{status.icon}</span>
          <span>
            <strong className="font-semibold">Automatizaciones:</strong> {status.text}
          </span>
        </p>
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-controls={HISTORY_ID}
          className={`${TOGGLE_BUTTON_CLASS} self-start sm:self-auto`}
        >
          <span className={`material-symbols-outlined transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 18 }} aria-hidden="true">expand_more</span>
          {expanded ? 'Ocultar historial' : 'Ver historial completo'}
        </button>
      </div>
      {expanded && (
        <div id={HISTORY_ID} className="p-4 sm:p-5">
          <TaskRunList runs={runs} isLoading={isLoading} error={error} onOpenLog={onOpenLog} />
        </div>
      )}
    </div>
  )
}
