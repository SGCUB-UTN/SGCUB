import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { useAuth } from '../../auth/useAuth'
import { AuthorizerSelect, SUBMIT_BUTTON_CLASS } from '../finanzas/formParts'
import { getErrorMessage } from '../personas/format'
import { Campo } from '../socios/SocioFormFields'

// Confirmation for a manual action: explains what will happen and asks who runs it
function ExecuteActionForm({ id, description, confirmLabel, confirmIcon, savingLabel, errorMessage, onConfirm, onCancel }) {
  const { user } = useAuth()
  const [executedBy, setExecutedBy] = useState(user?.full_name ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const executedByError = !executedBy ? 'Elegí quién lo ejecuta.' : ''

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (executedByError) return
    setSaving(true)
    setSubmitError('')
    try {
      await onConfirm(executedBy)
    } catch (error) {
      setSubmitError(getErrorMessage(error, errorMessage))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2 text-base text-on-surface-variant">{description}</div>

      <Campo id={`${id}-executed-by`} label="Ejecutado por" requerido error={showErrors ? executedByError : ''}>
        <AuthorizerSelect
          id={`${id}-executed-by`}
          value={executedBy}
          onChange={setExecutedBy}
          invalid={showErrors && Boolean(executedByError)}
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
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer"
        >
          Cancelar
        </button>
        <button type="submit" disabled={saving} className={SUBMIT_BUTTON_CLASS}>
          <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`} aria-hidden="true">
            {saving ? 'progress_activity' : confirmIcon}
          </span>
          <span>{saving ? savingLabel : confirmLabel}</span>
        </button>
      </div>
    </form>
  )
}

export default function ExecuteActionModal({ opened, title, onClose, ...formProps }) {
  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700} size="xl">{title}</Text>} centered>
      {opened && <ExecuteActionForm {...formProps} onCancel={onClose} />}
    </Modal>
  )
}
