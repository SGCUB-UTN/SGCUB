import { IntegerInput } from './formattedInputs'
import { compactInputClass } from './settingsForm'
import { CompactField, SettingsSection } from './settingsParts'

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
    description: 'Envía una salutación institucional por correo a los socios en el día de su cumpleaños.',
    withBirthdayMessage: true,
  },
]

function NotificationOption({ option, form, errors, setField }) {
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
        <div className="pl-7 pt-1 flex flex-col gap-1.5">
          <CompactField
            id="mensaje_cumpleanos"
            label="Mensaje de felicitación"
            error={errors.mensaje_cumpleanos}
          >
            <textarea
              id="mensaje_cumpleanos"
              rows={6}
              maxLength={1500}
              className="w-full rounded-lg border border-outline-variant/40 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface focus:border-primary focus:outline-none transition-colors resize-y disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Escribí el mensaje de cumpleaños..."
              value={form.mensaje_cumpleanos ?? ''}
              onChange={(event) => setField('mensaje_cumpleanos', event.target.value)}
              disabled={!checked}
            />
          </CompactField>
          <p className="text-[11px] text-on-surface-variant/80">
            Podés usar <code className="bg-surface-container-low px-1 py-0.5 rounded text-primary">{'{nombre}'}</code> para el nombre del socio y <code className="bg-surface-container-low px-1 py-0.5 rounded text-primary">{'{club}'}</code> para el nombre del club.
          </p>
        </div>
      )}
    </li>
  )
}

export default function CommunicationSettings({ config }) {
  const form = config.draft.general
  const errors = config.errors.general
  const setField = config.setGeneralField

  return (
    <div className="flex flex-col">
      <SettingsSection
        icon="notifications_active"
        title="Notificaciones automáticas"
      >
        <ul className="-my-2.5 divide-y divide-outline-variant/20">
          {NOTIFICATIONS.map((option) => (
            <NotificationOption key={option.field} option={option} form={form} errors={errors} setField={setField} />
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
    </div>
  )
}
