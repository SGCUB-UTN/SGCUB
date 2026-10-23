import { api } from './conf'

const becasEndpoint = 'finanzas/beca/'

export const postBecaSocio = async (socioId, beca) => {
  const response = await api.post(`finanzas/socio/${socioId}/beca/`, beca)
  return response.data
}

export const getBecasBySocio = async (socioId) => {
  const response = await api.get(becasEndpoint, { params: { socio_id: socioId } })
  return response.data
}
