import { ActionButton, ActionCard, ActionSummary } from './actionCardParts'
import { describeWhen } from './automationSchedule'

const lastRunLabel = (run) => (run
  ? <>{describeWhen(run.fecha)}<span className="font-normal text-slate-600"> · por {run.ejecutado_por}</span></>
  : 'Todavía no se ejecutó')

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
      {!isLoading && status && (
        <ActionSummary
          items={[
            { label: 'Año de las categorías', value: status.anio_categorias ?? '—' },
            { label: 'Última ejecución', value: lastRunLabel(status.ultima_actualizacion) },
          ]}
          actions={canRun && <ActionButton icon="event_repeat" onClick={onRun}>Actualizar categorías</ActionButton>}
        />
      )}
    </ActionCard>
  )
}
