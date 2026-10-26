import { api } from './conf'

const generalEndpoint = 'configuracion/'
const financialEndpoint = 'finanzas/configuracion/'

export const DEFAULT_DOCUMENT_ALERT_DAYS = 30

// Club data, delinquency, alerts and notifications
export const getConfiguracionGeneral = async () => {
  const response = await api.get(generalEndpoint)
  return response.data
}

/**
 * Saves every change of the configuration screen at once.
 * payload: { responsable, general: {...}, financiera: { periodo_vigencia, ... } | null, quitar_logo }
 * With a logo file the request goes as multipart, with the payload as JSON in `datos`.
 */
export const guardarConfiguracion = async (payload, logo = null) => {
  if (!logo) {
    const response = await api.post(`${generalEndpoint}guardar/`, payload)
    return response.data
  }
  const formData = new FormData()
  formData.append('datos', JSON.stringify(payload))
  formData.append('club_logo', logo)
  const response = await api.post(`${generalEndpoint}guardar/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

// seccion: 'Club' | 'Finanzas' | 'Documentacion' | 'Comunicaciones'; without it, every change
export const getHistorialConfiguracion = async (seccion) => {
  const response = await api.get(`${generalEndpoint}historial/`, { params: seccion ? { seccion } : {} })
  return response.data
}

export const getDocumentAlertDays = async () => {
  const configuracion = await getConfiguracionGeneral()
  return configuracion.dias_alerta_documentos ?? DEFAULT_DOCUMENT_ALERT_DAYS
}

// Cuota parameters, versioned by the period they apply from ('YYYY-MM'); without it, the current one
export const getConfiguracionFinanciera = async (periodo) => {
  const response = await api.get(financialEndpoint, { params: periodo ? { periodo } : {} })
  return response.data
}

export const getVersionesConfiguracionFinanciera = async () => {
  const response = await api.get(`${financialEndpoint}versiones/`)
  return response.data
}

// How many unpaid cuotas a new version from that period would update
export const getImpactoConfiguracionFinanciera = async (periodo) => {
  const response = await api.get(`${financialEndpoint}impacto/`, { params: { periodo } })
  return response.data
}
