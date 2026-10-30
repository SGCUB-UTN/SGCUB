import { api } from './conf'

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
