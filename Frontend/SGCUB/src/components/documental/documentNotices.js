import { DOCUMENT_STATES, PROFILES, formatDate } from './padronDocumental'

const SUBJECT = 'Documentación pendiente en el club'

const PENDING_DETAILS = {
  [DOCUMENT_STATES.VENCIDO]: (documento) => `vencido el ${formatDate(documento.fecha_vencimiento)}`,
  [DOCUMENT_STATES.POR_VENCER]: (documento) => `vence el ${formatDate(documento.fecha_vencimiento)}`,
  [DOCUMENT_STATES.FALTANTE]: () => 'sin presentar',
}

export const pendingDocuments = (persona) => persona.documentos.filter((documento) => PENDING_DETAILS[documento.estado])

export const documentNotice = (persona) => {
  const pending = pendingDocuments(persona)
    .map((documento) => `${documento.tipo_documento_nombre} (${PENDING_DETAILS[documento.estado](documento)})`)
    .join(', ')
  return {
    socioId: persona.socio_id,
    subject: SUBJECT,
    body: `Hola ${persona.nombre}, te recordamos que tenés documentación pendiente en el club: ${pending}. Podés presentarla en la secretaría del club.`,
  }
}

export const bulkDocumentNotice = (personas) => ({
  socioIds: personas.map((persona) => persona.socio_id),
  subject: SUBJECT,
  body: 'Hola, te recordamos que tenés documentación vencida o sin presentar, por lo que figurás como inhabilitado/a en el club. Podés consultar el detalle y regularizar tu situación en la secretaría del club.',
})

export const notifiablePersonas = (rows, personas) => {
  const claves = new Set(rows
    .filter((row) => row.perfil === PROFILES.JUGADOR && row.estado !== DOCUMENT_STATES.VIGENTE)
    .map((row) => row.clave))
  return personas.filter((persona) => claves.has(persona.clave))
}

export const selectionNotice = (personas) => (personas.length === 1 ? documentNotice(personas[0]) : {
  socioIds: personas.map((persona) => persona.socio_id),
  subject: SUBJECT,
  body: 'Hola, te recordamos que tenés documentación vencida, próxima a vencer o sin presentar en el club. Podés consultar el detalle y regularizar tu situación en la secretaría del club.',
})
