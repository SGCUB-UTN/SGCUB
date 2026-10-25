import { ActionActions, ActionButton, ActionCard } from './actionCardParts'
import { describeWhen } from './automationSchedule'

function LastUpdate({ status }) {
  const lastUpdate = status.ultima_actualizacion
  return (
    <dl className="grid gap-3 text-base sm:grid-cols-2">
      <div>
        <dt className="text-sm font-medium text-slate-500">Última ejecución</dt>
        <dd className="font-semibold text-slate-900">
          {lastUpdate ? (
            <>
              {describeWhen(lastUpdate.fecha)}
              <span className="font-normal text-slate-600"> · por {lastUpdate.ejecutado_por}</span>
            </>
          ) : 'Todavía no se ejecutó'}
        </dd>
      </div>
      <div>
        <dt className="text-sm font-medium text-slate-500">Año de las categorías</dt>
        <dd className="font-semibold text-slate-900">{status.anio_categorias ?? '—'}</dd>
      </div>
    </dl>
  )
}

export default function CategoryUpdatePanel({ status, isLoading, error, canRun, onRun }) {
  return (
    <ActionCard
      icon="event_repeat"
      title="Actualizar categorías al nuevo año"
      description={'Pasa las categorías al año en curso y actualiza el nombre de las infantiles (por ejemplo, "2015" pasa a "2016"). Se hace una vez por año, antes de la recategorización.'}
    >
      {isLoading && <p className="text-base text-slate-500" role="status">Consultando el año de las categorías...</p>}
      {!isLoading && error && (
        <p className="text-base text-red-700" role="alert">No se pudo consultar el año de las categorías. Recargá la página para intentar de nuevo.</p>
      )}
      {!isLoading && status && <LastUpdate status={status} />}
      {!isLoading && !error && canRun && (
        <ActionActions>
          <ActionButton icon="event_repeat" onClick={onRun}>Actualizar categorías</ActionButton>
        </ActionActions>
      )}
    </ActionCard>
  )
}
