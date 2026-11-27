import { useState } from 'react'
import { Modal } from '@mantine/core'
import DownloadComprobanteButton from './DownloadComprobanteButton'
import WhatsAppComprobanteButton from './WhatsAppComprobanteButton'
import ReciboDevolucion, { RefundResponsable } from './ReciboDevolucion'
import ViewFinancesButton from './ViewFinancesButton'
import CancelRefundModal, { CancelRefundButton } from './CancelRefundModal'
import { receiptModalStyles } from './receiptModal'
import { isCancelledRefund } from './refunds'
import { CancellationNotice } from './formParts'

const MODAL_STYLES = receiptModalStyles()

function DevolucionDetailContent({ devolucion: initialDevolucion, opened, onClose, onChanged, readOnly }) {
  const [devolucion, setDevolucion] = useState(initialDevolucion)
  const [cancelling, setCancelling] = useState(false)
  const isCreditNote = devolucion.tipo === 'NotaCredito'
  const cancelled = isCancelledRefund(devolucion)

  const refundCancelled = (updated) => {
    setDevolucion(updated)
    setCancelling(false)
    onChanged?.()
  }

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
          {cancelled && (
            <CancellationNotice
              action={isCreditNote ? 'Nota de crédito cancelada' : 'Devolución cancelada'}
              date={devolucion.fecha_cancelacion}
              authorizedBy={devolucion.cancelado_por}
              reason={devolucion.motivo_cancelacion}
              consequence="Ya no cuenta como dinero devuelto y su comprobante no se puede descargar ni enviar."
            />
          )}
          <ReciboDevolucion devolucion={devolucion} />
          <RefundResponsable responsable={devolucion.responsable} />
          <p className="text-sm text-on-surface-variant">
            {isCreditNote
              ? 'Devuelve dinero de un comprobante anulado. No modifica la deuda ni los ingresos.'
              : 'Registra dinero devuelto que nunca se contó como ingreso. No modifica la deuda ni los ingresos.'}
          </p>
        </div>

        <div className="shrink-0 pt-3 border-t border-outline-variant/30 flex flex-wrap items-center justify-end gap-2">
          <ViewFinancesButton socio={devolucion.socio} onNavigate={onClose} />
          {!readOnly && !cancelled && <CancelRefundButton onClick={() => setCancelling(true)} />}
          {!cancelled && (
            <>
              <DownloadComprobanteButton devolucionId={devolucion.devolucion_id} />
              <WhatsAppComprobanteButton
                socio={devolucion.socio}
                devolucionId={devolucion.devolucion_id}
                comprobanteCodigo={devolucion.codigo}
                montoTotal={devolucion.monto}
                tipo={isCreditNote ? 'nota_credito' : 'devolucion'}
              />
            </>
          )}
        </div>
      </div>

      <CancelRefundModal
        opened={cancelling}
        devolucion={devolucion}
        onClose={() => setCancelling(false)}
        onCancelled={refundCancelled}
      />
    </Modal>
  )
}

// Detail of a manual refund or a credit note: neither changes the debt nor the club's income
function DevolucionDetailModal({ devolucion, opened, onClose, onChanged, readOnly = false }) {
  if (!devolucion) return null
  return (
    <DevolucionDetailContent
      key={`${devolucion.devolucion_id}-${opened}`}
      devolucion={devolucion}
      opened={opened}
      onClose={onClose}
      onChanged={onChanged}
      readOnly={readOnly}
    />
  )
}

export default DevolucionDetailModal
