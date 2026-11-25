import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import { formatDni, getErrorMessage } from '../personas/format'

function ConfirmRemoveJugadorLigaModal({ opened, onClose, onConfirm, jugador, liga }) {
  const [error, setError] = useState('')
  const [isRemoving, setIsRemoving] = useState(false)

  if (!jugador) return null

  const socio = jugador.socio ?? {}

  const handleConfirm = async () => {
    setIsRemoving(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo quitar el jugador de la liga.'))
      setIsRemoving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => !isRemoving && onClose()}
      centered
      title={<Text fw={700} size="xl">¿Quitar a este jugador de la liga?</Text>}
    >
      <div className="p-3 bg-surface-container-low rounded-lg space-y-1">
        <p className="text-base font-semibold text-on-surface">{`${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim() || 'Jugador sin nombre'}</p>
        <p className="text-sm text-on-surface-variant">DNI: <span className="font-medium text-on-surface">{formatDni(socio.dni) || '—'}</span></p>
        <p className="text-sm text-on-surface-variant">Categoría: <span className="font-medium text-on-surface">{jugador.categoria?.nombre ?? '—'}</span></p>
      </div>
      <Text size="md" mt="md">
        Va a dejar de figurar en {liga.nombre}. Sus otras ligas no cambian.
      </Text>
      {error && <Text color="red" size="sm" mt="md">{error}</Text>}
      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose} disabled={isRemoving}>
          Cancelar
        </Button>
        <Button color="red" onClick={handleConfirm} loading={isRemoving}>
          Quitar jugador
        </Button>
      </Group>
    </Modal>
  )
}

export default ConfirmRemoveJugadorLigaModal
