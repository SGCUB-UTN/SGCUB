import { formatDayMonthTime } from './cuotaPeriod'

const TASK_ICONS = {
  Generacion: 'request_quote',
  Recargo1: 'event_busy',
  Recargo2: 'event_busy',
}

const LOG_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border border-outline-variant/50 text-sm font-semibold text-primary hover:bg-surface-container-low transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 shrink-0'

function RunMeta({ run }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-on-surface-variant">
      <span className="inline-flex items-center gap-1">
        <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">{TASK_ICONS[run.tipo] ?? 'schedule'}</span>
        {run.tipo_display}
      </span>
      <span aria-hidden="true">·</span>
      <span>{run.origen_display}{run.usuario ? ` por ${run.usuario}` : ''}</span>
      {!run.exitosa && (
        <>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 font-semibold text-error">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }} aria-hidden="true">error</span>
            Con observaciones
          </span>
        </>
      )}
    </p>
  )
}

export default function TaskRunList({ runs, isLoading, error, onOpenLog }) {
  if (!runs) {
    if (isLoading) {
      return (
        <div className="flex flex-col gap-3 animate-pulse" aria-hidden="true">
          {[0, 1].map((index) => <div key={index} className="h-12 rounded bg-surface-container" />)}
        </div>
      )
    }
    return <p className="text-sm text-error">{error ? 'No se pudo cargar el historial de automatizaciones.' : ''}</p>
  }

  if (runs.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-on-surface-variant py-2">
        <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">history</span>
        Todavía no hay ejecuciones registradas para este período.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-outline-variant/30 -my-1">
      {runs.map((run) => (
        <li key={run.ejecucion_id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3">
          <time
            dateTime={run.fecha_inicio}
            className="flex items-center gap-2 text-sm font-semibold text-on-surface tabular-nums sm:w-32 shrink-0"
          >
            <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 18 }} aria-hidden="true">calendar_month</span>
            {formatDayMonthTime(run.fecha_inicio)}
          </time>
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <p className="text-sm text-on-surface line-clamp-2" title={run.resumen}>{run.resumen}</p>
            <RunMeta run={run} />
          </div>
          <button type="button" onClick={() => onOpenLog(run)} className={`${LOG_BUTTON_CLASS} self-start sm:self-auto`}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">description</span>
            Ver log completo
          </button>
        </li>
      ))}
    </ul>
  )
}
