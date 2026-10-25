import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { useAuth } from '../../auth/useAuth'
import { AuthorizerSelect, SUBMIT_BUTTON_CLASS } from '../finanzas/formParts'
import { getErrorMessage } from '../personas/format'
import { Campo } from '../socios/SocioFormFields'

function RunRecategorizationForm({ onConfirm, onCancel }) {
  const { user } = useAuth()
  const [executedBy, setExecutedBy] = useState(user?.full_name ?? '')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const executedByError = !executedBy ? 'Elegí quién ejecuta la recategorización.' : ''

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (executedByError) return
    setSaving(true)
    setSubmitError('')
    try {
      await onConfirm(executedBy)
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudo iniciar la recategorización.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2 text-base text-on-surface-variant">
        <p>¿Querés ejecutar la recategorización de jugadores?</p>
        <p>
          Se revisarán todos los jugadores activos y con baja parcial, y se les asignará la categoría que corresponde
          según su año de nacimiento.
        </p>
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <span className="material-symbols-outlined text-base" aria-hidden="true">schedule</span>
          <p>El proceso puede tardar unos minutos. Podés seguir usando el sistema mientras se ejecuta.</p>
        </div>
      </div>

      <Campo id="recategorization-executed-by" label="Ejecutado por" requerido error={showErrors ? executedByError : ''}>
        <AuthorizerSelect
          id="recategorization-executed-by"
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
            {saving ? 'progress_activity' : 'bolt'}
          </span>
          <span>{saving ? 'Iniciando...' : 'Ejecutar recategorización'}</span>
        </button>
      </div>
    </form>
  )
}

export default function RunRecategorizationModal({ opened, onConfirm, onClose }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">Ejecutar recategorización</Text>}
      centered
    >
      {opened && <RunRecategorizationForm onConfirm={onConfirm} onCancel={onClose} />}
    </Modal>
  )
}
