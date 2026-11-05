import { api } from './conf'
import { errorDetailFrom, savePdfResponse } from './download'

const reportEndpoint = 'finanzas/morosidad/'

const buildReportParams = ({ tipo, periodo, referencia, categoriaId }) => {
  const isGender = typeof categoriaId === 'string' && categoriaId.startsWith('gender:')
  const byCategory = tipo === 'jugadores' && Boolean(categoriaId) && !isGender
  const byGender = tipo === 'jugadores' && isGender
  const params = { alcance: byCategory ? 'categoria' : 'activos', tipo, periodo, referencia }
  if (byCategory) params.categoria_id = categoriaId
  if (byGender) params.genero = categoriaId.replace('gender:', '')
  return params
}

export const getReporteMorosidad = async (filters) => {
  const response = await api.get(reportEndpoint, { params: buildReportParams(filters) })
  return response.data
}

export const downloadDelinquencyPdf = async (filters) => {
  let response
  try {
    response = await api.get(`${reportEndpoint}pdf/`, { params: buildReportParams(filters), responseType: 'blob' })
  } catch (requestError) {
    throw await errorDetailFrom(requestError)
  }
  savePdfResponse(response, 'reporte-morosidad.pdf')
}
