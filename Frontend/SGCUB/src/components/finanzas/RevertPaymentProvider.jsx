import { useCallback, useMemo, useState } from 'react'
import { RevertPaymentContext } from './revertPaymentContext'
import RevertPaymentFlow from './RevertPaymentFlow'

// Mounted once in the main layout so the reversal survives the screen or modal that started it
function RevertPaymentProvider({ children }) {
  const [request, setRequest] = useState({ id: 0, opened: false, comprobanteId: null, onChanged: null })

  const openReversal = useCallback(({ comprobanteId, onChanged = null }) => {
    setRequest((current) => ({ id: current.id + 1, opened: true, comprobanteId, onChanged }))
  }, [])

  // Keep the request data while closing so the modal doesn't flash empty during its exit animation
  const close = useCallback(() => setRequest((current) => ({ ...current, opened: false })), [])

  const value = useMemo(() => ({ openReversal }), [openReversal])

  return (
    <RevertPaymentContext.Provider value={value}>
      {children}
      {request.comprobanteId && (
        <RevertPaymentFlow
          key={request.id}
          comprobanteId={request.comprobanteId}
          opened={request.opened}
          onClose={close}
          onChanged={request.onChanged ?? undefined}
        />
      )}
    </RevertPaymentContext.Provider>
  )
}

export default RevertPaymentProvider
