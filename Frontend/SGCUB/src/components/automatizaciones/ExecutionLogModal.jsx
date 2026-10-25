import { Modal, Text } from '@mantine/core'
import { describeChanges } from './automationCatalog'

// Keys of the summary each task stores in django-q (finanzas.services)
const DETAIL_LABELS = {
  fecha: 'Fecha',
  periodo: 'Período',
  cuotas_creadas: 'Cuotas creadas',
  cuotas_existentes: 'Cuotas que ya existían',
  items_sociales: 'Ítems de cuota social',
  items_deportivos: 'Ítems de cuota deportiva',
  cuotas_revisadas: 'Cuotas revisadas',
  recargos_primer_vencimiento: 'Recargos del 1er vencimiento',
  recargos_segundo_vencimiento: 'Recargos del 2do vencimiento',
  monto_total: 'Monto total de recargos',
  estados_actualizados: 'Estados de cuota actualizados',
  becas_finalizadas: 'Becas finalizadas',
}

const formatValue = (key, value) => {
  if (key === 'monto_total') {
    return Number(value).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
  }
  return typeof value === 'number' ? value.toLocaleString('es-AR') : String(value)
}

function ExecutionDetail({ execution }) {
  const { detail } = execution
  if (detail && typeof detail === 'object') {
    return (
      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {Object.entries(detail).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
            <dt className="text-slate-600">{DETAIL_LABELS[key] ?? key}</dt>
            <dd className="font-semibold text-slate-900">{formatValue(key, value)}</dd>
          </div>
        ))}
      </dl>
    )
  }
  return (
    <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700">
      {detail || 'La ejecución no dejó registro.'}
    </pre>
  )
}

export default function ExecutionLogModal({ execution, onClose }) {
  return (
    <Modal
      opened={Boolean(execution)}
      onClose={onClose}
      title={<Text fw={700} size="xl">Registro de la ejecución</Text>}
      centered
      size="lg"
    >
      {execution && (
        <div className="flex flex-col gap-4">
          <p className="text-base text-slate-700">
            <strong>{execution.automation}</strong>
            {' · '}
            <span className={execution.success ? 'text-emerald-700' : 'text-red-700'}>
              {execution.success ? describeChanges(execution) : 'Fallida'}
            </span>
          </p>
          <ExecutionDetail execution={execution} />
        </div>
      )}
    </Modal>
  )
}
