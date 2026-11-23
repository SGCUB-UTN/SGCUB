import { useEffect } from 'react'
import { useFocusTrap } from '@mantine/hooks'

export default function useDialogFocus() {
  const trapRef = useFocusTrap(true)

  useEffect(() => {
    const previous = document.activeElement
    return () => {
      if (typeof previous?.focus === 'function') setTimeout(() => previous.focus({ preventScroll: true }), 0)
    }
  }, [])

  return trapRef
}
