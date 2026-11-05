import { useCallback, useEffect, useState } from 'react'
import { getCometEstadoJugador, downloadPlanillaJugador } from '../api/comet'

export function useCometJugadorEstado(jugadorId) {
  const [estado, setEstado] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    if (!jugadorId) return
    setIsLoading(true)
    setError(null)
    try {
      setEstado(await getCometEstadoJugador(jugadorId))
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

export function useDownloadPlanillaJugador() {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState(null)

  const descargar = useCallback(async (jugadorId) => {
    setDownloading(true)
    setError(null)
    try {
      await downloadPlanillaJugador(jugadorId)
      return { ok: true }
    } catch (err) {
      let msg = 'No se pudo descargar la planilla.'
      if (err.response?.data?.detail) {
        msg = err.response.data.detail
      }
      setError(msg)
      return { ok: false, error: msg }
    } finally {
      setDownloading(false)
    }
  }, [])

  return { descargar, downloading, error, setError }
}
