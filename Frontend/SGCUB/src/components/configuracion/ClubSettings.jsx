import { Field, INPUT_CLASS, SaveBar, SettingsCard } from './settingsParts'
import { useSettingsForm } from './settingsForm'

const FIELDS = [
  { field: 'club_nombre', label: 'Nombre del club', props: { maxLength: 120, required: true } },
  { field: 'club_cuit', label: 'CUIT', props: { maxLength: 13, placeholder: '30-12345678-9', inputMode: 'numeric' } },
  { field: 'club_direccion', label: 'Dirección', props: { maxLength: 200 } },
  { field: 'club_telefono', label: 'Teléfono', props: { maxLength: 30, inputMode: 'tel' } },
  { field: 'club_email', label: 'Email', props: { maxLength: 254, type: 'email' } },
]

export default function ClubSettings({ config }) {
  const { form, setField, changes, errors, status, save, reset } = useSettingsForm(
    config.general,
    FIELDS.map(({ field }) => field),
    config.saveGeneral,
  )

  return (
    <SettingsCard
      icon="apartment"
      title="Datos del club"
      description="Aparecen en los comprobantes, en los reportes en PDF y en el encabezado de los emails."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {FIELDS.map(({ field, label, props }) => (
          <Field key={field} label={label} htmlFor={field} error={errors[field]}>
            <input id={field} className={INPUT_CLASS} value={form[field] ?? ''} onChange={(event) => setField(field, event.target.value)} {...props} />
          </Field>
        ))}
      </div>
      <SaveBar changes={changes} status={status} onSave={save} onReset={reset} />
    </SettingsCard>
  )
}
