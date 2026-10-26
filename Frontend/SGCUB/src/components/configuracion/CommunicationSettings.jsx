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
