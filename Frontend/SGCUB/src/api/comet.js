import { api } from './conf'

const comet = 'comet/'

// --- Estado ---
export const getCometStatus = async () => (await api.get(`${comet}status/`)).data

// --- READ ---
export const getCometJugadores = async () => (await api.get(`${comet}jugadores/`)).data
export const getCometInscripciones = async () => (await api.get(`${comet}inscripciones/`)).data
export const getCometCompeticiones = async () => (await api.get(`${comet}competiciones/`)).data
export const getCometEquipos = async () => (await api.get(`${comet}equipos/`)).data
export const getCometPartidos = async () => (await api.get(`${comet}partidos/`)).data
export const getCometResultados = async () => (await api.get(`${comet}resultados/`)).data
export const getCometTablas = async () => (await api.get(`${comet}tablas/`)).data
export const getCometLogs = async (params = {}) => (await api.get(`${comet}logs/`, { params })).data

// --- WRITE ---
export const exportarJugadorAComet = async (jugadorId) => {
  const { data } = await api.post(`${comet}jugador/${jugadorId}/exportar/`)
  return data
}

export const getEstadoCometJugador = async (jugadorId) => {
  const { data } = await api.get(`${comet}jugador/${jugadorId}/estado/`)
  return data
}