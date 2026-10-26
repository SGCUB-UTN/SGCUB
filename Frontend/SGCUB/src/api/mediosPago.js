import { api } from './conf'

const mediosPagoEndpoint = 'finanzas/medio-pago/'

export const getMediosPago = async ({ onlyActive = false } = {}) => {
  const response = await api.get(mediosPagoEndpoint, { params: onlyActive ? { activos: 'true' } : {} })
  return response.data
}

export const postMedioPago = async (medio) => {
  const response = await api.post(mediosPagoEndpoint, medio)
  return response.data
}

export const patchMedioPago = async (medioId, medio) => {
  const response = await api.patch(`${mediosPagoEndpoint}${medioId}/`, medio)
  return response.data
}

// Only methods never used in a payment can be deleted; the rest are disabled
export const deleteMedioPago = async (medioId) => {
  await api.delete(`${mediosPagoEndpoint}${medioId}/`)
}
