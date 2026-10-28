import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Group, Modal, Text, TextInput, Textarea } from '@mantine/core'
import { postEnviarNotificacion } from '../../api/comunicaciones'
import { getErrorMessage } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { formatCount, memberName } from './cuotaPeriod'

const SUBJECT_MAX_LENGTH = 150
const MESSAGE_MAX_LENGTH = 500

const plural = (count, singular, pluralForm) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`

const hasEmail = (recipient) => recipient.email.includes('@')

const defaultSubject = (period) => `Cuota de ${formatPeriod(period)}`

const defaultMessage = (period) => [
  'Hola,',
  '',
  `Te escribimos para recordarte la cuota de ${formatPeriod(period)}. Si ya la abonaste, por favor desestimá este mensaje.`,
  '',
  'Saludos,',
  'Tesorería del club',
].join('\n')

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
    <ul className="max-h-48 overflow-y-auto divide-y divide-outline-variant/20">
      {recipients.map((recipient) => (
        <li key={recipient.socioId} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="font-medium text-on-surface truncate">{recipient.name}</span>
          {showEmail && <span className="text-on-surface-variant truncate">{recipient.email}</span>}
        </li>
      ))}
    </ul>
  )
}

function RecipientSection({ id, icon, iconClass = '', title, toneClass, recipients, showEmail }) {
  const [expanded, setExpanded] = useState(false)
  const listId = `${id}-list`
  return (
    <div className="rounded border border-outline-variant/30">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        aria-controls={listId}
        className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold rounded cursor-pointer hover:bg-surface-container-low transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${toneClass}`}
      >
        <span className={`material-symbols-outlined shrink-0 ${iconClass}`} style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>
        <span className="flex-1">{title}</span>
        <span className={`material-symbols-outlined text-outline transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 20 }} aria-hidden="true">expand_more</span>
      </button>
      {expanded && (
        <div id={listId} className="border-t border-outline-variant/30">
          <RecipientList recipients={recipients} showEmail={showEmail} />
        </div>
      )}
    </div>
  )
}

function validate(subject, message) {
  const errors = {}
  if (!subject.trim()) errors.subject = 'Ingresá el asunto.'
  else if (subject.length > SUBJECT_MAX_LENGTH) errors.subject = `El asunto no puede superar los ${SUBJECT_MAX_LENGTH} caracteres.`
  if (!message.trim()) errors.message = 'Ingresá el mensaje.'
  else if (message.length > MESSAGE_MAX_LENGTH) errors.message = `El mensaje no puede superar los ${MESSAGE_MAX_LENGTH} caracteres.`
  return errors
}

function SentResult({ count, onClose }) {
  return (
    <>
      <p className="flex items-start gap-2 text-sm text-on-surface">
        <span className="material-symbols-outlined text-emerald-600 shrink-0" style={{ fontSize: 20 }} aria-hidden="true">check_circle</span>
        <span>
          Se envió la notificación a <strong>{plural(count, 'socio', 'socios')}</strong>.
          Podés seguir el estado de cada envío en el{' '}
          <Link to="/comunicaciones/historial" className="font-semibold text-primary hover:underline">historial de comunicaciones</Link>.
        </span>
      </p>
      <Group position="right" mt="xl">
        <Button onClick={onClose}>Cerrar</Button>
      </Group>
    </>
  )
}

function NotifyCuotasModal({ opened, rows, period, onClose, onSent }) {
  const recipients = useMemo(() => uniqueRecipients(rows), [rows])
  const reachable = recipients.filter(hasEmail)
  const excluded = recipients.filter((recipient) => !hasEmail(recipient))
  const [subject, setSubject] = useState(() => defaultSubject(period))
  const [message, setMessage] = useState(() => defaultMessage(period))
  const [errors, setErrors] = useState({})
  const [sending, setSending] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [sentCount, setSentCount] = useState(null)

  const close = () => !sending && onClose()

  const send = async (event) => {
    event.preventDefault()
    const nextErrors = validate(subject, message)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSending(true)
    setRequestError('')
    try {
      await postEnviarNotificacion({
        titulo: subject.trim(),
        asunto: subject.trim(),
        contenido: message.trim(),
        envios: reachable.map((recipient) => ({ socio: recipient.socioId, canal: 'MAIL', estado: 'ENVIADA' })),
      })
      setSentCount(reachable.length)
      onSent()
    } catch (error) {
      setRequestError(getErrorMessage(error, 'No se pudo enviar la notificación.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Notificar por email" size="lg" centered>
      {sentCount != null ? (
        <SentResult count={sentCount} onClose={onClose} />
      ) : (
        <form onSubmit={send} noValidate>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {reachable.length > 0 ? (
                <RecipientSection
                  id="notify-recipients"
                  icon="mail"
                  title={plural(reachable.length, 'destinatario', 'destinatarios')}
                  iconClass="text-primary"
                  toneClass="text-on-surface"
                  recipients={reachable}
                  showEmail
                />
              ) : (
                <Text size="sm" c="dimmed">Ninguno de los seleccionados tiene email cargado.</Text>
              )}
              {excluded.length > 0 && (
                <RecipientSection
                  id="notify-excluded"
                  icon="warning"
                  title={`${plural(excluded.length, 'socio', 'socios')} sin email: no ${excluded.length === 1 ? 'recibirá' : 'recibirán'} la notificación`}
                  toneClass="text-amber-800"
                  recipients={excluded}
                />
              )}
            </div>

            <TextInput
              label="Asunto"
              required
              value={subject}
              onChange={(event) => setSubject(event.currentTarget.value)}
              error={errors.subject}
              maxLength={SUBJECT_MAX_LENGTH}
              disabled={sending}
            />
            <Textarea
              label="Mensaje"
              required
              autosize
              minRows={6}
              value={message}
              onChange={(event) => setMessage(event.currentTarget.value)}
              error={errors.message}
              maxLength={MESSAGE_MAX_LENGTH}
              description={`${formatCount(message.length)} / ${formatCount(MESSAGE_MAX_LENGTH)} caracteres`}
              disabled={sending}
            />

            {requestError && <Text c="red" size="sm" role="alert">{requestError}</Text>}
          </div>

          <Group position="right" mt="xl">
            <Button variant="default" onClick={close} disabled={sending}>
              Cancelar
            </Button>
            <Button type="submit" loading={sending} disabled={reachable.length === 0}>
              {`Enviar a ${plural(reachable.length, 'socio', 'socios')}`}
            </Button>
          </Group>
        </form>
      )}
    </Modal>
  )
}

export default NotifyCuotasModal
