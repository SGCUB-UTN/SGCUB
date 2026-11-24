import { useCallback, useEffect, useState } from 'react'
import { getResumenInicio } from '../api/inicio'
import { CAJA_CHANGED_EVENT } from '../components/finanzas/cajaEvents'

export default function useDashboard() {
  const [load, setLoad] = useState({ data: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    getResumenInicio()
      .then((data) => active && setLoad({ data, error: null }))
      .catch((error) => active && setLoad((current) => ({ data: current.data, error })))
    return () => { active = false }
  }, [version])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  useEffect(() => {
    window.addEventListener(CAJA_CHANGED_EVENT, reload)
    return () => window.removeEventListener(CAJA_CHANGED_EVENT, reload)
  }, [reload])

  return {
    isLoading: load.data === null && load.error === null,
    data: load.data,
    error: load.error,
    reload,
  }
}
