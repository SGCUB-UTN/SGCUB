import { useMemo } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import { formatCount, memberName } from './cuotaPeriod'

const plural = (count, singular, pluralForm) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`

const hasEmail = (recipient) => recipient.email.includes('@')

function uniqueRecipients(rows) {
  const recipients = new Map()
  rows.forEach((row) => {
    if (!recipients.has(row.socio_id)) {
      recipients.set(row.socio_id, { socioId: row.socio_id, name: memberName(row), email: (row.email ?? '').trim() })
    }
  })
  return [...recipients.values()].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

function RecipientList({ recipients, showEmail }) {
  return (
    <ul className="max-h-48 overflow-y-auto divide-y divide-outline-variant/20 rounded border border-outline-variant/30">
      {recipients.map((recipient) => (
        <li key={recipient.socioId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="font-medium text-on-surface truncate">{recipient.name}</span>
          {showEmail && <span className="text-on-surface-variant truncate">{recipient.email}</span>}
        </li>
      ))}
    </ul>
  )
}

function NotifyCuotasModal({ opened, rows, onClose }) {
  const recipients = useMemo(() => uniqueRecipients(rows), [rows])
  const reachable = recipients.filter(hasEmail)
  const excluded = recipients.filter((recipient) => !hasEmail(recipient))

  return (
    <Modal opened={opened} onClose={onClose} title="Notificar por email" size="lg" centered>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }} aria-hidden="true">mail</span>
            {plural(reachable.length, 'destinatario', 'destinatarios')}
          </p>
          {reachable.length > 0
            ? <RecipientList recipients={reachable} showEmail />
            : <Text size="sm" c="dimmed">Ninguno de los seleccionados tiene email cargado.</Text>}
        </div>

        {excluded.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">warning</span>
              {`${plural(excluded.length, 'socio', 'socios')} sin email: no ${excluded.length === 1 ? 'recibirá' : 'recibirán'} la notificación`}
            </p>
            <RecipientList recipients={excluded} />
          </div>
        )}
      </div>

      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose}>
          Cancelar
        </Button>
      </Group>
    </Modal>
  )
}

export default NotifyCuotasModal
