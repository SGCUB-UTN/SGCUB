import { useEffect, useState } from 'react'
import { getReportePadron } from '../api/reportesPadron'

function useReportePadron(filters) {
  const [result, setResult] = useState({ key: null, report: null, error: '' })
  const requestKey = JSON.stringify(filters)

  useEffect(() => {
    let active = true
    const key = JSON.stringify(filters)
    getReportePadron(filters)
      .then((report) => active && setResult({ key, report, error: '' }))
      .catch((requestError) => active && setResult({
        key,
        report: null,
        error: requestError.response?.data?.detail || 'No se pudo generar el reporte del padrón.',
      }))
    return () => { active = false }
  }, [filters])

  return { report: result.report, error: result.error, isLoading: result.key !== requestKey }
}

export default useReportePadron
