import { useCallback, useEffect, useState } from 'react'
import { getResumenFinanciero } from '../api/resumenFinanciero'
import { CAJA_CHANGED_EVENT } from '../components/finanzas/cajaEvents'

export default function useResumenFinanciero(period) {
  const [load, setLoad] = useState({ period: null, data: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    getResumenFinanciero(period)
      .then((data) => active && setLoad({ period, data, error: null }))
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
  return {
    isLoading: !loaded,
    data: loaded ? load.data : null,
    error: loaded ? load.error : null,
    reload,
  }
}
