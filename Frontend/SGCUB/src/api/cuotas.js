import { api } from './conf'

const cuotasEndpoint = 'finanzas/cuota/'

export const getCuotas = async () => {
  const response = await api.get(cuotasEndpoint)
  return response.data
}

export const postCuota = async (cuota) => {
  const response = await api.post(cuotasEndpoint, cuota)
  return response.data
}

export const patchCuota = async (cuotaId, cuota) => {
  const response = await api.patch(`${cuotasEndpoint}${cuotaId}/`, cuota)
  return response.data
}

export const deleteCuota = async (cuotaId) => {
  const response = await api.delete(`${cuotasEndpoint}${cuotaId}/`)
  return response.data
}

export const postBeneficio = async (cuotaId, beneficio) => {
  const response = await api.post(`${cuotasEndpoint}${cuotaId}/beneficio/`, beneficio)
  return response.data
}

export const annulItemCuota = async (itemId, authorization) => {
  const response = await api.post(`finanzas/item-cuota/${itemId}/anular/`, authorization)
  return response.data
}
