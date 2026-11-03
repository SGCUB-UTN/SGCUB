import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal } from '@mantine/core'
import { getComprobante } from '../../api/comprobantes'
import { getConfiguracionGeneral } from '../../api/configuracion'
import { revertirPago } from '../../api/pagos'
import useMediosPago from '../../hooks/useMediosPago'
import useRevertPayment from '../../hooks/useRevertPayment'
import { formatAmount, formatDate } from '../personas/format'
import AuthorizationModal from './AuthorizationModal'
import DownloadComprobanteButton from './DownloadComprobanteButton'
import WhatsAppComprobanteButton from './WhatsAppComprobanteButton'
import NotaCreditoModal from './NotaCreditoModal'
import { availableToRefund } from './refunds'
import ReceiptSkeleton from './ReceiptSkeleton'
import ReciboComprobante from './ReciboComprobante'
import { receiptModalStyles } from './receiptModal'

const ACTION_BUTTON_CLASS = 'inline-flex items-center gap-2 h-10 px-4 border rounded-md font-semibold transition-colors cursor-pointer'

const ANNUL_INCOME_DESCRIPTION = 'El comprobante pasa a anulado y el ingreso deja de contarse. Si hay que devolver el dinero, emití una nota de crédito.'

const MODAL_STYLES = receiptModalStyles()

function InfoRow({ label, children }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="text-right text-on-surface font-medium break-words">{children}</span>
    </div>
  )
}

function CreditNotes({ detalle, methodLabel }) {
  const notes = detalle.notas_credito ?? []
  if (!notes.length) return null
  const available = availableToRefund(detalle)
  return (
    <section className="border border-outline-variant/30 rounded-lg overflow-hidden bg-surface-container-lowest">
      <h3 className="px-3 py-2 bg-surface-container-low border-b border-outline-variant/30 font-semibold text-on-surface">Notas de crédito</h3>
      <div className="divide-y divide-outline-variant/20">
        {notes.map((note) => (
          <div key={note.devolucion_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div className="min-w-0">
              <p className="font-semibold text-on-surface">{note.codigo} · {formatAmount(note.monto)}</p>
              <p className="text-sm text-on-surface-variant break-words">
                {formatDate(note.fecha)} · {methodLabel(note.medio_de_pago)} · Responsable: {note.responsable}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <WhatsAppComprobanteButton
                socio={detalle.socio}
                devolucionId={note.devolucion_id}
                comprobanteCodigo={note.codigo}
                montoTotal={note.monto}
                tipo="nota_credito"
                label="WhatsApp"
                className="h-9 px-3 text-xs min-w-0"
              />
              <DownloadComprobanteButton devolucionId={note.devolucion_id} label="PDF" />
            </div>
          </div>
        ))}
      </div>
      {available > 0 && (
        <div className="flex justify-between px-3 py-2 border-t border-outline-variant/20 bg-surface-container-low text-sm">
          <span className="text-on-surface-variant">Disponible para devolver</span>
          <strong>{formatAmount(available)}</strong>
        </div>
      )}
    </section>
  )
}

function ComprobanteDetailContent({ comprobanteId, opened, onClose, onChanged }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [action, setAction] = useState(null)
  const [justReverted, setJustReverted] = useState(false)
  const [clubConfig, setClubConfig] = useState(null)
  const comprobanteRef = useRef(null)
  const { openReversal } = useRevertPayment()
  const { methodLabel } = useMediosPago()

  const load = useCallback(() => getComprobante(comprobanteId)
    .then((data) => setState({ loading: false, error: '', data }))
    .catch(() => setState({ loading: false, error: 'No se pudo cargar el detalle del comprobante.', data: null })), [comprobanteId])

  useEffect(() => {
    if (opened && comprobanteId) {
      load()
      getConfiguracionGeneral().then(setClubConfig).catch(() => {})
    }
  }, [opened, comprobanteId, load])

  const detalle = state.data
  const pago = detalle?.pago_detalle
  const anulado = detalle?.estado === 'Anulado'
  const isIncome = Boolean(detalle?.es_ingreso)
  const available = detalle ? availableToRefund(detalle) : 0

  // A payment of cuotas is reverted in its own flow, which stays open until the money is settled
  const startReversal = () => {
    if (isIncome) {
      setAction('revert')
      return
    }
    onClose()
    openReversal({ comprobanteId: detalle.comprobante_id, onChanged })
  }

  const annulIncome = async ({ motivo, autorizado_por: responsable }) => {
    const updated = await revertirPago(detalle.pago, { motivo, responsable })
    setState({ loading: false, error: '', data: updated })
    setAction(null)
    setJustReverted(true)
    onChanged?.()
  }

  const creditNoteIssued = () => {
    setAction(null)
    load()
    onChanged?.()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Detalle del comprobante"
      centered
      size="xl"
      styles={MODAL_STYLES}
    >
      {state.loading && <div className="flex-1 min-h-0 overflow-hidden"><ReceiptSkeleton /></div>}
      {state.error && <p className="text-sm text-error" role="alert">{state.error}</p>}
      {detalle && (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto px-2 thin-scroll [scrollbar-gutter:stable_both-edges] [&>*]:shrink-0">
            <ReciboComprobante
              ref={comprobanteRef}
              clubConfig={clubConfig}
              socio={detalle.socio ?? {}}
              detalle={detalle}
              codigo={detalle.codigo}
              fecha={formatDate(detalle.fecha_emision)}
              medios={(pago?.items_pago ?? []).map((item) => ({ medio: methodLabel(item.medio_de_pago), monto: item.monto }))}
              montoTotal={detalle.monto_total}
              observacion={pago?.observacion}
              anulado={anulado}
              anulacion={detalle.anulacion}
            />

            {detalle.anulacion && (
              <section className="flex flex-col gap-1.5 p-3 rounded-lg border border-error/20 bg-error-container/30">
                <h3 className="font-semibold text-error">Anulado</h3>
                <InfoRow label="Fecha">{detalle.anulacion.fecha ? formatDate(detalle.anulacion.fecha) : '—'}</InfoRow>
                <InfoRow label="Motivo">{detalle.anulacion.motivo || '—'}</InfoRow>
                <InfoRow label="Responsable">{detalle.anulacion.responsable || '—'}</InfoRow>
              </section>
            )}

            <CreditNotes detalle={detalle} methodLabel={methodLabel} />

            {justReverted && (
              <div className="p-3 rounded-lg border border-primary/30 bg-primary/5" role="status">
                <p className="font-semibold text-on-surface">Ingreso anulado.</p>
                <p className="text-sm text-on-surface-variant">Si le devolvés el dinero al socio, emití una nota de crédito.</p>
              </div>
            )}
          </div>

          <div className="shrink-0 pt-3 border-t border-outline-variant/30 flex flex-wrap items-center justify-end gap-2">
            {detalle.revertible && (
              <button type="button" onClick={startReversal} className={`${ACTION_BUTTON_CLASS} border-error/40 text-error hover:bg-error-container/40 mr-auto`}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">undo</span>
                {isIncome ? 'Anular ingreso' : 'Revertir pago'}
              </button>
            )}
            {anulado && isIncome && available > 0 && (
              <button
                type="button"
                onClick={() => setAction('creditNote')}
                className={`${ACTION_BUTTON_CLASS} border-outline-variant/60 text-on-surface hover:bg-surface-container-low mr-auto`}
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">currency_exchange</span>
                Emitir nota de crédito
              </button>
            )}

            <DownloadComprobanteButton comprobanteId={detalle.comprobante_id} />
            <WhatsAppComprobanteButton
              socio={detalle.socio}
              comprobanteId={detalle.comprobante_id}
              comprobanteCodigo={detalle.codigo}
              montoTotal={detalle.monto_total}
              clubNombre={clubConfig?.club_nombre}
              comprobanteRef={comprobanteRef}
              tipo={anulado ? 'anulado' : 'comprobante'}
            />
          </div>
        </div>
      )}

      <AuthorizationModal
        opened={action === 'revert'}
        title="Anular ingreso"
        description={ANNUL_INCOME_DESCRIPTION}
        confirmLabel="Anular ingreso"
        confirmIcon="undo"
        authorizerLabel="Responsable"
        authorizerError="Elegí el responsable."
        errorMessage="No se pudo anular el ingreso."
        onConfirm={annulIncome}
        onClose={() => setAction(null)}
      />
      <NotaCreditoModal
        opened={action === 'creditNote'}
        comprobante={detalle}
        onClose={() => setAction(null)}
        onIssued={creditNoteIssued}
      />
    </Modal>
  )
}

// Detail of a receipt with its actions: revert it (or annul an income), charge it again and refund it
function ComprobanteDetailModal({ comprobanteId, opened, onClose, onChanged }) {
  if (!comprobanteId) return null
  return (
    <ComprobanteDetailContent
      key={`${comprobanteId}-${opened}`}
      comprobanteId={comprobanteId}
      opened={opened}
      onClose={onClose}
      onChanged={onChanged}
    />
  )
}

export default ComprobanteDetailModal
