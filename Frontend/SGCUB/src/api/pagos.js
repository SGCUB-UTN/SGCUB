import { api } from './conf'

export const registrarPago = async (pago) => {
  const response = await api.post('finanzas/pago/registrar/', pago)
  return response.data
}

// Annuls a payment of cuotas (only the latest of the socio) or an income: { motivo, responsable }
export const revertirPago = async (pagoId, reversion) => {
  const response = await api.post(`finanzas/pago/${pagoId}/revertir/`, reversion)
  return response.data
}

// Income other than cuotas: { socio_id, concepto, monto_total, medios }
export const registrarIngreso = async (ingreso) => {
  const response = await api.post('finanzas/ingreso/', ingreso)
  return response.data
}
