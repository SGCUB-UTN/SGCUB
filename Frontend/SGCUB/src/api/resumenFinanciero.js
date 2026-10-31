import { api } from './conf'
import { savePdfResponse } from './download'

const RESUMEN_ENDPOINT = 'finanzas/resumen/'

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
  const fallback = periodo ? `resumen-financiero-${periodo}.pdf` : 'resumen-financiero.pdf'
  savePdfResponse(response, fallback)
}
