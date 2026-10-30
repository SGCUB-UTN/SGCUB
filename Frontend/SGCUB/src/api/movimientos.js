import { api } from './conf'

const conceptosEndpoint = 'finanzas/movimiento-cuenta/conceptos/'

export const getConceptosMovimiento = async () => {
  const response = await api.get(conceptosEndpoint)
  return response.data
}

export const crearConceptoMovimiento = async (concepto) => {
  const response = await api.post(conceptosEndpoint, concepto)
  return response.data
}

export const eliminarConceptoMovimiento = async (conceptoId) => {
  await api.delete(`${conceptosEndpoint}${conceptoId}/`)
}
