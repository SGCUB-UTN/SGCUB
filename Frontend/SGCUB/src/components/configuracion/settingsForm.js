import { collectErrorMessages } from '../personas/format'

const BUTTON_BASE = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60'

export const BUTTON_CLASSES = {
  primary: `${BUTTON_BASE} bg-primary text-on-primary shadow-sm hover:bg-primary/90`,
  secondary: `${BUTTON_BASE} border border-outline-variant/60 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low`,
  danger: `${BUTTON_BASE} bg-red-700 text-white shadow-sm hover:bg-red-800`,
}

// Small buttons and links used inside the setting sections
export const SMALL_BUTTON_CLASSES = {
  secondary: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-outline-variant bg-white px-3 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
  primary: 'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-on-primary transition-colors hover:bg-primary/90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60',
  link: 'inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 cursor-pointer',
}

const COMPACT_INPUT_BASE = 'w-full rounded-lg border bg-white px-3 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:bg-surface-container-low disabled:text-on-surface-variant'

// small: lower controls for dense rows
export const compactInputClass = (invalid = false, extra = '', small = false) => (
  `${COMPACT_INPUT_BASE} ${small ? 'h-8' : 'h-9'} ${invalid ? 'border-error' : 'border-outline-variant focus:border-primary'} ${extra}`
)

// Tables that span the whole tab, right below the section header (see SettingsSection flush)
export const TABLE_CLASSES = {
  wrapper: 'overflow-x-auto',
  table: 'w-full text-left text-sm',
  head: 'bg-white text-xs uppercase tracking-wider text-on-surface-variant',
  headCell: 'px-6 py-2 font-semibold',
  row: 'border-t border-outline-variant/30 align-middle',
  cell: 'px-6 py-2',
  actionsCell: 'px-4 py-1',
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
