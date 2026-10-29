import { useCallback, useEffect, useState } from 'react'
import { Modal } from '@mantine/core'
import { getComprobante } from '../../api/comprobantes'
import { revertirPago } from '../../api/pagos'
import useMediosPago from '../../hooks/useMediosPago'
import useRegisterPayment from '../../hooks/useRegisterPayment'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import AuthorizationModal from './AuthorizationModal'
import DesgloseComprobante from './DesgloseComprobante'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import NotaCreditoModal from './NotaCreditoModal'
import { availableToRefund, reversalOf } from './refunds'

const ACTION_BUTTON_CLASS = 'inline-flex items-center gap-2 h-10 px-4 border rounded-md font-semibold transition-colors cursor-pointer'

const REVERT_DESCRIPTIONS = {
  payment: 'El comprobante pasa a anulado y la deuda de las cuotas vuelve a como estaba, con los recargos de los vencimientos que ya pasaron. Después vas a poder volver a cobrarlo o devolver el dinero con una nota de crédito.',
  income: 'El comprobante pasa a anulado y el ingreso deja de contarse. Si hay que devolver el dinero, emití una nota de crédito.',
}

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
  return (
    <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
      <h3 className="px-3 py-2 bg-surface-container-low font-semibold text-on-surface">Notas de crédito</h3>
      {notes.map((note) => (
        <div key={note.devolucion_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-outline-variant/20">
          <div className="min-w-0">
            <p className="font-semibold text-on-surface">{note.codigo} · {formatAmount(note.monto)}</p>
            <p className="text-sm text-on-surface-variant break-words">
              {formatDate(note.fecha)} · {methodLabel(note.medio_de_pago)} · Responsable: {note.responsable}
            </p>
          </div>
          <DownloadComprobanteButtom devolucionId={note.devolucion_id} label="PDF" />
        </div>
      ))}
      <div className="flex justify-between px-3 py-2 border-t border-outline-variant/20 bg-surface-container-low text-sm">
        <span className="text-on-surface-variant">Disponible para devolver</span>
        <strong>{formatAmount(availableToRefund(detalle))}</strong>
      </div>
    </section>
  )
}

function ComprobanteDetailContent({ comprobanteId, opened, onClose, onChanged }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [action, setAction] = useState(null)
  const [justReverted, setJustReverted] = useState(false)
  const { openPayment } = useRegisterPayment()
  const { methodLabel } = useMediosPago()

  const load = useCallback(() => getComprobante(comprobanteId)
    .then((data) => setState({ loading: false, error: '', data }))
    .catch(() => setState({ loading: false, error: 'No se pudo cargar el detalle del comprobante.', data: null })), [comprobanteId])

  useEffect(() => {
    if (opened && comprobanteId) load()
  }, [opened, comprobanteId, load])

  const detalle = state.data
  const pago = detalle?.pago_detalle
  const anulado = detalle?.estado === 'Anulado'
  const isIncome = Boolean(detalle?.es_ingreso)
  const available = detalle ? availableToRefund(detalle) : 0

  const revert = async ({ motivo, autorizado_por: responsable }) => {
    const updated = await revertirPago(detalle.pago, { motivo, responsable })
    setState({ loading: false, error: '', data: updated })
    setAction(null)
    setJustReverted(true)
    onChanged?.()
  }

  const registerAgain = () => {
    onClose()
    openPayment({ socioId: detalle.socio.socio_id, reversal: reversalOf(detalle), onSuccess: onChanged })
  }

  const creditNoteIssued = () => {
    setAction(null)
    load()
    onChanged?.()
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Detalle del comprobante" centered size="lg">
      {state.loading && <p className="text-sm text-on-surface-variant">Cargando comprobante...</p>}
      {state.error && <p className="text-sm text-error" role="alert">{state.error}</p>}
      {detalle && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
            <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">receipt_long</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-on-surface-variant">{isIncome ? 'Recibo de ingreso' : 'Recibo de pago de cuotas'}</p>
              <p className="text-xl font-bold text-on-surface">{detalle.codigo}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${anulado ? 'bg-error-container text-on-error-container border-error/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {anulado ? 'Anulado' : 'Vigente'}
            </span>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div><dt className="text-sm text-on-surface-variant">Fecha de emisión</dt><dd className="font-semibold text-on-surface">{formatDate(detalle.fecha_emision)}</dd></div>
            <div><dt className="text-sm text-on-surface-variant">Monto total</dt><dd className="text-xl font-bold text-primary">{formatAmount(detalle.monto_total)}</dd></div>
          </dl>

          {detalle.socio && (
            <div className="p-3 rounded-lg bg-surface-container-low">
              <p className="text-sm text-on-surface-variant">Socio</p>
              <p className="font-semibold text-on-surface">{detalle.socio.apellido}, {detalle.socio.nombre} · DNI {formatDni(detalle.socio.dni)} · Socio N° {detalle.socio.numero_socio}</p>
            </div>
          )}

          <DesgloseComprobante detalle={detalle} />

          <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
            <h3 className="px-3 py-2 bg-surface-container-low font-semibold text-on-surface">Medios de pago</h3>
            {(pago?.items_pago ?? []).map((item) => (
              <div key={item.id_item_pago} className="flex justify-between px-3 py-2 border-t border-outline-variant/20">
                <span className="text-on-surface-variant">{methodLabel(item.medio_de_pago)}</span>
                <strong>{formatAmount(item.monto)}</strong>
              </div>
            ))}
          </section>

          {pago?.observacion && <p className="text-sm text-on-surface-variant">Observación: {pago.observacion}</p>}

          {detalle.anulacion && (
            <section className="flex flex-col gap-1.5 p-3 rounded-lg border border-error/20 bg-error-container/30">
              <h3 className="font-semibold text-error">Anulado</h3>
              <InfoRow label="Fecha">{detalle.anulacion.fecha ? formatDate(detalle.anulacion.fecha) : '—'}</InfoRow>
              <InfoRow label="Motivo">{detalle.anulacion.motivo || '—'}</InfoRow>
              <InfoRow label="Responsable">{detalle.anulacion.responsable || '—'}</InfoRow>
              {detalle.anulacion.usuario && <InfoRow label="Registrado por">{detalle.anulacion.usuario}</InfoRow>}
            </section>
          )}

          <CreditNotes detalle={detalle} methodLabel={methodLabel} />

          {justReverted && (
            <div className="p-3 rounded-lg border border-primary/30 bg-primary/5" role="status">
              <p className="font-semibold text-on-surface">{isIncome ? 'Ingreso anulado.' : 'Pago revertido: la deuda volvió a como estaba.'}</p>
              <p className="text-sm text-on-surface-variant">
                {isIncome
                  ? 'Si le devolvés el dinero al socio, emití una nota de crédito.'
                  : 'Si el cobro estaba mal hecho, volvé a cobrarlo: el dinero ya recibido puede quedar como pago parcial de la siguiente cuota o devolverse con una nota de crédito. Si el pago era de otro socio, registralo en el socio correcto.'}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-outline-variant/30 flex flex-wrap gap-2">
            <DownloadComprobanteButtom comprobanteId={detalle.comprobante_id} />
            {detalle.revertible && (
              <button type="button" onClick={() => setAction('revert')} className={`${ACTION_BUTTON_CLASS} border-error/40 text-error hover:bg-error-container/40`}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">undo</span>
                {isIncome ? 'Anular ingreso' : 'Revertir pago'}
              </button>
            )}
            {anulado && !isIncome && available > 0 && (
              <button type="button" onClick={registerAgain} className={`${ACTION_BUTTON_CLASS} border-primary/40 text-primary hover:bg-primary/5`}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">payments</span>
                Volver a cobrar
              </button>
            )}
            {anulado && available > 0 && (
              <button type="button" onClick={() => setAction('creditNote')} className={`${ACTION_BUTTON_CLASS} border-outline-variant/60 text-on-surface hover:bg-surface-container-low`}>
                <span className="material-symbols-outlined text-lg" aria-hidden="true">currency_exchange</span>
                Emitir nota de crédito
              </button>
            )}
          </div>
        </div>
      )}

      <AuthorizationModal
        opened={action === 'revert'}
        title={isIncome ? 'Anular ingreso' : 'Revertir pago'}
        description={REVERT_DESCRIPTIONS[isIncome ? 'income' : 'payment']}
        confirmLabel={isIncome ? 'Anular ingreso' : 'Revertir pago'}
        confirmIcon="undo"
        authorizerLabel="Responsable"
        authorizerError="Elegí el responsable."
        errorMessage="No se pudo revertir el pago."
        onConfirm={revert}
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
