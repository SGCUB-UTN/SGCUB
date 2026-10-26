import { Field, INPUT_CLASS, Notice, SettingsCard, SwitchRow } from './settingsParts'

const NOTIFICATIONS = [
  {
    field: 'notificar_generacion_cuota',
    label: 'Al generar la cuota',
    description: 'Avisa al socio que tiene disponible la cuota del mes.',
  },
  {
    field: 'notificar_recordatorio_vencimiento',
    label: 'Recordatorio antes del vencimiento',
    description: 'Recuerda que la cuota está por vencer, con la anticipación indicada abajo.',
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
    description: 'Envía por email el comprobante cada vez que se registra un pago.',
  },
]

export default function CommunicationSettings({ config }) {
  const form = config.draft.general
  const errors = config.errors.general
  const setField = config.setGeneralField

  return (
    <div className="flex flex-col gap-5">
      <SettingsCard icon="notifications_active" title="Notificaciones automáticas" description="Elegí qué avisos recibe el socio por email.">
        <Notice tone="info">
          Por ahora se guarda la preferencia: el envío automático de estos avisos se va a habilitar en una próxima versión.
        </Notice>
        <div className="flex flex-col gap-2">
          {NOTIFICATIONS.map(({ field, label, description }) => (
            <SwitchRow key={field} label={label} description={description} checked={Boolean(form[field])} onChange={(value) => setField(field, value)} />
          ))}
        </div>
        <div className="max-w-sm">
          <Field
            label="Días de anticipación del recordatorio"
            htmlFor="dias_recordatorio_vencimiento"
            error={errors.dias_recordatorio_vencimiento}
            hint="Cuántos días antes del primer vencimiento se envía el recordatorio."
          >
            <input
              id="dias_recordatorio_vencimiento"
              type="number"
              min="1"
              max="30"
              step="1"
              className={INPUT_CLASS}
              value={form.dias_recordatorio_vencimiento}
              onChange={(event) => setField('dias_recordatorio_vencimiento', event.target.value)}
              disabled={!form.notificar_recordatorio_vencimiento}
            />
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard icon="mail" title="Emails" description="Se usan en todos los emails que envía el sistema, incluidos los comunicados.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Nombre del remitente" htmlFor="email_nombre_remitente" error={errors.email_nombre_remitente} hint="Es el nombre que ve el socio como remitente.">
            <input id="email_nombre_remitente" className={INPUT_CLASS} maxLength={80} value={form.email_nombre_remitente} onChange={(event) => setField('email_nombre_remitente', event.target.value)} />
          </Field>
          <Field label="Firma" htmlFor="email_firma" error={errors.email_firma} hint="Se agrega al final de cada email.">
            <textarea
              id="email_firma"
              rows={3}
              maxLength={500}
              className={`${INPUT_CLASS} h-auto py-2`}
              value={form.email_firma}
              onChange={(event) => setField('email_firma', event.target.value)}
            />
          </Field>
        </div>
      </SettingsCard>
    </div>
  )
}
