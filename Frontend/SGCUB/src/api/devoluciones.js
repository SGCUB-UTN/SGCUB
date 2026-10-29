import { api } from './conf'
import { savePdfResponse } from './download'

const devolucionesEndpoint = 'finanzas/devolucion/'

export const getDevoluciones = async (params = {}) => {
  const response = await api.get(devolucionesEndpoint, { params })
  return response.data
}

// Money given back that was never registered as income: { socio_id, concepto, monto, medio_de_pago, responsable }
export const registrarDevolucionManual = async (devolucion) => {
  const response = await api.post(devolucionesEndpoint, devolucion)
  return response.data
}

export const descargarDevolucionPdf = async (devolucionId) => {
  const response = await api.get(`${devolucionesEndpoint}${devolucionId}/pdf/`, { responseType: 'blob' })
  savePdfResponse(response, `devolucion-${devolucionId}.pdf`)
}
