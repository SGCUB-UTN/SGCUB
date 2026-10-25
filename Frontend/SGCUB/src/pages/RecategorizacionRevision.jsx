import { PERMISSIONS } from '../auth/permissions'
import { useAuth } from '../auth/useAuth'
import { ActionButton, ActionNotice } from '../components/automatizaciones/actionCardParts'
import RecategorizationResults from '../components/automatizaciones/RecategorizationResults'
import PageHeader from '../components/shared/PageHeader'
import useRecategorization from '../hooks/useRecategorization'

const AUTOMATIONS_PATH = '/automatizaciones'

function ReviewProgress({ execution }) {
  const reviewed = execution.pendientes - execution.pendientes_sin_revisar
  const percent = execution.pendientes ? Math.round((reviewed / execution.pendientes) * 100) : 100

  if (execution.pendientes_sin_revisar === 0) {
    return (
      <ActionNotice tone="success" icon="task_alt">
        <strong>¡Listo!</strong> Revisaste todos los jugadores y la recategorización {execution.anio} quedó finalizada.
        Podés volver a Automatizaciones o corregir cualquier jugador desde las pestañas.
      </ActionNotice>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-base">
        <p className="font-semibold text-slate-900">
          Revisaste {reviewed} de {execution.pendientes} jugadores
        </p>
        <p className="text-slate-600">
          Faltan <strong className="text-amber-700">{execution.pendientes_sin_revisar}</strong>
        </p>
      </div>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-amber-100"
        role="progressbar"
        aria-label="Avance de la revisión"
        aria-valuemin={0}
        aria-valuemax={execution.pendientes}
        aria-valuenow={reviewed}
      >
        <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-sm text-slate-500">
        Las decisiones se guardan al instante: podés salir y continuar más tarde.
      </p>
    </div>
  )
}

export default function RecategorizacionRevision() {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission(PERMISSIONS.editAutomations)
  const { execution, isLoading, error, setExecution } = useRecategorization()
  const hasResults = ['revision_pendiente', 'finalizada'].includes(execution?.estado)

  return (
    <div className="min-h-full bg-slate-50/70 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <PageHeader
          breadcrumb={[
            { label: 'Administración' },
            { label: 'Automatizaciones', to: AUTOMATIONS_PATH },
            { label: 'Revisión de la recategorización' },
          ]}
          title={execution?.anio ? `Revisión de la recategorización ${execution.anio}` : 'Revisión de la recategorización'}
          actions={(
            <ActionButton to={AUTOMATIONS_PATH} variant="secondary" icon="arrow_back">Volver a Automatizaciones</ActionButton>
          )}
        />

        {isLoading && (
          <p className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-base text-slate-500" role="status">
            Cargando la recategorización...
          </p>
        )}
        {!isLoading && error && (
          <ActionNotice tone="error" icon="error">
            No se pudo cargar la recategorización. Recargá la página para intentar de nuevo.
          </ActionNotice>
        )}
        {!isLoading && !error && execution?.estado === 'en_curso' && (
          <ActionNotice tone="info" icon="progress_activity" spin>
            La recategorización se está ejecutando. Cuando termine, los resultados van a aparecer acá.
          </ActionNotice>
        )}
        {!isLoading && !error && !hasResults && execution?.estado !== 'en_curso' && (
          <ActionNotice tone="info" icon="info">
            No hay resultados para revisar. Ejecutá la recategorización desde Automatizaciones.
          </ActionNotice>
        )}

        {!isLoading && hasResults && (
          <>
            <ReviewProgress execution={execution} />
            <RecategorizationResults
              key={execution.id}
              execution={execution}
              canEdit={canEdit}
              onExecutionChange={setExecution}
            />
          </>
        )}
      </div>
    </div>
  )
}
