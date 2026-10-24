import { api } from './conf'

const endpoint = 'finanzas/movimiento-cuenta/'

export const getMovimientos = async (socioId, options = {}) => {
  const params = {}
  if (socioId) params.socio_id = socioId
  if (options.soloManuales) params.solo_manuales = 'true'
  const response = await api.get(endpoint, { params: Object.keys(params).length ? params : undefined })
  return response.data
}

export const crearMovimientoManual = async (movimiento) => {
  const response = await api.post(`${endpoint}manual/`, movimiento)
  return response.data
}
