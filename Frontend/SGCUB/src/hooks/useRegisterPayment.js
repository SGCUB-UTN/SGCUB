import { useContext } from 'react'
import { RegisterPaymentContext } from '../components/finanzas/registerPaymentContext'

// Returns { openPayment({ socioId?, cuotaIds?, reversal?, onSuccess? }) }
export default function useRegisterPayment() {
  const context = useContext(RegisterPaymentContext)
  if (!context) throw new Error('useRegisterPayment must be used inside RegisterPaymentProvider')
  return context
}
