import { useState, useEffect } from 'react'
import { Modal, Text } from '@mantine/core'
import { IntegerInput } from './formattedInputs'
import { BUTTON_CLASSES, SMALL_BUTTON_CLASSES, compactInputClass } from './settingsForm'
import { CompactField, SettingsSection } from './settingsParts'

const MENSAJE_CUMPLEANOS_DEFAULT = `¡Hola {nombre}!

Desde el {club} te enviamos nuestros saludos en este día tan especial. Esperamos que disfrutes de un muy feliz cumpleaños rodeado de tus seres queridos.

¡Muchas gracias por ser parte de nuestra familia!

Comisión Directiva`

const NOTIFICATIONS = [
  {
    field: 'notificar_generacion_cuota',
    label: 'Al generar la cuota',
    description: 'Avisa al socio que tiene disponible la cuota del mes.',
  },
  {
    field: 'notificar_recordatorio_vencimiento',
    label: 'Recordatorio antes del vencimiento',
    description: 'Recuerda que la cuota está por vencer, con la anticipación indicada.',
    withReminderDays: true,
  },
  {
    field: 'notificar_cuota_vencida',
    label: 'Al cumplirse un vencimiento',
    description: 'Avisa que la cuota venció y que se aplicó el recargo correspondiente.',
  },
  {
    field: 'notificar_modificacion_cuota',
    label: 'Modificaciones en la cuota',
    description: 'Avisa cuando cambia el monto o las fechas de una cuota (becas, descuentos, nueva configuración).',
  },
  {
    field: 'notificar_comprobante_pago',
    label: 'Enviar comprobantes de pago',
    description: 'Envía por mail el comprobante cada vez que se registra un pago.',
  },
  {
    field: 'notificar_cumpleanos',
    label: 'Saludos de cumpleaños',
    description: 'Envía un mensaje institucional por correo a los socios en el día de su cumpleaños.',
    withBirthdayMessage: true,
  },
]

function BirthdayMessageModal({ opened, initialValue, onClose, onSave, error }) {
  const [value, setValue] = useState(initialValue ?? '')

  useEffect(() => {
    if (opened) {
      setValue(initialValue ?? '')
    }
  }, [opened, initialValue])

  const handleSave = () => {
    onSave(value)
    onClose()
  }

  const handleReset = () => {
    setValue(MENSAJE_CUMPLEANOS_DEFAULT)
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      centered
      size="lg"
      title={<Text fw={700} size="xl">Mensaje de cumpleaños</Text>}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-on-surface-variant">
          Personalizá el mensaje que se enviará automáticamente a los socios en su cumpleaños.
        </p>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="modal-mensaje-cumpleanos" className="text-xs font-semibold text-on-surface">
            Cuerpo del mensaje
          </label>
          <textarea
            id="modal-mensaje-cumpleanos"
            rows={8}
            maxLength={1500}
            className="w-full rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none transition-colors resize-y"
            placeholder="Escribí el mensaje de cumpleaños..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          {error && <p className="text-xs font-medium text-error" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-on-surface-variant/80">
            <span>
              Podés usar <code className="bg-surface-container-low px-1 py-0.5 rounded text-primary font-mono">{'{nombre}'}</code> para el nombre del socio y <code className="bg-surface-container-low px-1 py-0.5 rounded text-primary font-mono">{'{club}'}</code> para el club.
            </span>
            <span className="font-mono">{value.length}/1500</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-outline-variant/30 pt-4">
          <button
            type="button"
            className={SMALL_BUTTON_CLASSES.link}
            onClick={handleReset}
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">restart_alt</span>
            Restablecer plantilla original
          </button>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              className={BUTTON_CLASSES.secondary}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={BUTTON_CLASSES.primary}
              onClick={handleSave}
            >
              Aplicar cambios
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function NotificationOption({ option, form, errors, setField, onOpenBirthdayModal }) {
  const id = `notificacion-${option.field}`
  const checked = Boolean(form[option.field])
  return (
    <li className="flex flex-col gap-2 py-2.5">
      {/* The checkbox is centered on the title and its description */}
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
          checked={checked}
          onChange={(event) => setField(option.field, event.target.checked)}
          aria-describedby={`${id}-descripcion`}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <label htmlFor={id} className="text-sm font-medium text-on-surface cursor-pointer">{option.label}</label>
          <p id={`${id}-descripcion`} className="text-xs text-on-surface-variant">{option.description}</p>
        </div>
      </div>
      {option.withReminderDays && (
        <div className="pl-7">
          <CompactField id="dias_recordatorio_vencimiento" label="Días de anticipación" error={errors.dias_recordatorio_vencimiento}>
            <div className="w-20">
              <IntegerInput
                id="dias_recordatorio_vencimiento"
                unit="días"
                maxLength={2}
                value={form.dias_recordatorio_vencimiento}
                onChange={(value) => setField('dias_recordatorio_vencimiento', value)}
                disabled={!checked}
                invalid={Boolean(errors.dias_recordatorio_vencimiento)}
              />
            </div>
          </CompactField>
        </div>
      )}
      {option.withBirthdayMessage && (
        <div className="pl-7">
            <div>
              <button
                id="mensaje_cumpleanos_btn"
                type="button"
                className={SMALL_BUTTON_CLASSES.secondary}
                onClick={onOpenBirthdayModal}
                disabled={!checked}
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit_note</span>
                Personalizar
              </button>
            </div>
        </div>
      )}
    </li>
  )
}

export default function CommunicationSettings({ config }) {
  const form = config.draft.general
  const errors = config.errors.general
  const setField = config.setGeneralField
  const [birthdayModalOpen, setBirthdayModalOpen] = useState(false)

  return (
    <div className="flex flex-col">
      <SettingsSection
        icon="notifications_active"
        title="Notificaciones automáticas"
      >
        <ul className="-my-2.5 divide-y divide-outline-variant/20">
          {NOTIFICATIONS.map((option) => (
            <NotificationOption
              key={option.field}
              option={option}
              form={form}
              errors={errors}
              setField={setField}
              onOpenBirthdayModal={() => setBirthdayModalOpen(true)}
            />
          ))}
        </ul>
      </SettingsSection>

      <SettingsSection
        icon="mail"
        title="Servicio de mail"
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <CompactField id="email_nombre_remitente" label="Nombre del remitente" error={errors.email_nombre_remitente}>
            <input
              id="email_nombre_remitente"
              className={compactInputClass(Boolean(errors.email_nombre_remitente))}
              maxLength={80}
              value={form.email_nombre_remitente}
              onChange={(event) => setField('email_nombre_remitente', event.target.value)}
            />
          </CompactField>
          <CompactField id="email_firma" label="Firma" error={errors.email_firma}>
            <input
              id="email_firma"
              className={compactInputClass(Boolean(errors.email_firma))}
              maxLength={500}
              value={form.email_firma}
              onChange={(event) => setField('email_firma', event.target.value)}
            />
          </CompactField>
        </div>
      </SettingsSection>

      <BirthdayMessageModal
        opened={birthdayModalOpen}
        initialValue={form.mensaje_cumpleanos}
        error={errors.mensaje_cumpleanos}
        onClose={() => setBirthdayModalOpen(false)}
        onSave={(newValue) => setField('mensaje_cumpleanos', newValue)}
      />
    </div>
  )
}
