import { api } from './conf'
import { getEstados } from './estados'

const jugadoresEndpoint = 'padron/jugador/'

export const getJugadores = async () => {
  const response = await api.get(jugadoresEndpoint)
  return response.data
}

export const getJugadoresByCategoria = async (categoriaId) => {
  const response = await api.get(jugadoresEndpoint, { params: { categoria: categoriaId } })
  return response.data
}

export const getJugador = async (jugadorId) => {
  const response = await api.get(`${jugadoresEndpoint}${jugadorId}/`)
  return response.data
}

export const postJugador = async (jugador) => {
  const response = await api.post(jugadoresEndpoint, jugador)
  return response.data
}

export const patchJugador = async (jugadorId, jugador) => {
  const response = await api.patch(`${jugadoresEndpoint}${jugadorId}/`, jugador)
  return response.data
}

export const deactivateJugador = async (jugadorId, { completa = false } = {}) => {
  await api.delete(`${jugadoresEndpoint}${jugadorId}/`, { params: completa ? { completa: true } : undefined })
}

export const activateJugador = async (jugadorId) => {
  const estados = await getEstados()
  const activo = estados.find((estado) => estado.nombre === 'Activo')
  return patchJugador(jugadorId, { estado: activo?.estado_id })
}
