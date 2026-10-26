import { Field, INPUT_CLASS, SettingsCard } from './settingsParts'

const FIELDS = [
  { field: 'club_nombre', label: 'Nombre del club', props: { maxLength: 120, required: true } },
  { field: 'club_cuit', label: 'CUIT', props: { maxLength: 13, placeholder: '30-12345678-9', inputMode: 'numeric' } },
  { field: 'club_telefono', label: 'Teléfono', props: { maxLength: 30, inputMode: 'tel' } },
  { field: 'club_email', label: 'Email', props: { maxLength: 254, type: 'email' } },
]

export default function ClubSettings({ config }) {
  const form = config.draft.general
  const errors = config.errors.general

  return (
    <SettingsCard
      icon="apartment"
      title="Datos del club"
      description="Aparecen en los comprobantes, en los reportes en PDF y en el encabezado de los emails."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {FIELDS.map(({ field, label, props }) => (
          <Field key={field} label={label} htmlFor={field} error={errors[field]}>
            <input id={field} className={INPUT_CLASS} value={form[field] ?? ''} onChange={(event) => config.setGeneralField(field, event.target.value)} {...props} />
          </Field>
        ))}
      </div>
    </SettingsCard>
  )
}
