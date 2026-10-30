import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { emitirNotaCredito } from '../../api/comprobantes'
import useMediosPago from '../../hooks/useMediosPago'
import { formatAmount, getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import { AmountInput, AuthorizerSelect, SUBMIT_BUTTON_CLASS } from './formParts'
import { availableToRefund } from './refunds'

const MODAL_Z_INDEX = 300
const REASON_MAX_LENGTH = 200

const roundCents = (value) => Math.round(value * 100) / 100

function NotaCreditoForm({ comprobante, onIssued, onCancel }) {
  const available = availableToRefund(comprobante)
  const { paymentMethods } = useMediosPago()
  const [amount, setAmount] = useState(available.toFixed(2))
  const [method, setMethod] = useState('')
  const [reason, setReason] = useState('')
  const [responsable, setResponsable] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const enteredAmount = roundCents(Number(amount || 0))
  const errors = {
    amount: !(enteredAmount > 0) || enteredAmount > available ? `Ingresá un monto entre $ 0,01 y ${formatAmount(available)}.` : '',
    method: !method ? 'Elegí cómo se devuelve el dinero.' : '',
    reason: !reason.trim() ? 'Indicá el motivo de la devolución.' : '',
    responsable: !responsable ? 'Elegí el responsable de la devolución.' : '',
  }

  const submit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setShowErrors(true)
    if (Object.values(errors).some(Boolean)) return
    setSaving(true)
    setSubmitError('')
    try {
      onIssued(await emitirNotaCredito(comprobante.comprobante_id, {
        monto: enteredAmount,
        medio_de_pago: method,
        motivo: reason.trim(),
        responsable,
      }))
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo emitir la nota de crédito.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <p className="text-base text-on-surface-variant">
        Devuelve al socio dinero del comprobante anulado <strong className="text-on-surface">{comprobante.codigo}</strong>.
        Queda disponible para devolver <strong className="text-on-surface">{formatAmount(available)}</strong>.
        La nota de crédito no modifica la deuda ni los ingresos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo id="nota-credito-monto" label="Monto a devolver" requerido error={showErrors ? errors.amount : ''}>
          <AmountInput
            id="nota-credito-monto"
            value={amount}
            onChange={setAmount}
            invalid={showErrors && Boolean(errors.amount)}
          />
        </Campo>
        <Campo id="nota-credito-medio" label="Medio de devolución" requerido error={showErrors ? errors.method : ''}>
          <SelectConFlecha id="nota-credito-medio" value={method} onChange={(event) => setMethod(event.target.value)} conError={showErrors && Boolean(errors.method)}>
            <option value="">Seleccioná un medio</option>
            {paymentMethods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectConFlecha>
        </Campo>
      </div>

      <Campo
        id="nota-credito-motivo"
        label="Motivo"
        requerido
        extra={<span className="text-sm text-outline font-normal">{reason.length}/{REASON_MAX_LENGTH}</span>}
        error={showErrors ? errors.reason : ''}
      >
        <input
          id="nota-credito-motivo"
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REASON_MAX_LENGTH}
          placeholder="Ej: Excedente por descuento omitido"
          aria-invalid={(showErrors && Boolean(errors.reason)) || undefined}
          className={claseInput(showErrors && Boolean(errors.reason))}
        />
      </Campo>

      <Campo id="nota-credito-responsable" label="Responsable de la devolución" requerido error={showErrors ? errors.responsable : ''}>
        <AuthorizerSelect id="nota-credito-responsable" value={responsable} onChange={setResponsable} invalid={showErrors && Boolean(errors.responsable)} />
      </Campo>

      {submitError && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
          <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
          <p className="text-sm break-words">{submitError}</p>
        </div>
      )}

      <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer"
        >
          Volver
        </button>
        <button type="submit" disabled={saving} className={SUBMIT_BUTTON_CLASS}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">{saving ? 'progress_activity' : 'undo'}</span>
          <span>{saving ? 'Emitiendo...' : `Emitir nota de crédito • ${formatAmount(enteredAmount)}`}</span>
        </button>
      </div>
    </form>
  )
}

// Issues a credit note over an annulled receipt, asking for the responsable before confirming
function NotaCreditoModal({ opened, comprobante, onClose, onIssued }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">Emitir nota de crédito</Text>}
      centered
      size="lg"
      zIndex={MODAL_Z_INDEX}
    >
      {opened && comprobante && <NotaCreditoForm comprobante={comprobante} onIssued={onIssued} onCancel={onClose} />}
    </Modal>
  )
}

export default NotaCreditoModal
