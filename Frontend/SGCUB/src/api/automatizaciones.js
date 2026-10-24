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
