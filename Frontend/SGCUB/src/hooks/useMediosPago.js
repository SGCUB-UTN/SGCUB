import { useEffect, useState } from 'react'
import { getMediosPago } from '../api/mediosPago'

const ICONS = { Efectivo: 'payments', Transferencia: 'account_balance', BilleteraVirtual: 'wallet' }

const toOption = (medio) => ({ value: medio.codigo, label: medio.nombre, icon: ICONS[medio.codigo] ?? 'credit_card' })

// Payment methods enabled in Configuración, as select options
function useMediosPago() {
  const [paymentMethods, setPaymentMethods] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    getMediosPago({ onlyActive: true })
      .then((medios) => {
        if (!cancelled) setPaymentMethods(medios.map(toOption))
      })
      .catch((requestError) => {
        if (!cancelled) setError(requestError)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const methodLabel = (value) => paymentMethods.find((option) => option.value === value)?.label ?? value

  return { paymentMethods, methodLabel, error }
}

export default useMediosPago
