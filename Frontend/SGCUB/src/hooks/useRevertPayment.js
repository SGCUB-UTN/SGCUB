import { useContext } from 'react'
import { RevertPaymentContext } from '../components/finanzas/revertPaymentContext'

// Returns { openReversal({ comprobanteId | settlement: { cuota, item }, onChanged? }) }
export default function useRevertPayment() {
  const context = useContext(RevertPaymentContext)
  if (!context) throw new Error('useRevertPayment must be used inside RevertPaymentProvider')
  return context
}
