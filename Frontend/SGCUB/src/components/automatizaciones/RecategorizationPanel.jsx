import { ActionButton, ActionCard, ActionFooter, ActionNotice, ActionSummary } from './actionCardParts'
import { RECATEGORIZATION_REVIEW_PATH } from './automationCatalog'
import { describeWhen } from './automationSchedule'

const NOTICES = {
  en_curso: {
    icon: 'progress_activity',
    spin: true,
    tone: 'info',
    text: () => 'Se está ejecutando. Puede tardar unos minutos; mientras tanto podés seguir usando el sistema.',
  },
}

const lastRunLabel = (execution) => (execution
  ? <>{describeWhen(execution.fecha_inicio)}<span className="font-normal text-slate-600"> · por {execution.ejecutado_por}</span></>
  : 'Todavía no se ejecutó')

function Actions({ execution, canRun, categoriesUpToDate, onRun }) {
  const status = execution?.estado
  if (status === 'en_curso') return null
  if (status === 'revision_pendiente') {
    return <ActionButton to={RECATEGORIZATION_REVIEW_PATH} iconAfter="arrow_forward">Revisar jugadores</ActionButton>
  }
  return (
    <>
      {status === 'finalizada' && (
        <ActionButton to={RECATEGORIZATION_REVIEW_PATH} variant="secondary" >Ver último resultado</ActionButton>
      )}
      {canRun && (
        <ActionButton onClick={onRun} disabled={!categoriesUpToDate}>Ejecutar recategorización</ActionButton>
      )}
    </>
  )
}

function ResultCounts({ execution }) {
  return (
    <>
      <span className="font-semibold text-emerald-700">{execution.exitosos} actualizados</span>
      <span className="font-semibold text-amber-700">{execution.pendientes} para revisar</span>
      <span className="font-semibold text-red-700">{execution.errores} con errores</span>
    </>
  )
}

function PendingReviewFooter({ execution }) {
  const remaining = execution.pendientes_sin_revisar + execution.errores_sin_revisar
  return (
    <ActionFooter icon="pending_actions">
      <span className="font-bold">La revisión todavía no finalizó.</span>
      <span className="text-amber-800">
        Faltan {remaining} {remaining === 1 ? 'jugador' : 'jugadores'}.
      </span>
      <span className="text-amber-800">Resultado:</span>
      <ResultCounts execution={execution} />
    </ActionFooter>
  )
}

function CategoriesOutdatedFooter() {
  return (
    <ActionFooter icon="event_repeat">
      <span className="font-bold">Las categorías no están actualizadas al nuevo año.</span>
      <span className="text-amber-800">
        Ejecutá "Actualizar categorías al nuevo año" para poder ejecutar la recategorización.
      </span>
    </ActionFooter>
  )
}

function FailedRunFooter() {
  return (
    <ActionFooter tone="error" icon="error">
      <span className="font-bold">La última recategorización no se pudo completar.</span>
      <span className="text-red-800">Podés intentarlo de nuevo.</span>
    </ActionFooter>
  )
}

export default function RecategorizationPanel({ execution, isLoading, error, categories, canRun, onRun }) {
  const notice = execution ? NOTICES[execution.estado] : null
  const isActive = ['en_curso', 'revision_pendiente'].includes(execution?.estado)
  const isPendingReview = execution?.estado === 'revision_pendiente'
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
      {!isLoading && !error && (
        <ActionSummary
          items={[
            { label: 'Categorizados al año', value: execution?.anio ?? '—' },
            { label: 'Última ejecución', value: lastRunLabel(execution) },
          ]}
          actions={<Actions execution={execution} canRun={canRun} categoriesUpToDate={categoriesUpToDate} onRun={onRun} />}
        />
      )}

      {!isLoading && notice && (
        <ActionNotice tone={notice.tone} icon={notice.icon} spin={notice.spin}>{notice.text(execution)}</ActionNotice>
      )}
      {!isLoading && !error && !isActive && !categoriesUpToDate && <CategoriesOutdatedFooter />}
      {!isLoading && isPendingReview && <PendingReviewFooter execution={execution}/>}
      {!isLoading && execution?.estado === 'fallida' && <FailedRunFooter />}
    </ActionCard>
  )
}
