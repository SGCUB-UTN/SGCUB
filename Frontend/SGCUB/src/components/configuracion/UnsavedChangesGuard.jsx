import { useEffect } from 'react'
import { Modal, Text } from '@mantine/core'
import { useBlocker } from 'react-router-dom'
import { BUTTON_CLASSES } from './settingsForm'

// Warns before leaving the screen with unsaved changes: in-app navigation and closing or reloading the tab
export default function UnsavedChangesGuard({ isDirty }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => (
    isDirty && currentLocation.pathname !== nextLocation.pathname
  ))

  useEffect(() => {
    if (!isDirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const isBlocked = blocker.state === 'blocked'

  return (
    <Modal
      opened={isBlocked}
      onClose={() => blocker.reset?.()}
      centered
      title={<Text fw={700} size="xl">¿Salir sin guardar?</Text>}
    >
      <div className="flex flex-col gap-5">
        <p className="text-base text-on-surface-variant">
          Hay cambios en la configuración que todavía no guardaste. Si salís de esta pantalla, se van a perder.
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={BUTTON_CLASSES.secondary} onClick={() => blocker.reset?.()}>Seguir editando</button>
          <button type="button" className={BUTTON_CLASSES.danger} onClick={() => blocker.proceed?.()}>
            Salir y perder los cambios
          </button>
        </div>
      </div>
    </Modal>
  )
}
