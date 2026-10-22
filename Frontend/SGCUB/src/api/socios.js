import { api } from './conf'

const sociosEndpoint = 'padron/socio/'

export const getSocios = async ({ onlyMembers = false } = {}) => {
  try {
    const params = onlyMembers ? { es_jugador: false } : undefined
    const response = await api.get(sociosEndpoint, { params })
    return response.data
  } catch (error) {
    console.error('Error al obtener los socios:', error)
    throw error
  }
}

export const getSocio = async (socioId) => {
  try {
    const response = await api.get(`${sociosEndpoint}${socioId}/`)
    return response.data
  } catch (error) {
    console.error('Error al obtener el socio:', error)
    throw error
  }
}

export const postSocio = async (socio) => {
  try {
    const response = await api.post(sociosEndpoint, socio)
    return response.data
  } catch (error) {
    console.error('Error al crear el socio:', error)
    throw error
  }
}

export const putSocio = async (socioId, socio) => {
  try {
    const response = await api.put(`${sociosEndpoint}${socioId}/`, socio)
    return response.data
  } catch (error) {
    console.error('Error al modificar el socio:', error)
    throw error
  }
}

export const deactivateSocio = async (socioId) => {
  try {
    const response = await api.delete(`${sociosEndpoint}${socioId}/`)
    return response.data
  } catch (error) {
    console.error('Error al dar de baja el socio:', error)
    throw error
  }
}

export const activateSocio = async (socioId) => {
  try {
    const { data: estados } = await api.get('padron/estado-socio/')
    const activo = estados.find((estado) => estado.nombre === 'Activo')
    const response = await api.patch(`${sociosEndpoint}${socioId}/`, { estado_administrativo: activo?.estado_id })
    return response.data
  } catch (error) {
    console.error('Error al dar de alta el socio:', error)
    throw error
  }
}
