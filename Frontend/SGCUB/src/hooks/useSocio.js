import { useCallback, useEffect, useState } from 'react'
import { deactivateSocio, getSocios, postSocio, putSocio } from '../api/socios'

function useSocio({ onlyMembers = false } = {}) {
  const [socios, setSocios] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargarSocios = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const sociosRecibidos = await getSocios({ onlyMembers })
      setSocios(sociosRecibidos)
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [onlyMembers])

  const crearSocio = useCallback(async (socio) => {
    const socioCreado = await postSocio(socio)
    await cargarSocios()
    return socioCreado
  }, [cargarSocios])

  const modificarSocio = useCallback(async (socioId, socio) => {
    const socioModificado = await putSocio(socioId, socio)
    await cargarSocios()
    return socioModificado
  }, [cargarSocios])

  const darDeBajaSocio = useCallback(async (socioId) => {
    await deactivateSocio(socioId)
    await cargarSocios()
  }, [cargarSocios])

  useEffect(() => {
    cargarSocios()
  }, [cargarSocios])

  return {
    socios,
    isLoading,
    error,
    recargarSocios: cargarSocios,
    crearSocio,
    modificarSocio,
    darDeBajaSocio,
  }
}

export default useSocio
