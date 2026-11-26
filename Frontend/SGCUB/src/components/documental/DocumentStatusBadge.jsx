import StatusBadge from '../shared/StatusBadge'

const STATUS_BADGES = {
  vigente: { label: 'Vigente', tono: 'ok' },
  por_vencer: { label: 'Por vencer', tono: 'alerta' },
  vencido: { label: 'Vencido', tono: 'error' },
  faltante: { label: 'Faltante', tono: 'error' },
}

export default function DocumentStatusBadge({ status }) {
  return <StatusBadge size="md" badge={STATUS_BADGES[status] ?? { label: 'Desconocido', tono: 'neutro' }} />
}
