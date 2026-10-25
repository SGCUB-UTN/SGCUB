const STATUS_STYLES = {
  en_curso: { label: 'En curso', badge: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  revision_pendiente: { label: 'Revisión pendiente', badge: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  finalizada: { label: 'Finalizada', badge: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  fallida: { label: 'Fallida', badge: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
}

const formatRunDate = (value) => {
  const date = new Date(value)
  const day = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
  const time = new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(date)
  return `${day} - ${time} hs`
}

function RunDetails({ execution }) {
  const hasResults = ['revision_pendiente', 'finalizada'].includes(execution.estado)

  return (
    <div className="flex flex-col gap-2 text-sm text-slate-600">
      <p className="inline-flex flex-wrap items-center gap-1.5">
        <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden="true">schedule</span>
        <span className="font-medium text-slate-700">Última ejecución:</span>
        {formatRunDate(execution.fecha_inicio)}
        <span className="text-slate-500">(Por: {execution.ejecutado_por})</span>
      </p>
      <p className="inline-flex flex-wrap items-center gap-1.5">
        <span className="material-symbols-outlined text-[18px] text-slate-400" aria-hidden="true">bar_chart</span>
        <span className="font-medium text-slate-700">Resultado anterior:</span>
        {hasResults ? (
          <>
            <span className="font-semibold text-emerald-700">{execution.exitosos} Exitosos</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-amber-700">{execution.pendientes} Pendientes</span>
            <span className="text-slate-300">|</span>
            <span className="font-semibold text-red-700">{execution.errores} Errores</span>
          </>
        ) : (
          <span>{execution.estado === 'en_curso' ? 'Procesando jugadores...' : 'La ejecución no pudo completarse.'}</span>
        )}
      </p>
    </div>
  )
}

export default function RecategorizationPanel({ execution, isLoading, error, canRun, onRun }) {
  const status = execution ? STATUS_STYLES[execution.estado] : null
  const isRunning = execution?.estado === 'en_curso'
  const hasPendingReviews = execution?.estado === 'revision_pendiente'
  const blockedReason = isRunning
    ? 'La recategorización se está ejecutando. Puede tardar unos minutos.'
    : hasPendingReviews
      ? `Resolvé las ${execution.pendientes_sin_revisar} revisiones pendientes antes de volver a ejecutarla.`
      : ''

  return (
    <section aria-labelledby="recategorization-title" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700" aria-hidden="true">
              sync
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 id="recategorization-title" className="font-bold uppercase tracking-wide text-slate-900">
                  Recategorización automática de jugadores
                </h2>
                {status && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${status.badge}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot} ${isRunning ? 'animate-pulse' : ''}`} />
                    {status.label}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Revisa el padrón activo según el año de nacimiento y actualiza las categorías vigentes.
              </p>
            </div>
          </div>

          {isLoading && <p className="text-sm text-slate-500" role="status">Consultando la última ejecución...</p>}
          {!isLoading && error && (
            <p className="text-sm text-red-700" role="alert">No se pudo consultar el estado de la recategorización.</p>
          )}
          {!isLoading && !error && !execution && (
            <p className="text-sm text-slate-500">Todavía no se ejecutó ninguna recategorización.</p>
          )}
          {!isLoading && execution && <RunDetails execution={execution} />}
        </div>

        {canRun && (
          <div className="flex shrink-0 flex-col items-stretch gap-2 lg:items-end">
            <button
              type="button"
              onClick={onRun}
              disabled={isLoading || Boolean(blockedReason)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className={`material-symbols-outlined text-[18px] ${isRunning ? 'animate-spin' : ''}`} aria-hidden="true">
                {isRunning ? 'progress_activity' : 'bolt'}
              </span>
              {isRunning ? 'Ejecutando...' : 'Ejecutar recategorización'}
            </button>
            {blockedReason && <p className="max-w-xs text-xs text-slate-500 lg:text-right">{blockedReason}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
