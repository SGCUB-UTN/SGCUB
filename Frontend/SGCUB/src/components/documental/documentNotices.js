import { DOCUMENT_STATES, PROFILES, formatDate } from './padronDocumental'

const SUBJECT = 'Documentación pendiente en el club'
const CLUB_NAME = 'Club Universitario de Berisso'

const recipient = (persona) => ({ socio_id: persona.socio_id, dni: persona.dni })

const PENDING_DETAILS = {
  [DOCUMENT_STATES.VENCIDO]: (documento) => `vencido el ${formatDate(documento.fecha_vencimiento)}`,
  [DOCUMENT_STATES.POR_VENCER]: (documento) => `vence el ${formatDate(documento.fecha_vencimiento)}`,
  [DOCUMENT_STATES.FALTANTE]: () => 'sin presentar',
}

export const pendingDocuments = (persona) => persona.documentos.filter((documento) => PENDING_DETAILS[documento.estado])

const pendingList = (persona) => pendingDocuments(persona)
  .map((documento) => `${documento.tipo_documento_nombre} (${PENDING_DETAILS[documento.estado](documento)})`)
  .join(', ')

export const documentNotice = (persona) => {
  const pending = pendingList(persona)
  return {
    recipients: [recipient(persona)],
    subject: SUBJECT,
    body: `Hola ${persona.nombre}, te recordamos que tenés documentación pendiente en el club: ${pending}. Podés presentarla en la secretaría del club.`,
  }
}

export const bulkDocumentNotice = (personas) => ({
  recipients: personas.map(recipient),
  subject: SUBJECT,
  body: 'Hola, te recordamos que tenés documentación vencida o sin presentar, por lo que figurás como inhabilitado/a en el club. Podés consultar el detalle y regularizar tu situación en la secretaría del club.',
})

export const whatsAppDocumentMessage = (persona, contacto = null) => {
  const pending = pendingList(persona)
  if (contacto) {
    return `¡Hola ${contacto.nombre}! Te escribimos del ${CLUB_NAME}. ${persona.nombre} ${persona.apellido} tiene documentación pendiente: ${pending}. Pueden presentarla en la secretaría del club. ¡Muchas gracias!`
  }
  return `¡Hola ${persona.nombre}! Te escribimos del ${CLUB_NAME}. Tenés documentación pendiente: ${pending}. Podés presentarla en la secretaría del club. ¡Muchas gracias!`
}

export const isNotifiable = (row) => row.perfil === PROFILES.JUGADOR && row.pendientes.length > 0

export const notifiablePersonas = (rows) => rows.filter(isNotifiable)

export const selectionNotice = (personas) => (personas.length === 1 ? documentNotice(personas[0]) : {
  recipients: personas.map(recipient),
  subject: SUBJECT,
  body: 'Hola, te recordamos que tenés documentación vencida, próxima a vencer o sin presentar en el club. Podés consultar el detalle y regularizar tu situación en la secretaría del club.',
})
