import { useCallback, useEffect, useState } from 'react'
import { crearConceptoMovimiento, getConceptosMovimiento } from '../api/movimientos'

function useConceptosMovimiento() {
  const [concepts, setConcepts] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getConceptosMovimiento()
      .then((data) => {
        if (!cancelled) setConcepts(data)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const createConcept = useCallback(async (nombre, origen) => {
    const concept = await crearConceptoMovimiento({ nombre, origen })
    setConcepts((current) => (
      current.some((c) => c.concepto_movimiento_id === concept.concepto_movimiento_id)
        ? current
        : [...current, concept]
    ))
    return concept
  }, [])

  return { concepts, isLoading, error, createConcept }
}

export default useConceptosMovimiento
