import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import ProfileScopeOptions from './ProfileScopeOptions'

const DEACTIVATION_TYPES = [
  {
    value: 'completa',
    label: 'Baja completa',
    description: 'Da de baja al jugador y al socio. Deja de abonar la cuota.',
  },
  {
    value: 'parcial',
    label: 'Baja parcial',
    description: 'Da de baja solo al jugador. Mantiene la cuota social.',
  },
]

function DeactivateJugadorContent({ onClose, onConfirm, nombreCompleto, loading, error }) {
  const [tipoBaja, setTipoBaja] = useState(null)

  return (
    <>
      <Text size="md">
        ¿Qué tipo de baja desea realizar para el jugador <strong>{nombreCompleto}</strong>?
      </Text>
      <ProfileScopeOptions
        name="tipo-baja"
        label="Tipo de baja"
        options={DEACTIVATION_TYPES}
        value={tipoBaja}
        disabled={loading}
        onChange={setTipoBaja}
      />
      {error && (
        <Text color="red" size="base" mt="md">
          {error}
        </Text>
      )}
      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button color="red" onClick={() => onConfirm(tipoBaja === 'completa')} loading={loading} disabled={!tipoBaja}>
          Dar de baja
        </Button>
      </Group>
    </>
  )
}

function DeactivateJugadorModal({ opened, onClose, onConfirm, jugador, loading, error }) {
  const nombreCompleto = jugador?.socio
    ? `${jugador.socio.nombre} ${jugador.socio.apellido}`.trim()
    : 'este jugador'

  return (
    <Modal opened={opened} onClose={onClose} title={
    <Text fw={700} size="xl" >
      Confirmar baja de jugador
    </Text>
    } centered>
      <DeactivateJugadorContent
        onClose={onClose}
        onConfirm={onConfirm}
        nombreCompleto={nombreCompleto}
        loading={loading}
        error={error}
      />
    </Modal>
  )
}

export default DeactivateJugadorModal
