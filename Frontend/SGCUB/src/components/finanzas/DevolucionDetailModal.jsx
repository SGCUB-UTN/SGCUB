import { Modal } from '@mantine/core'
import DownloadComprobanteButton from './DownloadComprobanteButton'
import WhatsAppComprobanteButton from './WhatsAppComprobanteButton'
import ReciboDevolucion, { RefundResponsable } from './ReciboDevolucion'
import { receiptModalStyles } from './receiptModal'
import { isCancelledRefund } from './refunds'
import { formatDate } from '../personas/format'

const MODAL_STYLES = receiptModalStyles()

// Detail of a manual refund or a credit note: neither changes the debt nor the club's income
function DevolucionDetailModal({ devolucion, opened, onClose }) {
  if (!devolucion) return null
  const isCreditNote = devolucion.tipo === 'NotaCredito'
  const cancelled = isCancelledRefund(devolucion)

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
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-error-container/50 border border-error/30 text-on-error-container" role="status">
              <span className="material-symbols-outlined text-[20px] text-error shrink-0" aria-hidden="true">cancel</span>
              <div className="flex flex-col gap-0.5 text-sm">
                <p className="font-semibold">
                  Cancelada el {formatDate(devolucion.fecha_cancelacion)} por {devolucion.cancelado_por || '—'}
                </p>
                <p className="break-words">Motivo: {devolucion.motivo_cancelacion || 'Sin motivo registrado'}</p>
                <p>Ya no cuenta como dinero devuelto y su comprobante no se puede descargar ni enviar.</p>
              </div>
            </div>
          )}
          <ReciboDevolucion devolucion={devolucion} />
          <RefundResponsable responsable={devolucion.responsable} />
          <p className="text-sm text-on-surface-variant">
            {isCreditNote
              ? 'Devuelve dinero de un comprobante anulado. No modifica la deuda ni los ingresos.'
              : 'Registra dinero devuelto que nunca se contó como ingreso. No modifica la deuda ni los ingresos.'}
          </p>
        </div>

        {!cancelled && (
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
        )}
      </div>
    </Modal>
  )
}

export default DevolucionDetailModal
