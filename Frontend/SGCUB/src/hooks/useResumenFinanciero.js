import { useCallback, useEffect, useState } from 'react'
import { getResumenFinanciero } from '../api/resumenFinanciero'

// Monthly financial summary of `period` ('YYYY-MM'), reloaded when the period changes or on reload()
export default function useResumenFinanciero(period) {
  const [load, setLoad] = useState({ period: null, data: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    getResumenFinanciero(period)
      .then((data) => active && setLoad({ period, data, error: null }))
      .catch((error) => active && setLoad({ period, data: null, error }))
    return () => { active = false }
  }, [period, version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  const loaded = load.period === period
  return {
    isLoading: !loaded,
    data: loaded ? load.data : null,
    error: loaded ? load.error : null,
    reload,
  }
}
