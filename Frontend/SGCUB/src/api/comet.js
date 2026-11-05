import { api } from './conf'
import { savePdfResponse } from './download'

const comet = 'comet/'

export const getCometEstadoJugador = async (jugadorId) => {
  const { data } = await api.get(`${comet}jugador/${jugadorId}/estado/`)
  return data
}

export const downloadPlanillaJugador = async (jugadorId) => {
  const response = await api.get(`${comet}jugador/${jugadorId}/planilla/`, {
    responseType: 'blob',
  })
  savePdfResponse(response, `planilla_comet_${jugadorId}.pdf`)
  return response
}

export const downloadPlanillasCategoria = async (categoriaId, categoriaNombre = '') => {
  const response = await api.get(`${comet}categoria/${categoriaId}/planillas/`, {
    responseType: 'blob',
  })
  const fallback = categoriaNombre
    ? `planillas_comet_${categoriaNombre.toLowerCase().replace(/\s+/g, '_')}.pdf`
    : `planillas_comet_categoria_${categoriaId}.pdf`
  savePdfResponse(response, fallback)
  return {
    totalAptos: response.headers['x-total-aptos'],
    totalExcluidos: response.headers['x-total-excluidos'],
  }
}
