import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo } from '../socios/SocioFormFields'
import { AuthorizerSelect } from './formParts'

const REASON_MAX_LENGTH = 180

const MODAL_Z_INDEX = 300

const DANGER_BUTTON_CLASS = 'px-6 py-2.5 rounded text-sm font-semibold bg-error hover:bg-error/90 text-on-error shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'

function AuthorizationForm({ description, confirmLabel, confirmIcon, errorMessage, authorizerLabel, authorizerError, withReason, onConfirm, onCancel }) {
  const [authorizer, setAuthorizer] = useState('')
  const [reason, setReason] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const errors = {
    authorizer: !authorizer ? authorizerError : '',
    reason: withReason && !reason.trim() ? 'Indicá el motivo.' : '',
  }

  const submit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setShowErrors(true)
    if (errors.authorizer || errors.reason) return
    setSaving(true)
    setSubmitError('')
    try {
      await onConfirm({ motivo: reason.trim(), autorizado_por: authorizer })
    } catch (error) {
      setSubmitError(getErrorMessage(error, errorMessage))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="text-base text-on-surface-variant">{description}</div>

      <Campo id="authorization-authorizer" label={authorizerLabel} requerido error={showErrors ? errors.authorizer : ''}>
        <AuthorizerSelect id="authorization-authorizer" value={authorizer} onChange={setAuthorizer} invalid={showErrors && Boolean(errors.authorizer)} />
      </Campo>

      {withReason && (
        <Campo
          id="authorization-reason"
          label="Motivo"
          requerido
          extra={<span className="text-sm text-outline font-normal">{reason.length}/{REASON_MAX_LENGTH}</span>}
          error={showErrors ? errors.reason : ''}
        >
          <textarea
            id="authorization-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={REASON_MAX_LENGTH}
            rows={3}
            aria-invalid={(showErrors && Boolean(errors.reason)) || undefined}
            className={claseInput(showErrors && Boolean(errors.reason), 'h-auto py-2.5 resize-none')}
          />
        </Campo>
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
          className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer"
        >
          Volver
        </button>
        <button type="submit" disabled={saving} className={DANGER_BUTTON_CLASS}>
          {(saving || confirmIcon) && (
            <span className="material-symbols-outlined text-base" aria-hidden="true">{saving ? 'progress_activity' : confirmIcon}</span>
          )}
          <span>{saving ? 'Guardando...' : confirmLabel}</span>
        </button>
      </div>
    </form>
  )
}

// Confirms a sensitive operation asking who authorizes it (or who is responsible for it) and, unless
// `withReason` is false, why. `onConfirm` receives { motivo, autorizado_por }.
function AuthorizationModal({
  opened,
  title,
  description,
  confirmLabel,
  confirmIcon = 'block',
  errorMessage = 'No se pudo completar la operación.',
  authorizerLabel = 'Autorizado por',
  authorizerError = 'Elegí quién autoriza.',
  withReason = true,
  onConfirm,
  onClose,
}) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">{title}</Text>}
      centered
      zIndex={MODAL_Z_INDEX}
    >
      {opened && (
        <AuthorizationForm
          description={description}
          confirmLabel={confirmLabel}
          confirmIcon={confirmIcon}
          errorMessage={errorMessage}
          authorizerLabel={authorizerLabel}
          authorizerError={authorizerError}
          withReason={withReason}
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      )}
    </Modal>
  )
}

export default AuthorizationModal
