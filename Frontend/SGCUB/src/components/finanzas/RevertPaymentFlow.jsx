import { useEffect, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { emitirNotaCredito, getComprobante } from '../../api/comprobantes'
import { revertirPago } from '../../api/pagos'
import useMediosPago from '../../hooks/useMediosPago'
import { formatAmount, formatDni, getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import DownloadComprobanteButton from './DownloadComprobanteButton'
import { AuthorizerSelect, OptionCard, SUBMIT_BUTTON_CLASS } from './formParts'
import RegisterPaymentModal from './RegisterPaymentModal'
import { availableToRefund, reversalOf } from './refunds'
import { FULL_CREDIT_NOTE, NEVER_RECEIVED, OTHER_SOCIO, REVERSAL_OUTCOMES, opensPayment } from './reversalOutcomes'

const REASON_MAX_LENGTH = 180

// Revert asks who and why and reverts; settle (once reverted) only lets choose again what to do with the money
const REVERT = 'revert'
const SETTLE = 'settle'
const PAYMENT = 'payment'
const DONE = 'done'

const DANGER_BUTTON_CLASS = 'px-6 py-2.5 rounded text-sm font-semibold bg-error hover:bg-error/90 text-on-error shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'
const SECONDARY_BUTTON_CLASS = 'px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer'

function ReceiptSummary({ detalle }) {
  const socio = detalle.socio
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
      <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">receipt_long</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-on-surface">{detalle.codigo} · {formatAmount(detalle.monto_total)}</p>
        {socio && (
          <p className="text-sm text-on-surface-variant truncate">
            {socio.apellido}, {socio.nombre} · DNI {formatDni(socio.dni)}
          </p>
        )}
      </div>
    </div>
  )
}

export function ReversalForm({ summary, available, reverted, onSubmit, onCancel }) {
  const { paymentMethods } = useMediosPago()
  const [responsable, setResponsable] = useState('')
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState(available > 0 ? '' : NEVER_RECEIVED)
  const [refundMethod, setRefundMethod] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const errors = {
    responsable: !reverted && !responsable ? 'Elegí el responsable.' : '',
    reason: !reverted && !reason.trim() ? 'Indicá el motivo.' : '',
    outcome: !outcome ? 'Elegí qué hacer con el dinero del pago.' : '',
    refundMethod: outcome === FULL_CREDIT_NOTE && !refundMethod ? 'Elegí cómo se devuelve el dinero.' : '',
  }

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (Object.values(errors).some(Boolean)) return
    setSaving(true)
    setSubmitError('')
    try {
      await onSubmit({ responsable, motivo: reason.trim(), outcome, refundMethod })
    } catch (error) {
      setSubmitError(getErrorMessage(error, reverted ? 'No se pudo completar la operación.' : 'No se pudo revertir el pago.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {summary}

      {reverted ? (
        <p className="p-3 rounded-lg border border-primary/30 bg-primary/5 text-base text-on-surface" role="status">
          El pago ya está revertido: el comprobante quedó anulado y la deuda de las cuotas volvió a como estaba.
          Elegí qué hacer con el dinero recibido (<strong>{formatAmount(available)}</strong>) para terminar.
        </p>
      ) : (
        <>
          <Campo id="reversal-responsable" label="Responsable" requerido error={showErrors ? errors.responsable : ''}>
            <AuthorizerSelect id="reversal-responsable" value={responsable} onChange={setResponsable} invalid={showErrors && Boolean(errors.responsable)} />
          </Campo>

          <Campo
            id="reversal-reason"
            label="Motivo"
            requerido
            extra={<span className="text-sm text-outline font-normal">{reason.length}/{REASON_MAX_LENGTH}</span>}
            error={showErrors ? errors.reason : ''}
          >
            <textarea
              id="reversal-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={REASON_MAX_LENGTH}
              rows={2}
              aria-invalid={(showErrors && Boolean(errors.reason)) || undefined}
              className={claseInput(showErrors && Boolean(errors.reason), 'h-auto py-2.5 resize-none')}
            />
          </Campo>
        </>
      )}

      <div className="flex flex-col gap-2">
        <p id="reversal-outcome-label" className="text-base font-semibold text-on-surface">
          ¿Qué se hace con el dinero? <span className="text-error font-bold">*</span>
        </p>
        <div role="radiogroup" aria-labelledby="reversal-outcome-label" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REVERSAL_OUTCOMES.map((option) => (
            <OptionCard
              key={option.value}
              icon={option.icon}
              title={option.title}
              description={option.value === FULL_CREDIT_NOTE ? `${option.description} (${formatAmount(available)})` : option.description}
              selected={outcome === option.value}
              disabled={available <= 0 && option.value !== NEVER_RECEIVED}
              onSelect={() => setOutcome(option.value)}
            />
          ))}
        </div>
        {showErrors && errors.outcome && <p className="text-sm text-error font-medium" role="alert">{errors.outcome}</p>}
      </div>

      {outcome === FULL_CREDIT_NOTE && (
        <Campo id="reversal-refund-method" label="Medio de devolución" requerido error={showErrors ? errors.refundMethod : ''}>
          <SelectConFlecha
            id="reversal-refund-method"
            value={refundMethod}
            onChange={(event) => setRefundMethod(event.target.value)}
            conError={showErrors && Boolean(errors.refundMethod)}
          >
            <option value="">Seleccioná un medio</option>
            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </SelectConFlecha>
        </Campo>
      )}

      {submitError && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
          <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
          <p className="text-sm break-words">{submitError}</p>
        </div>
      )}

      <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
        {!reverted && (
          <button type="button" onClick={onCancel} disabled={saving} className={SECONDARY_BUTTON_CLASS}>Cancelar</button>
        )}
        <button type="submit" disabled={saving} className={reverted ? SUBMIT_BUTTON_CLASS : DANGER_BUTTON_CLASS}>
          <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`} aria-hidden="true">
            {saving ? 'progress_activity' : reverted ? 'arrow_forward' : 'undo'}
          </span>
          <span>{saving ? 'Guardando...' : reverted ? 'Continuar' : 'Revertir pago'}</span>
        </button>
      </div>
    </form>
  )
}

function ReversalDone({ detalle, creditNote, onClose }) {
  return (
    <div className="flex flex-col gap-5">
      <ReceiptSummary detalle={detalle} />
      <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50" role="status">
        <span className="material-symbols-outlined text-emerald-700" aria-hidden="true">check_circle</span>
        <div>
          <p className="font-semibold text-on-surface">Pago revertido</p>
          <p className="text-base text-on-surface-variant">
            {creditNote
              ? `Se emitió la nota de crédito ${creditNote.codigo} por ${formatAmount(creditNote.monto)}.`
              : 'El ingreso quedó anulado sin devolución y la deuda de las cuotas volvió a como estaba.'}
          </p>
        </div>
      </div>
      <div className="pt-4 border-t border-outline-variant/20 flex flex-wrap items-center justify-end gap-3">
        <DownloadComprobanteButton comprobanteId={detalle.comprobante_id} label="Recibo anulado" />
        {creditNote && <DownloadComprobanteButton devolucionId={creditNote.devolucion_id} label="Nota de crédito" />}
        <button type="button" onClick={onClose} className={SUBMIT_BUTTON_CLASS}>Cerrar</button>
      </div>
    </div>
  )
}

// Reverts the latest payment of cuotas and doesn't let go until it's decided what happens with the money:
// once reverted the modal can't be closed, only another option chosen, until the money is settled.
function RevertPaymentFlow({ comprobanteId, opened, onClose, onChanged }) {
  const [load, setLoad] = useState({ loading: true, error: '', detalle: null })
  const [stage, setStage] = useState(REVERT)
  const [authorization, setAuthorization] = useState(null)
  const [outcome, setOutcome] = useState(null)
  const [creditNote, setCreditNote] = useState(null)

  useEffect(() => {
    let active = true
    getComprobante(comprobanteId)
      .then((detalle) => active && setLoad({ loading: false, error: '', detalle }))
      .catch(() => active && setLoad({ loading: false, error: 'No se pudo cargar el comprobante.', detalle: null }))
    return () => { active = false }
  }, [comprobanteId])

  const detalle = load.detalle

  const settle = (chosen) => {
    setOutcome(chosen)
    setStage(opensPayment(chosen) ? PAYMENT : DONE)
  }

  const revert = async ({ responsable, motivo, outcome: chosen, refundMethod }) => {
    const updated = await revertirPago(detalle.pago, {
      motivo,
      responsable,
      desenlace: chosen,
      ...(chosen === FULL_CREDIT_NOTE && { medio_de_pago: refundMethod }),
    })
    setLoad({ loading: false, error: '', detalle: updated })
    setAuthorization({ responsable, motivo })
    if (chosen === FULL_CREDIT_NOTE) setCreditNote(updated.notas_credito?.at(-1) ?? null)
    onChanged?.()
    settle(chosen)
  }

  // Already reverted: the responsable and reason of the reversal also sign the credit note
  const resettle = async ({ outcome: chosen, refundMethod }) => {
    if (chosen === FULL_CREDIT_NOTE) {
      const note = await emitirNotaCredito(detalle.comprobante_id, {
        monto: availableToRefund(detalle),
        medio_de_pago: refundMethod,
        motivo: authorization.motivo,
        responsable: authorization.responsable,
      })
      setCreditNote(note)
      onChanged?.()
    }
    settle(chosen)
  }

  if (stage === PAYMENT) {
    const otherSocio = outcome === OTHER_SOCIO
    return (
      <RegisterPaymentModal
        opened={opened}
        initialSocioId={otherSocio ? null : detalle.socio.socio_id}
        excludedSocioId={otherSocio ? detalle.socio.socio_id : null}
        reversal={{ ...reversalOf(detalle), otherSocio }}
        onChangeOption={() => setStage(SETTLE)}
        onClose={onClose}
        onSuccess={onChanged}
      />
    )
  }

  const locked = stage === SETTLE
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">{locked ? 'Resolver el pago revertido' : 'Revertir pago'}</Text>}
      withCloseButton={!locked}
      closeOnEscape={!locked}
      closeOnClickOutside={!locked}
      centered
      size="lg"
    >
      {load.loading && <p className="text-sm text-on-surface-variant">Cargando comprobante...</p>}
      {load.error && <p className="text-sm text-error" role="alert">{load.error}</p>}
      {detalle && stage === DONE && <ReversalDone detalle={detalle} creditNote={creditNote} onClose={onClose} />}
      {detalle && stage !== DONE && (
        <ReversalForm
          key={stage}
          summary={<ReceiptSummary detalle={detalle} />}
          available={availableToRefund(detalle)}
          reverted={locked}
          onSubmit={locked ? resettle : revert}
          onCancel={onClose}
        />
      )}
    </Modal>
  )
}

export default RevertPaymentFlow
