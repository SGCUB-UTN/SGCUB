import { useState } from 'react'
import { collectErrorMessages, getErrorMessage } from '../personas/format'

const BUTTON_BASE = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'

export const BUTTON_CLASSES = {
  primary: `${BUTTON_BASE} bg-primary text-on-primary shadow-sm hover:bg-primary/90`,
  secondary: `${BUTTON_BASE} border border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low`,
  danger: `${BUTTON_BASE} border border-red-200 bg-white text-red-700 hover:bg-red-50`,
}

// Field errors from a DRF response, as { field: 'message' }
export const fieldErrors = (requestError) => {
  const data = requestError.response?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  return Object.fromEntries(
    Object.entries(data).map(([field, messages]) => [field, collectErrorMessages(messages).join(' ')]),
  )
}

const sameValue = (a, b) => String(a ?? '') === String(b ?? '') || (a !== '' && b !== '' && !Number.isNaN(Number(a)) && Number(a) === Number(b))

export const changedFields = (form, saved, fields) => fields.filter((field) => !sameValue(form[field], saved?.[field]))

/**
 * Form state for a settings card that saves `fields` of `saved` with `onSave(changes)`.
 * The form restarts from `saved` whenever it changes (after saving or reloading).
 */
export function useSettingsForm(saved, fields, onSave, successMessage = 'Los cambios se guardaron.') {
  const [form, setForm] = useState(saved)
  const [syncedSaved, setSyncedSaved] = useState(saved)
  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState({ saving: false, message: '', error: '' })

  if (saved !== syncedSaved) {
    setSyncedSaved(saved)
    setForm(saved)
  }

  const changes = saved ? changedFields(form, saved, fields) : []

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setStatus((current) => ({ ...current, message: '' }))
  }

  const save = async () => {
    setStatus({ saving: true, message: '', error: '' })
    setErrors({})
    try {
      await onSave(Object.fromEntries(changes.map((field) => [field, form[field]])))
      setStatus({ saving: false, message: successMessage, error: '' })
    } catch (requestError) {
      const received = fieldErrors(requestError)
      setErrors(received)
      const general = Object.keys(received).some((field) => fields.includes(field))
        ? ''
        : getErrorMessage(requestError, 'No se pudieron guardar los cambios.')
      setStatus({ saving: false, message: '', error: general })
    }
  }

  const reset = () => {
    setForm(saved)
    setErrors({})
  }

  return { form, setField, changes, errors, status, save, reset }
}
