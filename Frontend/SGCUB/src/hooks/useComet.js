import { useCallback, useEffect, useState } from 'react'
import {
  getCometCompeticiones,
  getCometEquipos,
  getCometInscripciones,
  getCometJugadores,
  getCometLogs,
  getCometPartidos,
  getCometResultados,
  getCometStatus,
  getCometTablas,
  exportarJugadorAComet,
  getEstadoCometJugador,
} from '../api/comet'

function useCometRead(fetcher) {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await fetcher())
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [fetcher])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { data, isLoading, error, recargar: cargar }
}

export const useCometJugadores = () => useCometRead(getCometJugadores)
export const useCometInscripciones = () => useCometRead(getCometInscripciones)
export const useCometCompeticiones = () => useCometRead(getCometCompeticiones)
export const useCometEquipos = () => useCometRead(getCometEquipos)
export const useCometPartidos = () => useCometRead(getCometPartidos)
export const useCometResultados = () => useCometRead(getCometResultados)
export const useCometTablas = () => useCometRead(getCometTablas)

export function useCometStatus() {
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let activo = true
    getCometStatus()
      .then((data) => { if (activo) setStatus(data) })
      .catch(() => { if (activo) setStatus({ modo: null, configurado: false }) })
      .finally(() => { if (activo) setIsLoading(false) })
    return () => { activo = false }
  }, [])

  return { status, isLoading }
}
export function useCometLogs(params = {}) {
  const [data, setData] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setData(await getCometLogs(params))
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [JSON.stringify(params)])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    cargar()
  }, [cargar])

  return { data, isLoading, error, recargar: cargar }
}

export function useCometJugadorEstado(jugadorId) {
  const [estado, setEstado] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    if (!jugadorId) return
    setIsLoading(true)
    setError(null)
    try {
      setEstado(await getEstadoCometJugador(jugadorId))
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [jugadorId])

  useEffect(() => {
    cargar()
  }, [cargar])

  return { estado, isLoading, error, recargar: cargar }
}

/**
 * Hook para disparar la exportación de un jugador.
 * Devuelve { exportar, exporting, resultado }.
 */
export function useExportarJugadorAComet() {
  const [exporting, setExporting] = useState(false)
  const [resultado, setResultado] = useState(null)

  const exportar = useCallback(async (jugadorId) => {
    setExporting(true)
    setResultado(null)
    try {
      const data = await exportarJugadorAComet(jugadorId)
      setResultado({ ok: true, data })
      return data
    } catch (requestError) {
      // El backend devuelve 400 con un log que tiene exitoso=false
      const data = requestError.response?.data
      setResultado({ ok: false, data })
      return data
    } finally {
      setExporting(false)
    }
  }, [])

  return { exportar, exporting, resultado }
}