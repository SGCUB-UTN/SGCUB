import { Link } from 'react-router-dom'
import { RECATEGORIZATION_REVIEW_PATH } from './automationCatalog'
import { describeWhen } from './automationSchedule'

const PRIMARY_BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 rounded-lg bg-sky-700 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2'
const SECONDARY_BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2'

const NOTICES = {
  en_curso: {
    icon: 'progress_activity',
    iconClass: 'animate-spin',
    tone: 'border-sky-200 bg-sky-50 text-sky-900',
    text: () => 'Se está ejecutando. Puede tardar unos minutos; mientras tanto podés seguir usando el sistema.',
  },
  revision_pendiente: {
    icon: 'pending_actions',
    tone: 'border-amber-200 bg-amber-50 text-amber-900',
    text: (execution) => `Hay ${execution.pendientes_sin_revisar} ${execution.pendientes_sin_revisar === 1 ? 'jugador esperando' : 'jugadores esperando'} tu revisión. Cuando termines, vas a poder ejecutarla de nuevo.`,
  },
  finalizada: {
    icon: 'check_circle',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    text: () => 'La última recategorización terminó y no quedan jugadores por revisar.',
  },
  fallida: {
    icon: 'error',
    tone: 'border-red-200 bg-red-50 text-red-900',
    text: () => 'La última recategorización no se pudo completar. Podés intentarlo de nuevo.',
  },
}

function LastRun({ execution }) {
  const hasResults = ['revision_pendiente', 'finalizada'].includes(execution.estado)
  return (
    <dl className="grid gap-3 text-base sm:grid-cols-2">
      <div>
        <dt className="text-sm font-medium text-slate-500">Última vez</dt>
        <dd className="font-semibold text-slate-900">
          {describeWhen(execution.fecha_inicio)}
          <span className="font-normal text-slate-600"> · por {execution.ejecutado_por}</span>
        </dd>
      </div>
      {hasResults && (
        <div>
          <dt className="text-sm font-medium text-slate-500">Resultado</dt>
          <dd className="flex flex-wrap gap-x-3 gap-y-1 font-semibold">
            <span className="text-emerald-700">{execution.exitosos} actualizados</span>
            <span className="text-amber-700">{execution.pendientes} para revisar</span>
            <span className="text-red-700">{execution.errores} con errores</span>
          </dd>
        </div>
      )}
    </dl>
  )
}

function Actions({ execution, canRun, onRun }) {
  const status = execution?.estado
  if (status === 'en_curso') return null
  if (status === 'revision_pendiente') {
    return (
      <Link to={RECATEGORIZATION_REVIEW_PATH} className={PRIMARY_BUTTON_CLASS}>
        Revisar jugadores
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_forward</span>
      </Link>
    )
  }
  return (
    <>
      {status === 'finalizada' && (
        <Link to={RECATEGORIZATION_REVIEW_PATH} className={SECONDARY_BUTTON_CLASS}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">list_alt</span>
          Ver resultados
        </Link>
      )}
      {canRun && (
        <button type="button" onClick={onRun} className={PRIMARY_BUTTON_CLASS}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">bolt</span>
          Ejecutar recategorización
        </button>
      )}
    </>
  )
}

export default function RecategorizationPanel({ execution, isLoading, error, canRun, onRun }) {
  const notice = execution ? NOTICES[execution.estado] : null

  return (
    <article className="flex flex-col gap-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700" aria-hidden="true">
          <span className="material-symbols-outlined text-[28px]">sync</span>
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-slate-900">Recategorización de jugadores</h3>
          <p className="mt-1 text-base text-slate-600">
            Asigna a cada jugador activo la categoría que le corresponde por su año de nacimiento.
            Los casos dudosos quedan para que los revises vos.
          </p>
        </div>
      </div>

      {isLoading && <p className="text-base text-slate-500" role="status">Consultando la última recategorización...</p>}
      {!isLoading && error && (
        <p className="text-base text-red-700" role="alert">No se pudo consultar la recategorización. Recargá la página para intentar de nuevo.</p>
      )}
      {!isLoading && !error && !execution && (
        <p className="text-base text-slate-600">Todavía no se ejecutó ninguna recategorización.</p>
      )}
      {!isLoading && execution && <LastRun execution={execution} />}

      {!isLoading && notice && (
        <div className={`flex items-start gap-3 rounded-lg border p-4 text-base ${notice.tone}`} role="status">
          <span className={`material-symbols-outlined shrink-0 text-[22px] ${notice.iconClass ?? ''}`} aria-hidden="true">{notice.icon}</span>
          <p>{notice.text(execution)}</p>
        </div>
      )}

      {!isLoading && !error && (
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          <Actions execution={execution} canRun={canRun} onRun={onRun} />
        </div>
      )}
    </article>
  )
}
