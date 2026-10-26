import { collectErrorMessages } from '../personas/format'

const BUTTON_BASE = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'

export const BUTTON_CLASSES = {
  primary: `${BUTTON_BASE} bg-primary text-on-primary shadow-sm hover:bg-primary/90`,
  secondary: `${BUTTON_BASE} border border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low`,
  danger: `${BUTTON_BASE} bg-red-700 text-white shadow-sm hover:bg-red-800`,
}

// DRF validation errors as { field: 'message' }
export const messagesByField = (data) => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {}
  return Object.fromEntries(
    Object.entries(data).map(([field, messages]) => [field, collectErrorMessages(messages).join(' ')]),
  )
}

export const fieldErrors = (requestError) => messagesByField(requestError.response?.data)

const sameValue = (a, b) => {
  const [left, right] = [String(a ?? ''), String(b ?? '')]
  return left === right || (left !== '' && right !== '' && !Number.isNaN(Number(left)) && Number(left) === Number(right))
}

export const changedFields = (form, saved, fields) => fields.filter((field) => !sameValue(form[field], saved?.[field]))
