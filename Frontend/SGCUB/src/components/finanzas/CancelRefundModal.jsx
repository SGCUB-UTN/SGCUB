import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { cancelarDevolucion } from '../../api/devoluciones'
import { formatAmount, getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo } from '../socios/SocioFormFields'
import { AuthorizerSelect } from './formParts'

const MODAL_Z_INDEX = 300
const REASON_MAX_LENGTH = 180
const CREDIT_NOTE = 'NotaCredito'

const DANGER_BUTTON_CLASS = 'px-6 py-2.5 rounded text-sm font-semibold bg-error hover:bg-error/90 text-on-error shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'

function CancelRefundForm({ devolucion, onCancelled, onClose }) {
  const [responsable, setResponsable] = useState('')
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const isCreditNote = devolucion.tipo === CREDIT_NOTE

  const errors = {
    responsable: !responsable ? 'Elegí el responsable.' : '',
    reason: !reason.trim() ? 'Indicá el motivo.' : '',
  }

  const submit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setShowErrors(true)
    if (Object.values(errors).some(Boolean)) return
    setSaving(true)
    setSubmitError('')
    try {
      const updated = await cancelarDevolucion(devolucion.devolucion_id, { motivo: reason.trim(), responsable })
      onCancelled(updated)
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo cancelar la devolución.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <p className="text-base text-on-surface-variant">
        La devolución <strong className="text-on-surface">{devolucion.codigo}</strong> por{' '}
        <strong className="text-on-surface">{formatAmount(devolucion.monto)}</strong> queda cancelada y deja de contarse como dinero devuelto.
        {isCreditNote && ' Ese monto vuelve a quedar disponible para devolver desde el comprobante anulado.'}
      </p>

      <Campo id="cancel-refund-responsable" label="Responsable" requerido error={showErrors ? errors.responsable : ''}>
        <AuthorizerSelect id="cancel-refund-responsable" value={responsable} onChange={setResponsable} invalid={showErrors && Boolean(errors.responsable)} />
      </Campo>

      <Campo
        id="cancel-refund-reason"
        label="Motivo"
        requerido
        extra={<span className="text-sm text-outline font-normal">{reason.length}/{REASON_MAX_LENGTH}</span>}
        error={showErrors ? errors.reason : ''}
      >
        <textarea
          id="cancel-refund-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={REASON_MAX_LENGTH}
          rows={3}
          placeholder="Ej: Se registró con un monto equivocado"
          aria-invalid={(showErrors && Boolean(errors.reason)) || undefined}
          className={claseInput(showErrors && Boolean(errors.reason), 'h-auto py-2.5 resize-none')}
        />
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
          onClick={onClose}
          disabled={saving}
          className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer"
        >
          Volver
        </button>
        <button type="submit" disabled={saving} className={DANGER_BUTTON_CLASS}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">{saving ? 'progress_activity' : 'close'}</span>
          <span>{saving ? 'Guardando...' : 'Cancelar devolución'}</span>
        </button>
      </div>
    </form>
  )
}

export function CancelRefundButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 h-10 px-4 border border-error/40 rounded-lg text-base font-semibold text-error hover:bg-error-container/40 transition-colors cursor-pointer sm:mr-auto"
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
      Cancelar devolución
    </button>
  )
}

export default function CancelRefundModal({ opened, devolucion, onClose, onCancelled }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">Cancelar devolución</Text>}
      centered
      size="lg"
      zIndex={MODAL_Z_INDEX}
    >
      {opened && devolucion && <CancelRefundForm devolucion={devolucion} onCancelled={onCancelled} onClose={onClose} />}
    </Modal>
  )
}
