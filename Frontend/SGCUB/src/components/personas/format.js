import { AsYouType, isValidPhoneNumber, parsePhoneNumberFromString, validatePhoneNumberLength } from 'libphonenumber-js'

const PHONE_MAX_LENGTH = 20

export const phoneDigits = (value) => {
  const text = String(value ?? '').trim()
  return `${text.startsWith('+') ? '+' : ''}${text.replace(/\D/g, '')}`.slice(0, PHONE_MAX_LENGTH)
}

export const isPhoneTooLong = (value) => validatePhoneNumberLength(phoneDigits(value), 'AR') === 'TOO_LONG'

export const phoneError = (value) => {
  const digits = phoneDigits(value)
  if (!digits || isValidPhoneNumber(digits, 'AR')) return null
  return validatePhoneNumberLength(digits, 'AR') === 'TOO_SHORT'
    ? 'Faltan dígitos: ingresá el código de área y el número (ej: 221 459-2810).'
    : 'Ingresá un teléfono válido con código de área (ej: 221 459-2810).'
}

export const formatPhoneInput = (value) => {
  const digits = phoneDigits(value)
  return digits ? new AsYouType('AR').input(digits) : ''
}

export const formatDate = (date) => {
  if (!date) return '—'
  const dateOnly = String(date).split('T')[0]
  const parts = dateOnly.split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date
}

export const formatDni = (dni) => {
  if (!dni) return '—'
  const numero = Number(dni)
  return Number.isNaN(numero) ? dni : numero.toLocaleString('es-AR')
}

export const formatPhone = (phone) => {
  if (!phone) return '—'
  const parsed = parsePhoneNumberFromString(String(phone), 'AR')
  if (!parsed?.isValid()) return phone
  if (parsed.country !== 'AR') return parsed.formatInternational()
  const [, area, local] = parsed.formatNational().match(/^0(\d+)\s(.+)$/) ?? []
  return area ? `(${area}) ${local}` : parsed.formatNational()
}

export const formatNumber =(number) => (number ? `#${String(number).padStart(4, '0')}` : '—')

export const formatAmount = (amount) =>
  Number(amount || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })

export const yearsSince = (date) => {
  if (!date) return null
  const start = new Date(`${date}T00:00:00`)
  const today = new Date()
  let years = today.getFullYear() - start.getFullYear()
  const monthDifference = today.getMonth() - start.getMonth()
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < start.getDate())) years -= 1
  return years
}

export const yearsText = (years) => {
  if (years === null || years === undefined) return '—'
  if (years < 1) return 'Menos de 1 año'
  return years === 1 ? '1 año' : `${years} años`
}

export const isActiveStatus = (name) => {
  const value = name?.toLowerCase() ?? ''
  return value.includes('activo') && !value.includes('inactivo')
}

const FIELD_LABELS = { dni: 'DNI' }

const fieldLabel = (field) => {
  if (FIELD_LABELS[field]) return FIELD_LABELS[field]
  const label = field.replaceAll('_', ' ').trim()
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const ERROR_METADATA_KEYS = ['persona_existente']

export const collectErrorMessages = (data) => {
  if (data === null || data === undefined) return []
  if (typeof data === 'string' || typeof data === 'number') return [String(data)]
  if (Array.isArray(data)) return data.flatMap(collectErrorMessages)
  if (typeof data === 'object') {
    return Object.entries(data)
      .filter(([field]) => !ERROR_METADATA_KEYS.includes(field))
      .flatMap(([, value]) => collectErrorMessages(value))
  }
  return []
}

const fieldErrorMessages = (field, value) => {
  if (ERROR_METADATA_KEYS.includes(field)) return []
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([nestedField, nestedValue]) => fieldErrorMessages(nestedField, nestedValue))
  }
  const messages = collectErrorMessages(value)
  if (!messages.length) return []
  const text = messages.join(', ')
  return field === 'non_field_errors' ? [text] : [`${fieldLabel(field)}: ${text}`]
}

export const getErrorMessage = (requestError, fallback) => {
  const errorData = requestError.response?.data
  if (!errorData) return fallback
  if (typeof errorData === 'string') return errorData
  if (errorData.detail) return errorData.detail
  if (Array.isArray(errorData)) return collectErrorMessages(errorData).join(' | ') || fallback
  return Object.entries(errorData)
    .flatMap(([field, value]) => fieldErrorMessages(field, value))
    .join(' | ') || fallback
}
