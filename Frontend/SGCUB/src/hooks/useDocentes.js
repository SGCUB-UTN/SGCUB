import { useCallback, useEffect, useState } from 'react'
import { deactivateDocente, getDocentes, patchDocente, postDocente } from '../api/docentes'

function useDocentes({ view } = {}) {
  const [docentes, setDocentes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const cargarDocentes = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      setDocentes(await getDocentes({ view }))
    } catch (requestError) {
      setError(requestError)
    } finally {
      setIsLoading(false)
    }
  }, [view])

  const crearDocente = useCallback(async (docente) => {
    const docenteCreado = await postDocente(docente)
    await cargarDocentes()
    return docenteCreado
  }, [cargarDocentes])

  const editarDocente = useCallback(async (docenteId, docente) => {
    const docenteEditado = await patchDocente(docenteId, docente)
    await cargarDocentes()
    return docenteEditado
  }, [cargarDocentes])

  const darDeBajaDocente = useCallback(async (docenteId) => {
    await deactivateDocente(docenteId)
    await cargarDocentes()
  }, [cargarDocentes])

  useEffect(() => {
    cargarDocentes()
  }, [cargarDocentes])

  return {
    docentes,
    isLoading,
    error,
    recargarDocentes: cargarDocentes,
    crearDocente,
    editarDocente,
    darDeBajaDocente,
  }
}

export default useDocentes
