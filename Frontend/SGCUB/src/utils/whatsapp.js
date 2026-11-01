import { formatAmount } from '../components/personas/format'

/**
 * Limpia el 15 local para números argentinos.
 * En Argentina, los teléfonos tienen códigos de área de 2, 3 o 4 dígitos.
 * Los usuarios suelen escribir 0221 15 555-6677 o 221-15-5556677.
 */
function cleanLocal15(num) {
  if (num.length === 12) {
    if (num.startsWith('1115')) return `11${num.slice(4)}`
    if (num.slice(3, 5) === '15') return `${num.slice(0, 3)}${num.slice(5)}`
    if (num.slice(4, 6) === '15') return `${num.slice(0, 4)}${num.slice(6)}`
  }
  if (num.length === 10 && num.startsWith('15')) {
    return num.slice(2)
  }
  return num
}

/**
 * Normaliza un número telefónico para WhatsApp (wa.me) con el formato internacional estricto.
 * Para Argentina WhatsApp requiere: 54 + 9 + código de área (sin 0) + número local (sin 15).
 * Ejemplo La Plata/Berisso: 5492215556677
 */
export function formatWhatsAppPhone(phone) {
  if (!phone) return null

  let digits = String(phone).replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  if (digits.startsWith('54')) {
    let rest = digits.slice(2)
    if (rest.startsWith('9')) rest = rest.slice(1)
    if (rest.startsWith('0')) rest = rest.slice(1)
    rest = cleanLocal15(rest)
    return `549${rest}`
  }

  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }
  digits = cleanLocal15(digits)

  if (digits.length === 10) {
    return `549${digits}`
  }
  if (digits.length === 7) {
    // Código de área por defecto para Berisso y Gran La Plata: 221
    return `549221${digits}`
  }
  if (digits.length === 8) {
    return `54911${digits}`
  }
  if (digits.length === 11 && digits.startsWith('9')) {
    return `54${digits}`
  }

  return digits
}

/**
 * Genera el texto del mensaje para enviar el comprobante por WhatsApp.
 */
export function buildWhatsAppMessage({ comprobanteCodigo, montoTotal, clubNombre }) {
  const nombreClub = clubNombre || 'Club Universitario de Berisso'
  const codigo = comprobanteCodigo ? ` (${comprobanteCodigo})` : ''
  const monto = montoTotal != null ? ` por un monto de ${formatAmount(montoTotal)}` : ''

  return `¡Hola! Te escribimos de ${nombreClub}. Te adjuntamos el comprobante de tu pago${codigo}${monto}. ¡Muchas gracias!`
}

/**
 * Abre una conversación de WhatsApp Web / App con el número y mensaje precargado.
 */
export function openWhatsAppChat({ phone, message }) {
  const sanitized = formatWhatsAppPhone(phone)
  if (!sanitized) return false
  const encoded = encodeURIComponent(message || '')
  const url = `https://wa.me/${sanitized}?text=${encoded}`
  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}

