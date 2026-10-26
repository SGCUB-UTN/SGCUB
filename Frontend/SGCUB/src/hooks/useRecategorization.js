import { useCallback, useEffect, useState } from 'react'
import { getRecategorizationStatus, runRecategorization } from '../api/automatizaciones'

const POLL_INTERVAL_MS = 3000

// Returns the latest recategorization run and keeps polling it while it is still being processed
export default function useRecategorization() {
  const [execution, setExecution] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(() => getRecategorizationStatus()
    .then((data) => {
      setExecution(data)
      setError(null)
    })
    .catch((requestError) => setError(requestError))
    .finally(() => setIsLoading(false)), [])

  useEffect(() => {
    load()
  }, [load])

  const isRunning = execution?.estado === 'en_curso'

  useEffect(() => {
    if (!isRunning) return undefined
    const timer = setTimeout(load, POLL_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [isRunning, execution, load])

  const run = useCallback(async (executedBy) => {
    setExecution(await runRecategorization(executedBy))
  }, [])

  return { execution, isLoading, error, isRunning, reload: load, run, setExecution }
}
