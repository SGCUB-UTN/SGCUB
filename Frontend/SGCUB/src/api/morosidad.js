import { api } from './conf'
import { savePdfResponse } from './download'

const reportEndpoint = 'finanzas/morosidad/'

const buildReportParams = ({ alcance, tipo, periodo, referencia, categoriaId }) => {
  const params = { alcance, tipo, periodo, referencia }
  if (alcance === 'categoria') params.categoria_id = categoriaId
  return params
}

const errorDetailFrom = async (requestError) => {
  const data = requestError.response?.data
  if (!(data instanceof Blob)) return requestError
  try {
    requestError.response.data = JSON.parse(await data.text())
  } catch {
    requestError.response.data = null
  }
  return requestError
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
