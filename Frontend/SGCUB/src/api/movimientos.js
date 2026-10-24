import { api } from './conf'

const endpoint = 'finanzas/movimiento-cuenta/'

export const getMovimientos = async (socioId) => {
  const response = await api.get(endpoint, { params: socioId ? { socio_id: socioId } : undefined })
  return response.data
}

export const crearMovimientoManual = async (movimiento) => {
  const response = await api.post(`${endpoint}manual/`, movimiento)
  return response.data
}
