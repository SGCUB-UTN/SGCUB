import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'

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

function DeactivationTypeOption({ option, selected, disabled, onSelect }) {
  return (
    <label className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'}`}>
      <input
        type="radio"
        name="tipo-baja"
        value={option.value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(option.value)}
        className="h-4 w-4 accent-primary shrink-0"
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-base font-semibold text-on-surface">{option.label}</span>
        <span className="text-sm text-on-surface-variant">{option.description}</span>
      </div>
    </label>
  )
}

function DeactivateJugadorContent({ onClose, onConfirm, nombreCompleto, loading, error }) {
  const [tipoBaja, setTipoBaja] = useState(null)

  return (
    <>
      <Text size="md">
        ¿Qué tipo de baja desea realizar para el jugador <strong>{nombreCompleto}</strong>?
      </Text>
      <fieldset className="flex flex-col gap-2 mt-4" aria-label="Tipo de baja">
        {DEACTIVATION_TYPES.map((option) => (
          <DeactivationTypeOption
            key={option.value}
            option={option}
            selected={tipoBaja === option.value}
            disabled={loading}
            onSelect={setTipoBaja}
          />
        ))}
      </fieldset>
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
