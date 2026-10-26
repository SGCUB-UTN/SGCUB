import { useCallback, useEffect, useState } from 'react'
import { getCategoryUpdateStatus, runCategoryUpdate } from '../api/automatizaciones'

// Returns whether the categories are on the current year and the last manual update
export default function useCategoryUpdate() {
  const [status, setStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    getCategoryUpdateStatus()
      .then((data) => { if (active) setStatus(data) })
      .catch((requestError) => { if (active) setError(requestError) })
      .finally(() => { if (active) setIsLoading(false) })
    return () => { active = false }
  }, [])

  const run = useCallback(async (executedBy) => {
    setStatus(await runCategoryUpdate(executedBy))
    setError(null)
  }, [])

  return { status, isLoading, error, run }
}
