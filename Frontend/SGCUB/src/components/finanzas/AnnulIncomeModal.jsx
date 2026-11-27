import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { revertirPago } from '../../api/pagos'
import useMediosPago from '../../hooks/useMediosPago'
import ProfileScopeOptions from '../personas/ProfileScopeOptions'
import { formatAmount, getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import { AuthorizerSelect, DANGER_BUTTON_CLASS, SECONDARY_BUTTON_CLASS } from './formParts'
import { availableToRefund } from './refunds'

const MODAL_Z_INDEX = 300
const REASON_MAX_LENGTH = 180
const REFUND = 'devolver'
const KEEP = 'no_devolver'
const FULL_CREDIT_NOTE = 'NotaCreditoTotal'


const moneyOptions = (total) => [
  {
    value: KEEP,
    label: 'No se debe devolver dinero',
    description: 'Solo se anula el ingreso. Si después hay que devolver el dinero, emití una nota de crédito desde el comprobante.',
  },
  {
    value: REFUND,
    label: 'Devolver el dinero',
    description: `Se emite una nota de crédito por el total del ingreso (${formatAmount(total)}).`,
  },
]

function AnnulIncomeForm({ comprobante, onAnnulled, onCancel }) {
  const { paymentMethods } = useMediosPago()
  const total = availableToRefund(comprobante)
  const [responsable, setResponsable] = useState('')
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState(KEEP)
  const [method, setMethod] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const refund = outcome === REFUND

  const errors = {
    responsable: !responsable ? 'Elegí el responsable.' : '',
    reason: !reason.trim() ? 'Indicá el motivo.' : '',
    method: refund && !method ? 'Elegí cómo se devuelve el dinero.' : '',
  }

  const submit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setShowErrors(true)
    if (Object.values(errors).some(Boolean)) return
    setSaving(true)
    setSubmitError('')
    try {
      const updated = await revertirPago(comprobante.pago, {
        motivo: reason.trim(),
        responsable,
        ...(refund && { desenlace: FULL_CREDIT_NOTE, medio_de_pago: method }),
      })
      onAnnulled(updated, { refunded: refund, amount: total })
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo anular el ingreso.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <p className="text-base text-on-surface-variant">
        El comprobante <strong className="text-on-surface">{comprobante.codigo}</strong> pasa a anulado y el ingreso deja de contarse.
      </p>

      <Campo id="annul-income-responsable" label="Responsable" requerido error={showErrors ? errors.responsable : ''}>
        <AuthorizerSelect id="annul-income-responsable" value={responsable} onChange={setResponsable} invalid={showErrors && Boolean(errors.responsable)} />
      </Campo>

      <Campo
        id="annul-income-reason"
        label="Motivo"
        requerido
        extra={<span className="text-sm text-outline font-normal">{reason.length}/{REASON_MAX_LENGTH}</span>}
        error={showErrors ? errors.reason : ''}
      >
        <textarea
          id="annul-income-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REASON_MAX_LENGTH}
          rows={3}
          aria-invalid={(showErrors && Boolean(errors.reason)) || undefined}
          className={claseInput(showErrors && Boolean(errors.reason), 'h-auto py-2.5 resize-none')}
        />
      </Campo>

      <div className="flex flex-col gap-1">
        <p className="text-base font-semibold text-on-surface">¿Qué pasa con el dinero?</p>
        <ProfileScopeOptions
          name="annul-income-outcome"
          label="Qué pasa con el dinero"
          options={moneyOptions(total)}
          value={outcome}
          disabled={saving}
          onChange={setOutcome}
        />
      </div>

      {refund && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="annul-income-method" label="Medio de devolución" requerido error={showErrors ? errors.method : ''}>
            <SelectConFlecha id="annul-income-method" value={method} onChange={(event) => setMethod(event.target.value)} conError={showErrors && Boolean(errors.method)}>
              <option value="">Seleccioná un medio</option>
              {paymentMethods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectConFlecha>
          </Campo>
          <Campo id="annul-income-amount" label="Monto a devolver" hint="(total del ingreso)">
            <input
              id="annul-income-amount"
              type="text"
              value={formatAmount(total)}
              readOnly
              className={claseInput(false, 'bg-surface-container-low font-semibold tabular-nums cursor-default')}
            />
          </Campo>
        </div>
      )}

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
          className={SECONDARY_BUTTON_CLASS}
        >
          Volver
        </button>
        <button type="submit" disabled={saving} className={DANGER_BUTTON_CLASS}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">{saving ? 'progress_activity' : 'undo'}</span>
          <span>{saving ? 'Guardando...' : refund ? `Anular y devolver ${formatAmount(total)}` : 'Anular ingreso'}</span>
        </button>
      </div>
    </form>
  )
}

export default function AnnulIncomeModal({ opened, comprobante, onClose, onAnnulled }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">Anular ingreso</Text>}
      centered
      size="lg"
      zIndex={MODAL_Z_INDEX}
    >
      {opened && comprobante && <AnnulIncomeForm comprobante={comprobante} onAnnulled={onAnnulled} onCancel={onClose} />}
    </Modal>
  )
}
