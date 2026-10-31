import { api } from './conf'
import { savePdfResponse } from './download'

const comprobantesEndpoint = 'finanzas/comprobante/'

export const getComprobantes = async (params = {}) => {
  const response = await api.get(comprobantesEndpoint, { params })
  return response.data
}

export const getComprobantesByCuota = (cuotaId) => getComprobantes({ cuota_id: cuotaId })

export const getComprobante = async (comprobanteId) => {
  const response = await api.get(`${comprobantesEndpoint}${comprobanteId}/`)
  return response.data
}

export const descargarComprobantePdf = async (comprobanteId) => {
  const response = await api.get(`${comprobantesEndpoint}${comprobanteId}/pdf/`, { responseType: 'blob' })
  savePdfResponse(response, `recibo-${comprobanteId}.pdf`)
}

// Refunds money of an annulled receipt: { monto, medio_de_pago, motivo, responsable }
export const emitirNotaCredito = async (comprobanteId, notaCredito) => {
  const response = await api.post(`${comprobantesEndpoint}${comprobanteId}/nota-credito/`, notaCredito)
  return response.data
}
