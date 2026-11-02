import { api } from './conf'

const comunicacionesEndpoint = 'comunicaciones/'

export const getComunicacionesKPIs = async () => {
  const response = await api.get(`${comunicacionesEndpoint}resumen/`)
  return response.data
}

export const getHistorialNotificaciones = async () => {
  const response = await api.get(`${comunicacionesEndpoint}notificacion/`)
  return response.data
}

export const postEnviarNotificacion = async (payload) => {
  const notificacionBody = {
    titulo: payload.titulo || payload.asunto || 'Notificación institucional',
    asunto: payload.asunto || payload.titulo || '',
    contenido: payload.contenido || payload.cuerpo || '',
    estado: 'ENVIADA',
    copia_secretaria: Boolean(payload.copia_secretaria),
    envios: payload.envios || [],
  }

  const response = await api.post(`${comunicacionesEndpoint}notificacion/`, notificacionBody)
  return response.data
}
