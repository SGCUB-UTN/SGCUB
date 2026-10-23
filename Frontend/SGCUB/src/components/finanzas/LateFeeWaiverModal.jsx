import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { formatAmount } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { claseInput } from '../socios/socioForm'
import { Campo } from '../socios/SocioFormFields'
import { AuthorizerSelect, SUBMIT_BUTTON_CLASS } from './formParts'

const REASON_MAX_LENGTH = 180

const MODAL_Z_INDEX = 300

function WaiverForm({ cuota, amount, initial, onConfirm, onCancel }) {
  const [authorizer, setAuthorizer] = useState(initial?.autorizadoPor ?? '')
  const [reason, setReason] = useState(initial?.motivo ?? '')
  const [showErrors, setShowErrors] = useState(false)

  const errors = {
    authorizer: !authorizer ? 'Elegí quién autoriza la condonación.' : '',
    reason: !reason.trim() ? 'Indicá el motivo de la condonación.' : '',
  }

  const submit = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setShowErrors(true)
    if (errors.authorizer || errors.reason) return
    onConfirm({ autorizadoPor: authorizer, motivo: reason.trim() })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <p className="text-base text-on-surface-variant">
        {cuota ? (
          <>
            Se cancela el recargo por mora de la cuota <strong className="text-on-surface">{formatPeriod(cuota.periodo)}</strong> por{' '}
            <strong className="text-on-surface">{formatAmount(amount)}</strong>.{' '}
          </>
        ) : null}
        La misma autorización se usa para todos los recargos que se eximan en este pago.
      </p>

      <Campo id="waiver-authorizer" label="Autorizado por" requerido error={showErrors ? errors.authorizer : ''}>
        <AuthorizerSelect id="waiver-authorizer" value={authorizer} onChange={setAuthorizer} invalid={showErrors && Boolean(errors.authorizer)} />
      </Campo>

      <Campo
        id="waiver-reason"
        label="Motivo"
        requerido
        extra={<span className="text-sm text-outline font-normal">{reason.length}/{REASON_MAX_LENGTH}</span>}
        error={showErrors ? errors.reason : ''}
      >
        <textarea
          id="waiver-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REASON_MAX_LENGTH}
          rows={3}
          placeholder="Ej: Demora por inconvenientes con la transferencia"
          aria-invalid={(showErrors && Boolean(errors.reason)) || undefined}
          className={claseInput(showErrors && Boolean(errors.reason), 'h-auto py-2.5 resize-none')}
        />
      </Campo>

      <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer"
        >
          Cancelar
        </button>
        <button type="submit" className={SUBMIT_BUTTON_CLASS}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">money_off</span>
          <span>Confirmar condonación</span>
        </button>
      </div>
    </form>
  )
}

function LateFeeWaiverModal({ opened, cuota = null, amount = 0, initial = null, onConfirm, onClose }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">Eximir recargo por mora</Text>}
      centered
      zIndex={MODAL_Z_INDEX}
    >
      {opened && <WaiverForm cuota={cuota} amount={amount} initial={initial} onConfirm={onConfirm} onCancel={onClose} />}
    </Modal>
  )
}

export default LateFeeWaiverModal
