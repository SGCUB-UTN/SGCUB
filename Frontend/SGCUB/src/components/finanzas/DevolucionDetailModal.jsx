import { Modal } from '@mantine/core'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'

function Row({ label, children }) {
  return (
    <div className="flex justify-between gap-3 px-3 py-2 border-t border-outline-variant/20 first:border-t-0">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-right font-semibold text-on-surface break-words">{children}</span>
    </div>
  )
}

// Detail of a manual refund or a credit note: neither changes the debt nor the club's income
function DevolucionDetailModal({ devolucion, opened, onClose }) {
  if (!devolucion) return null
  const isCreditNote = devolucion.tipo === 'NotaCredito'

  return (
    <Modal opened={opened} onClose={onClose} title={isCreditNote ? 'Nota de crédito' : 'Devolución manual'} centered size="md">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
          <span className="material-symbols-outlined text-error text-3xl" aria-hidden="true">currency_exchange</span>
          <div className="min-w-0">
            <p className="text-sm text-on-surface-variant">{devolucion.tipo_nombre}</p>
            <p className="text-xl font-bold text-on-surface">{devolucion.codigo}</p>
          </div>
        </div>

        {devolucion.socio && (
          <div className="p-3 rounded-lg bg-surface-container-low">
            <p className="text-sm text-on-surface-variant">Socio</p>
            <p className="font-semibold text-on-surface">{devolucion.socio.apellido}, {devolucion.socio.nombre} · DNI {formatDni(devolucion.socio.dni)} · Socio N° {devolucion.socio.numero_socio}</p>
          </div>
        )}

        <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
          <Row label="Fecha">{formatDate(devolucion.fecha)}</Row>
          <Row label="Concepto">{devolucion.concepto}</Row>
          {isCreditNote && <Row label="Comprobante anulado">{devolucion.comprobante_anulado_codigo}</Row>}
          <Row label="Medio de devolución">{devolucion.medio_de_pago_nombre}</Row>
          <Row label="Responsable">{devolucion.responsable}</Row>
          <div className="flex justify-between gap-3 px-3 py-2 border-t border-outline-variant/20 bg-surface-container-low">
            <strong>Total devuelto</strong>
            <strong className="text-lg text-error">{formatAmount(devolucion.monto)}</strong>
          </div>
        </section>

        <p className="text-sm text-on-surface-variant">
          {isCreditNote
            ? 'Devuelve dinero de un comprobante anulado. No modifica la deuda ni los ingresos.'
            : 'Registra dinero devuelto que nunca se contó como ingreso. No modifica la deuda ni los ingresos.'}
        </p>

        <DownloadComprobanteButtom devolucionId={devolucion.devolucion_id} />
      </div>
    </Modal>
  )
}

export default DevolucionDetailModal
