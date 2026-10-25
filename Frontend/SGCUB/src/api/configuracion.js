import { api } from './conf'

const generalEndpoint = 'configuracion/'
const financialEndpoint = 'finanzas/configuracion/'

export const DEFAULT_DOCUMENT_ALERT_DAYS = 30

// Settings that apply as soon as they are saved (club, registration fee, alerts, notifications)
export const getConfiguracionGeneral = async () => {
  const response = await api.get(generalEndpoint)
  return response.data
}

export const patchConfiguracionGeneral = async (configuracion) => {
  const response = await api.patch(generalEndpoint, configuracion)
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

// Only the fields sent change; the rest come from the version in force for periodo_vigencia
export const postConfiguracionFinanciera = async (version) => {
  const response = await api.post(financialEndpoint, version)
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
