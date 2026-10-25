import { ActionActions, ActionButton, ActionCard, ActionNotice } from './actionCardParts'
import { RECATEGORIZATION_REVIEW_PATH } from './automationCatalog'
import { describeWhen } from './automationSchedule'

const NOTICES = {
  en_curso: {
    icon: 'progress_activity',
    spin: true,
    tone: 'info',
    text: () => 'Se está ejecutando. Puede tardar unos minutos; mientras tanto podés seguir usando el sistema.',
  },
  revision_pendiente: {
    icon: 'pending_actions',
    tone: 'warning',
    text: (execution) => `Hay ${execution.pendientes_sin_revisar} ${execution.pendientes_sin_revisar === 1 ? 'jugador esperando' : 'jugadores esperando'} tu revisión. Cuando termines, vas a poder ejecutarla de nuevo.`,
  },
  finalizada: {
    icon: 'check_circle',
    tone: 'success',
    text: () => 'La última recategorización terminó y no quedan jugadores por revisar.',
  },
  fallida: {
    icon: 'error',
    tone: 'error',
    text: () => 'La última recategorización no se pudo completar. Podés intentarlo de nuevo.',
  },
}

function LastRun({ execution }) {
  const hasResults = ['revision_pendiente', 'finalizada'].includes(execution.estado)
  return (
    <dl className="grid gap-3 text-base sm:grid-cols-2">
      <div>
        <dt className="text-sm font-medium text-slate-500">Última ejecución</dt>
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

function Actions({ execution, canRun, categoriesUpToDate, onRun }) {
  const status = execution?.estado
  if (status === 'en_curso') return null
  if (status === 'revision_pendiente') {
    return <ActionButton to={RECATEGORIZATION_REVIEW_PATH} iconAfter="arrow_forward">Revisar jugadores</ActionButton>
  }
  return (
    <>
      {status === 'finalizada' && (
        <ActionButton to={RECATEGORIZATION_REVIEW_PATH} variant="secondary" icon="list_alt">Ver resultados</ActionButton>
      )}
      {canRun && (
        <ActionButton icon="bolt" onClick={onRun} disabled={!categoriesUpToDate}>Ejecutar recategorización</ActionButton>
      )}
    </>
  )
}

export default function RecategorizationPanel({ execution, isLoading, error, categories, canRun, onRun }) {
  const notice = execution ? NOTICES[execution.estado] : null
  const isActive = ['en_curso', 'revision_pendiente'].includes(execution?.estado)
  const categoriesUpToDate = categories?.actualizadas ?? true

  return (
    <ActionCard
      icon="sync"
      title="Recategorización de jugadores"
      description="Asigna a cada jugador activo la categoría que le corresponde por su año de nacimiento. Los casos dudosos quedan para que los revises vos."
    >
      {isLoading && <p className="text-base text-slate-500" role="status">Consultando la última recategorización...</p>}
      {!isLoading && error && (
        <p className="text-base text-red-700" role="alert">No se pudo consultar la recategorización. Recargá la página para intentar de nuevo.</p>
      )}
      {!isLoading && !error && !execution && (
        <p className="text-base text-slate-600">Todavía no se ejecutó ninguna recategorización.</p>
      )}
      {!isLoading && execution && <LastRun execution={execution} />}

      {!isLoading && notice && (
        <ActionNotice tone={notice.tone} icon={notice.icon} spin={notice.spin}>{notice.text(execution)}</ActionNotice>
      )}
      {!isLoading && !isActive && !categoriesUpToDate && (
        <ActionNotice tone="warning" icon="event_repeat">
          Primero ejecutá "Actualizar categorías al nuevo año" para {categories.anio_actual} (tarjeta de arriba). Después vas a poder ejecutar la recategorización.
        </ActionNotice>
      )}

      {!isLoading && !error && (
        <ActionActions>
          <Actions execution={execution} canRun={canRun} categoriesUpToDate={categoriesUpToDate} onRun={onRun} />
        </ActionActions>
      )}
    </ActionCard>
  )
}
