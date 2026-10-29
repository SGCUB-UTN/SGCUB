import { useCallback, useMemo, useState } from 'react'
import { RegisterPaymentContext } from './registerPaymentContext'
import RegisterPaymentModal from './RegisterPaymentModal'

const NO_CUOTAS = []

// Mounted once in the main layout so any screen can open the payment modal
function RegisterPaymentProvider({ children }) {
  const [request, setRequest] = useState({ id: 0, opened: false, socioId: null, cuotaIds: NO_CUOTAS, reversal: null, onSuccess: null })

  // `reversal` charges again a reverted payment (see refunds.reversalOf)
  const openPayment = useCallback(({ socioId = null, cuotaIds = NO_CUOTAS, reversal = null, onSuccess = null } = {}) => {
    setRequest((current) => ({ id: current.id + 1, opened: true, socioId, cuotaIds, reversal, onSuccess }))
  }, [])

  // Keep the request data while closing so the modal doesn't flash empty during its exit animation
  const close = useCallback(() => setRequest((current) => ({ ...current, opened: false })), [])

  const value = useMemo(() => ({ openPayment }), [openPayment])

  return (
    <RegisterPaymentContext.Provider value={value}>
      {children}
      <RegisterPaymentModal
        key={request.id}
        opened={request.opened}
        initialSocioId={request.socioId}
        initialCuotaIds={request.cuotaIds}
        reversal={request.reversal}
        onClose={close}
        onSuccess={request.onSuccess ?? undefined}
      />
    </RegisterPaymentContext.Provider>
  )
}

export default RegisterPaymentProvider
