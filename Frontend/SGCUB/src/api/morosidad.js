import { api } from './conf'

const reportEndpoint = 'finanzas/morosidad/'

const buildReportParams = ({ alcance, tipo, periodo, referencia, categoriaId }) => {
  const params = { alcance, tipo, periodo, referencia }
  if (alcance === 'categoria') params.categoria_id = categoriaId
  return params
}

const filenameFrom = (contentDisposition) => {
  const match = /filename="([^"]+)"/.exec(contentDisposition ?? '')
  return match ? match[1] : 'reporte-morosidad.pdf'
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
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filenameFrom(response.headers['content-disposition'])
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
