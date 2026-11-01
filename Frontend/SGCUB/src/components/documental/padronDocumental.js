import { findGender } from '../cuota/cuotaCategories'

export const DOCUMENT_STATES = {
  VIGENTE: 'vigente',
  POR_VENCER: 'por_vencer',
  VENCIDO: 'vencido',
  FALTANTE: 'faltante',
}

export const PROFILES = {
  JUGADOR: 'jugador',
  DOCENTE: 'docente',
}

export const categoryLabel = (categoria) => {
  const gender = findGender(categoria.genero)
  return gender ? `${categoria.nombre} (${gender.shortLabel})` : categoria.nombre
}

export const personaName = (persona) => `${persona.apellido}, ${persona.nombre}`

export const documentRows = (personas) => personas.flatMap(({ documentos, ...persona }) => {
  const categoriasLabel = persona.categorias.map(categoryLabel).join(', ')
  return documentos.map((documento) => ({
    ...persona,
    ...documento,
    key: `${persona.clave}-${documento.tipo_documento}`,
    categoriasLabel,
  }))
})
