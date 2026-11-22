import { useCallback, useEffect, useState } from 'react'
import {
  deactivateJugador,
  getJugadores,
  patchJugador,
  postJugador,
} from '../api/jugadores'

function useJugadores({ view } = {}) {
  const [jugadores, setJugadores] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargarJugadores = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setJugadores(await getJugadores({ view }))
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [view])

  const crearJugador = useCallback(async (jugador) => {
    const jugadorCreado = await postJugador(jugador)
    await cargarJugadores()
    return jugadorCreado
  }, [cargarJugadores])

  const editarJugador = useCallback(async (jugadorId, jugador) => {
    const jugadorEditado = await patchJugador(jugadorId, jugador)
    await cargarJugadores()
    return jugadorEditado
  }, [cargarJugadores])

  const darDeBajaJugador = useCallback(async (jugadorId) => {
    await deactivateJugador(jugadorId)
    await cargarJugadores()
  }, [cargarJugadores])

  useEffect(() => {
    cargarJugadores()
  }, [cargarJugadores])

  return {
    jugadores,
    isLoading,
    error,
    crearJugador,
    editarJugador,
    darDeBajaJugador,
  }
}

export default useJugadores
