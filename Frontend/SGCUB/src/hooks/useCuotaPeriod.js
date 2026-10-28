import { useCallback, useEffect, useState } from 'react'
import { getCuotaPeriodSummary, getCuotaTaskRuns, getPeriodCuotas } from '../api/cuotas'

const LOADERS = {
  summary: getCuotaPeriodSummary,
  cuotas: getPeriodCuotas,
  runs: getCuotaTaskRuns,
}

const EMPTY = { data: null, error: null, period: null, key: null }

function useCuotaPeriod(period) {
  const [resources, setResources] = useState({ summary: EMPTY, cuotas: EMPTY, runs: EMPTY })
  const [version, setVersion] = useState(0)
  const requestKey = `${period}#${version}`

  useEffect(() => {
    let active = true
    Object.entries(LOADERS).forEach(([name, load]) => {
      const store = (result) => active && setResources((current) => ({
        ...current,
        [name]: { data: null, error: null, ...result, period, key: requestKey },
      }))
      load(period)
        .then((data) => store({ data }))
        .catch((error) => store({ error }))
    })
    return () => { active = false }
  }, [period, requestKey])

  const reload = useCallback(() => setVersion((current) => current + 1), [])

  const view = (resource) => ({
    data: resource.period === period ? resource.data : null,
    isLoading: resource.key !== requestKey,
    error: resource.key === requestKey ? resource.error : null,
  })

  return {
    summary: view(resources.summary),
    cuotas: view(resources.cuotas),
    runs: view(resources.runs),
    reload,
  }
}

export default useCuotaPeriod
