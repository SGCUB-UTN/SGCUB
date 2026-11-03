import { Modal } from '@mantine/core'
import DownloadComprobanteButton from './DownloadComprobanteButton'
import WhatsAppComprobanteButton from './WhatsAppComprobanteButton'
import ReciboDevolucion, { RefundResponsable } from './ReciboDevolucion'
import { receiptModalStyles } from './receiptModal'

const MODAL_STYLES = receiptModalStyles()

// Detail of a manual refund or a credit note: neither changes the debt nor the club's income
function DevolucionDetailModal({ devolucion, opened, onClose }) {
  if (!devolucion) return null
  const isCreditNote = devolucion.tipo === 'NotaCredito'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isCreditNote ? 'Nota de crédito' : 'Devolución manual'}
      centered
      size="xl"
      styles={MODAL_STYLES}
    >
      <div className="flex flex-col gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto px-2 thin-scroll [scrollbar-gutter:stable_both-edges] [&>*]:shrink-0">
          <ReciboDevolucion devolucion={devolucion} />
          <RefundResponsable responsable={devolucion.responsable} />
          <p className="text-sm text-on-surface-variant">
            {isCreditNote
              ? 'Devuelve dinero de un comprobante anulado. No modifica la deuda ni los ingresos.'
              : 'Registra dinero devuelto que nunca se contó como ingreso. No modifica la deuda ni los ingresos.'}
          </p>
        </div>

        <div className="shrink-0 pt-3 border-t border-outline-variant/30 flex flex-wrap items-center justify-end gap-3">
          <DownloadComprobanteButton devolucionId={devolucion.devolucion_id} />
          <WhatsAppComprobanteButton
            socio={devolucion.socio}
            devolucionId={devolucion.devolucion_id}
            comprobanteCodigo={devolucion.codigo}
            montoTotal={devolucion.monto}
            tipo={isCreditNote ? 'nota_credito' : 'devolucion'}
          />
        </div>
      </div>
    </Modal>
  )
}

export default DevolucionDetailModal
