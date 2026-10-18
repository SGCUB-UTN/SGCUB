import { api } from './conf'

const comunicacionesEndpoint = 'comunicaciones/'

export const getComunicacionesKPIs = async () => {
  try {
    const response = await api.get(`${comunicacionesEndpoint}resumen/`)
    return response.data
  } catch (error) {
    // Si el backend aún no implementó el endpoint específico de KPIs calculadas
    return {
      envios_mes: 0,
      mensajes_entregados: 0,
      tasa_entrega: 100,
      canales_activos_texto: 'Email corporativo y WhatsApp',
      sin_contacto: 0,
    }
  }
}

export const getHistorialNotificaciones = async () => {
  try {
    const response = await api.get(`${comunicacionesEndpoint}notificacion/`)
    return response.data
  } catch (error) {
    console.warn('Error al obtener historial de notificaciones:', error?.message)
    return []
  }
}

export const postEnviarNotificacion = async (payload) => {
  const notificacionBody = {
    titulo: payload.titulo || payload.asunto || 'Notificación institucional',
    asunto: payload.asunto || payload.titulo || '',
    contenido: payload.contenido || payload.cuerpo || '',
    estado: 'ENVIADA',
    envios: payload.envios || [],
  }

  const response = await api.post(`${comunicacionesEndpoint}notificacion/`, notificacionBody)
  return response.data
}
