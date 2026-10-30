import { useCallback, useEffect, useState } from 'react'
import { getComprobantes } from '../api/comprobantes'
import { getDevoluciones } from '../api/devoluciones'

const EMPTY = { comprobantes: [], devoluciones: [] }

export default function useMovimientosCaja(period) {
  const [load, setLoad] = useState({ period: null, data: EMPTY, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    const params = { periodo: period }
    Promise.all([getComprobantes(params), getDevoluciones(params)])
      .then(([comprobantes, devoluciones]) => active && setLoad({ period, data: { comprobantes, devoluciones }, error: null }))
      .catch((error) => active && setLoad({ period, data: EMPTY, error }))
    return () => { active = false }
  }, [period, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  const loaded = load.period === period
  return {
    isLoading: !loaded,
    ...(loaded ? load.data : EMPTY),
    error: loaded ? load.error : null,
    reload,
  }
}
