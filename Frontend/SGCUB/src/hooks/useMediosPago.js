import { useCallback, useEffect, useState } from 'react'
import { getMediosPago } from '../api/mediosPago'

const ICONS = { Efectivo: 'payments', Transferencia: 'account_balance', BilleteraVirtual: 'wallet' }

const toOption = (medio) => ({ value: medio.codigo, label: medio.nombre, icon: ICONS[medio.codigo] ?? 'credit_card' })

function useMediosPago() {
  const [paymentMethods, setPaymentMethods] = useState([])
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    getMediosPago({ onlyActive: true })
      .then((medios) => {
        if (cancelled) return
        setPaymentMethods(medios.map(toOption))
        setError(null)
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setLoading(true)
    setError(null)
    setAttempt((current) => current + 1)
  }, [])

  const methodLabel = (value) => paymentMethods.find((option) => option.value === value)?.label ?? value

  return { paymentMethods, methodLabel, error, loading, retry }
}

export default useMediosPago
