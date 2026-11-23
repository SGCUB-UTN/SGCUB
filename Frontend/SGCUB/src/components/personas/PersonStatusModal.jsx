import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import ProfileScopeOptions from './ProfileScopeOptions'

const ACTIONS = {
  baja: { noun: 'baja', confirmLabel: 'Dar de baja', color: 'red' },
  alta: { noun: 'alta', confirmLabel: 'Dar de alta', color: 'teal' },
}

function Consequences({ items }) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-col gap-2 mt-4 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 text-sm text-on-surface">
          <span className="material-symbols-outlined text-outline shrink-0" style={{ fontSize: 18 }} aria-hidden="true">info</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function PersonStatusContent({ action, personName, options, consequences, confirmLabel, onClose, onConfirm, validate, children, loading, error }) {
  const config = ACTIONS[action]
  const [selected, setSelected] = useState(null)
  const [validationError, setValidationError] = useState('')
  const selectedOption = options?.find((option) => option.value === selected)
  const visibleConsequences = [...(selectedOption?.consequences ?? []), ...consequences].filter(Boolean)

  const handleConfirm = () => {
    const message = validate?.() ?? ''
    setValidationError(message)
    if (!message) onConfirm(selected)
  }

  return (
    <>
      <Text size="md">
        {options
          ? <>Elegí el tipo de {config.noun} para <strong>{personName}</strong>.</>
          : <>¿Confirmás {action === 'baja' ? 'la baja' : 'el alta'} de <strong>{personName}</strong>?</>}
      </Text>
      {options && (
        <ProfileScopeOptions
          name={`tipo-${action}`}
          label={`Tipo de ${config.noun}`}
          options={options}
          value={selected}
          disabled={loading}
          onChange={setSelected}
        />
      )}
      {children}
      <Consequences items={visibleConsequences} />
      {(validationError || error) && (
        <Text color="red" size="base" mt="md" role="alert">
          {validationError || error}
        </Text>
      )}
      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button color={config.color} onClick={handleConfirm} loading={loading} disabled={Boolean(options) && !selected}>
          {confirmLabel ?? config.confirmLabel}
        </Button>
      </Group>
    </>
  )
}

export default function PersonStatusModal({
  opened,
  action,
  title,
  personName,
  options,
  consequences = [],
  confirmLabel,
  validate,
  size = 'md',
  onClose,
  onConfirm,
  loading = false,
  error = '',
  children,
}) {
  return (
    <Modal
      opened={opened}
      onClose={() => !loading && onClose()}
      size={size}
      centered
      title={<Text fw={700} size="xl">{title}</Text>}
    >
      <PersonStatusContent
        action={action}
        personName={personName || 'esta persona'}
        options={options}
        consequences={consequences}
        confirmLabel={confirmLabel}
        validate={validate}
        onClose={onClose}
        onConfirm={onConfirm}
        loading={loading}
        error={error}
      >
        {children}
      </PersonStatusContent>
    </Modal>
  )
}
