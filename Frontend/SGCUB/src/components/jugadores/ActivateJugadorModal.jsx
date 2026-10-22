import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import ProfileScopeOptions from './ProfileScopeOptions'

const ACTIVATION_TYPES = [
  {
    value: 'completa',
    label: 'Alta completa',
    description: 'Da de alta al socio y al jugador. Abona la cuota social y la deportiva.',
  },
  {
    value: 'parcial',
    label: 'Alta parcial',
    description: 'Da de alta solo al socio. Abona la cuota social y queda como ex jugador.',
  },
]

function ActivateJugadorContent({ onClose, onConfirm, nombreCompleto, requiresChoice, loading, error }) {
  const [tipoAlta, setTipoAlta] = useState(null)

  return (
    <>
      {requiresChoice ? (
        <>
          <Text size="md">
            ¿Qué tipo de alta desea realizar para el jugador <strong>{nombreCompleto}</strong>?
          </Text>
          <ProfileScopeOptions
            name="tipo-alta"
            label="Tipo de alta"
            options={ACTIVATION_TYPES}
            value={tipoAlta}
            disabled={loading}
            onChange={setTipoAlta}
          />
        </>
      ) : (
        <Text size="md">
          ¿Seguro que desea dar de alta al jugador <strong>{nombreCompleto}</strong>?
        </Text>
      )}
      {error && (
        <Text color="red" size="base" mt="md">
          {error}
        </Text>
      )}
      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          color="teal"
          onClick={() => onConfirm(!requiresChoice || tipoAlta === 'completa')}
          loading={loading}
          disabled={requiresChoice && !tipoAlta}
        >
          Dar de alta
        </Button>
      </Group>
    </>
  )
}

function ActivateJugadorModal({ opened, onClose, onConfirm, jugador, loading, error }) {
  const nombreCompleto = jugador?.socio
    ? `${jugador.socio.nombre} ${jugador.socio.apellido}`.trim()
    : 'este jugador'

  return (
    <Modal opened={opened} onClose={onClose} title={
    <Text fw={700} size="xl" >
      Confirmar alta de jugador
    </Text>
    } centered>
      <ActivateJugadorContent
        onClose={onClose}
        onConfirm={onConfirm}
        nombreCompleto={nombreCompleto}
        requiresChoice={jugador?.tipo_baja === 'completa'}
        loading={loading}
        error={error}
      />
    </Modal>
  )
}

export default ActivateJugadorModal
