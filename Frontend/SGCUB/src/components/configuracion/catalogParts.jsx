import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import { getErrorMessage } from '../personas/format'
import { Notice } from './settingsParts'

export function InUseBadge({ inUse }) {
  if (!inUse) return <span className="text-xs text-on-surface-variant font-normal">—</span>
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
      <span className="material-symbols-outlined text-[14px] text-slate-500" aria-hidden="true">check</span>
      En uso
    </span>
  )
}

export function ConfirmDeleteModal({ opened, onClose, onConfirm, title, message }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleConfirm = async () => {
    setDeleting(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err, 'No se pudo eliminar el elemento.'))
      setDeleting(false)
    }
  }

  return (
    <Modal opened={opened} onClose={() => !deleting && onClose()} centered title={<Text fw={700} size="xl">{title}</Text>}>
      <p className="text-base text-on-surface-variant mb-4">{message}</p>
      {error && <div className="mb-4"><Notice tone="error">{error}</Notice></div>}
      <Group position="right">
        <Button variant="default" onClick={onClose} disabled={deleting}>Cancelar</Button>
        <Button color="red" onClick={handleConfirm} loading={deleting}>Eliminar</Button>
      </Group>
    </Modal>
  )
}

export function SubTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-outline-variant/30 pb-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
            active === tab.id
              ? 'bg-primary text-on-primary shadow-xs'
              : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}
