import { api } from './conf'

const endpoint = 'automatizaciones/'

export const getAutomatizaciones = async () => {
  const response = await api.get(endpoint)
  return response.data
}

export const getAutomatizacionExecutions = async (page = 1) => {
  const response = await api.get(`${endpoint}ejecuciones/`, { params: { page } })
  return response.data
}

export const updateAutomatizacionStatus = async (id, isActive) => {
  const response = await api.patch(`${endpoint}${id}/`, { is_active: isActive })
  return response.data
}

const categoryUpdateEndpoint = `${endpoint}categorias/`

export const getCategoryUpdateStatus = async () => {
  const response = await api.get(categoryUpdateEndpoint)
  return response.data
}

export const runCategoryUpdate = async (executedBy) => {
  const response = await api.post(`${categoryUpdateEndpoint}ejecutar/`, { ejecutado_por: executedBy })
  return response.data
}

const recategorizationEndpoint = `${endpoint}recategorizacion/`

export const getRecategorizationStatus = async () => {
  const response = await api.get(recategorizationEndpoint)
  return response.data.ultima_ejecucion
}

export const runRecategorization = async (executedBy) => {
  const response = await api.post(`${recategorizationEndpoint}ejecutar/`, { ejecutado_por: executedBy })
  return response.data.ultima_ejecucion
}

export const getRecategorizationResults = async (executionId, type, page = 1, order = 'asc') => {
  const response = await api.get(`${recategorizationEndpoint}${executionId}/resultados/`, {
    params: { tipo: type, page, orden: order },
  })
  return response.data
}

export const getRecategorizationLog = async (executionId) => {
  const response = await api.get(`${recategorizationEndpoint}${executionId}/registro/`)
  return response.data.registro
}

export const decideRecategorizationResult = async (resultId, payload) => {
  const response = await api.post(`${recategorizationEndpoint}resultados/${resultId}/decision/`, payload)
  return response.data
}

export const acceptAllRecategorizationSuggestions = async (executionId) => {
  const response = await api.post(`${recategorizationEndpoint}${executionId}/aceptar-sugeridos/`)
  return response.data
}
