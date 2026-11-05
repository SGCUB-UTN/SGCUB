import { api } from './conf'
import { savePdfResponse, saveZipResponse } from './download'

export const getDocumentos = async (personaId) => {
  const { data } = await api.get('documental/documentos/', { params: { persona_id: personaId } })
  return data
}

export const createDocumento = async (documentData) => {
  const isFormData = documentData instanceof FormData
  const { data } = await api.post('documental/documentos/', documentData, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
  })
  return data
}

export const deleteDocumento = async (id) => {
  await api.delete(`documental/documentos/${id}/`)
}

export const getTiposDocumento = async () => {
  const { data } = await api.get('documental/tipos/')
  return data
}

export const createTipoDocumento = async (tipo) => {
  const { data } = await api.post('documental/tipos/', tipo)
  return data
}

export const updateTipoDocumento = async (id, tipo) => {
  const { data } = await api.patch(`documental/tipos/${id}/`, tipo)
  return data
}

// Only types without documents can be deleted; the rest are disabled
export const deleteTipoDocumento = async (id) => {
  await api.delete(`documental/tipos/${id}/`)
}

export const getPlantillaDocumento = async (tipoId) => {
  const { data } = await api.get(`documental/tipos/${tipoId}/plantilla/`)
  return data
}

export const createPlantillaDocumento = async (tipoId) => {
  const { data } = await api.post(`documental/tipos/${tipoId}/plantilla/`)
  return data
}

export const deletePlantillaDocumento = async (tipoId) => {
  await api.delete(`documental/tipos/${tipoId}/plantilla/`)
}

export const updatePlantillaDocumento = async (tipoId, plantilla) => {
  const { data } = await api.patch(`documental/tipos/${tipoId}/plantilla/`, plantilla)
  return data
}

const templatePersonaEndpoint = (tipoId, personaId) => `documental/tipos/${tipoId}/plantilla/personas/${personaId}/`

export const getPlantillaPdfBlob = async (tipoId, personaId, alcance) => {
  const { data } = await api.get(`${templatePersonaEndpoint(tipoId, personaId)}pdf/`, { params: { alcance }, responseType: 'blob' })
  return data
}

export const downloadPlantillaPdf = async (tipoId, personaId, alcance) => {
  const response = await api.get(`${templatePersonaEndpoint(tipoId, personaId)}pdf/`, { params: { alcance }, responseType: 'blob' })
  savePdfResponse(response, 'documento.pdf')
}

export const getPlantillaImagenBlob = async (tipoId, personaId) => {
  const { data } = await api.get(`${templatePersonaEndpoint(tipoId, personaId)}imagen/`, { responseType: 'blob' })
  return data
}

export const getPlantillaDestinatario = async (tipoId, personaId) => {
  const { data } = await api.get(`${templatePersonaEndpoint(tipoId, personaId)}destinatario/`)
  return data
}

export const getEstadosDocumento = async () => {
  const { data } = await api.get('documental/estados/')
  return data
}

export const updateDocumento = async (id, documentData) => {
  const isFormData = documentData instanceof FormData
  const { data } = await api.patch(`documental/documentos/${id}/`, documentData, {
    headers: isFormData ? { 'Content-Type': 'multipart/form-data' } : {}
  })
  return data
}

export const getAlertasCount = async () => {
  const { data } = await api.get('documental/alertas/')
  return data
}

export const downloadZip = async (personaId, alcance) => {
  const response = await api.get(`documental/zip/${personaId}/`, {
    params: alcance ? { alcance } : undefined,
    responseType: 'blob',
  })
  return response.data
}

export const getPadronDocumental = async () => {
  const { data } = await api.get('documental/padron/')
  return data
}

export const downloadPadronDocumentalPdf = async (filters) => {
  const response = await api.get('documental/padron/reporte/', { params: filters, responseType: 'blob' })
  savePdfResponse(response, 'reporte-documental.pdf')
}

export const downloadCategoriaDocumentosZip = async (categoriaId, categoriaNombre = '') => {
  const response = await api.get(`documental/zip/categoria/${categoriaId}/`, {
    responseType: 'blob',
  })
  const fallback = categoriaNombre
    ? `documentacion_categoria_${categoriaNombre.toLowerCase().replace(/\s+/g, '_')}.zip`
    : `documentacion_categoria_${categoriaId}.zip`
  saveZipResponse(response, fallback)
  return response
}

