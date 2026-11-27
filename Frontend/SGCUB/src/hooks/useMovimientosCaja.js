import { useCallback, useEffect, useState } from 'react'
import { getComprobantes } from '../api/comprobantes'
import { getDevoluciones } from '../api/devoluciones'
import { CAJA_CHANGED_EVENT } from '../components/finanzas/cajaEvents'

const EMPTY = { comprobantes: [], devoluciones: [] }

export default function useMovimientosCaja(period) {
  const [load, setLoad] = useState({ period: null, data: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    const params = { periodo: period }
    Promise.all([getComprobantes(params), getDevoluciones(params)])
      .then(([comprobantes, devoluciones]) => active && setLoad({ period, data: { comprobantes, devoluciones }, error: null }))
      .catch((error) => active && setLoad((current) => ({
        period,
        data: current.period === period ? current.data : null,
        error,
      })))
    return () => { active = false }
  }, [period, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    window.addEventListener(CAJA_CHANGED_EVENT, reload)
    return () => window.removeEventListener(CAJA_CHANGED_EVENT, reload)
  }, [reload])

  const loaded = load.period === period
  const data = loaded ? load.data : null
  return {
    isLoading: !loaded,
    ...(data ?? EMPTY),
    hasData: Boolean(data),
    error: loaded ? load.error : null,
    reload,
  }
}
