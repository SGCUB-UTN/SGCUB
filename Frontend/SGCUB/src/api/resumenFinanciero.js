import { api } from './conf'
import { errorDetailFrom, savePdfResponse } from './download'

const RESUMEN_ENDPOINT = 'finanzas/resumen/'

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
