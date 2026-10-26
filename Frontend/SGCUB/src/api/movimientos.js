import { api } from './conf'

const endpoint = 'finanzas/movimiento-cuenta/'

export const getMovimientos = async (socioId, options = {}) => {
  const params = {}
  if (socioId) params.socio_id = socioId
  if (options.soloManuales) params.solo_manuales = 'true'
  const response = await api.get(endpoint, { params: Object.keys(params).length ? params : undefined })
  return response.data
}

export const crearMovimientoManual = async (movimiento) => {
  const response = await api.post(`${endpoint}manual/`, movimiento)
  return response.data
}

export const getConceptosMovimiento = async () => {
  const response = await api.get(`${endpoint}conceptos/`)
  return response.data
}

export const crearConceptoMovimiento = async (concepto) => {
  const response = await api.post(`${endpoint}conceptos/`, concepto)
  return response.data
}

export const eliminarConceptoMovimiento = async (conceptoId) => {
  await api.delete(`${endpoint}conceptos/${conceptoId}/`)
}

const nombreArchivo =(contentDisposition, movimientoId) => {
  const coincidencia = /filename="([^"]+)"/.exec(contentDisposition ?? '')
  return coincidencia ? coincidencia[1] : `comprobante-movimiento-${movimientoId}.pdf`
}

export const descargarMovimientoPdf = async (movimientoId) => {
  const response = await api.get(`${endpoint}${movimientoId}/pdf/`, { responseType: 'blob' })
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombreArchivo(response.headers['content-disposition'], movimientoId)
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
