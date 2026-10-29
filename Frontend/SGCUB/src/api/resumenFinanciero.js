import { api } from './conf'

const RESUMEN_ENDPOINT = 'finanzas/resumen/'

const filenameFrom = (contentDisposition) => {
  const match = /filename="([^"]+)"/.exec(contentDisposition ?? '')
  return match ? match[1] : 'informe-financiero.pdf'
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

// Monthly summary of `periodo` ('YYYY-MM', current month by default) plus the current debt overview
export const getResumenFinanciero = async (periodo) => {
  const response = await api.get(RESUMEN_ENDPOINT, { params: periodo ? { periodo } : undefined })
  return response.data
}

export const downloadFinancialSummaryPdf = async (periodo) => {
  let response
  try {
    response = await api.get(`${RESUMEN_ENDPOINT}pdf/`, {
      params: periodo ? { periodo } : undefined,
      responseType: 'blob',
    })
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
