import { useEffect, useMemo, useRef, useState } from 'react'
import { formatPhoneInput, isPhoneTooLong, phoneDigits } from '../personas/format'
import useBarrios from '../../hooks/useBarrios'
import useLocalidades from '../../hooks/useLocalidades'
import { CuitInput } from './formattedInputs'
import { SMALL_BUTTON_CLASSES, compactInputClass } from './settingsForm'
import { CompactField, CompactSelect, SettingsSection } from './settingsParts'

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
const MAX_LOGO_SIZE = 2 * 1024 * 1024

const ADDRESS_TEXT_FIELDS = [
  { field: 'domicilio_calle', label: 'Calle', placeholder: 'Ej: Calle 8', className: 'sm:col-span-2' },
  { field: 'domicilio_numero', label: 'Número', placeholder: 'Ej: 4100' },
  { field: 'domicilio_entre_calle_1', label: 'Entre calle', hint: '(opcional)', className: 'sm:col-span-2' },
  { field: 'domicilio_entre_calle_2', label: 'Y calle', hint: '(opcional)', className: 'sm:col-span-2' },
]

// Preview URL of a file chosen but not uploaded yet
function useObjectUrl(file) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url)
  }, [url])
  return url
}

function LogoField({ config }) {
  const inputRef = useRef(null)
  const [localError, setLocalError] = useState('')
  const pendingUrl = useObjectUrl(config.draft.logo)
  const previewUrl = pendingUrl ?? (config.draft.removeLogo ? null : config.general.club_logo)
  const error = localError || config.errors.general.club_logo

  const choose = (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) {
      setLocalError('El logo tiene que ser una imagen PNG, JPG, WEBP o SVG.')
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      setLocalError('El logo no puede pesar más de 2 MB.')
      return
    }
    setLocalError('')
    config.setLogo(file)
  }

  return (
    <CompactField id="club_logo" label="Logo del club" error={error}>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-outline-variant bg-surface-container-low/60">
          {previewUrl
            ? <img src={previewUrl} alt="Logo del club" className="h-full w-full object-contain p-1" />
            : <span className="material-symbols-outlined text-[28px] text-outline" aria-hidden="true">image</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={SMALL_BUTTON_CLASSES.secondary} onClick={() => inputRef.current?.click()}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">upload</span>
              {previewUrl ? 'Cambiar logo' : 'Subir logo'}
            </button>
            {previewUrl && (
              <button type="button" className={SMALL_BUTTON_CLASSES.secondary} onClick={() => { setLocalError(''); config.removeLogo() }}>
                Quitar
              </button>
            )}
          </div>
          <p className="text-[11px] text-outline">PNG, JPG, WEBP o SVG, hasta 2 MB.</p>
        </div>
        <input id="club_logo" ref={inputRef} type="file" accept={LOGO_TYPES.join(',')} className="hidden" onChange={choose} />
      </div>
    </CompactField>
  )
}

function AddressSection({ config }) {
  const { localidades } = useLocalidades()
  const form = config.draft.general
  const errors = config.errors.general
  const setField = config.setGeneralField
  const localidadId = form.domicilio_localidad ? String(form.domicilio_localidad) : ''
  const { barrios } = useBarrios(localidadId)

  const changeLocality = (value) => {
    setField('domicilio_localidad', value)
    setField('domicilio_barrio', '')
    // The name is kept only to show the new address in the changes summary
    setField('domicilio_localidad_nombre', localidades.find((item) => String(item.localidad_id) === value)?.nombre ?? '')
  }

  return (
    <SettingsSection icon="home_pin" title="Domicilio" description="Calle, número y localidad son obligatorios si se carga el domicilio.">
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-4">
        {ADDRESS_TEXT_FIELDS.map(({ field, label, hint, placeholder, className }) => (
          <CompactField key={field} id={field} label={label} hint={hint} error={errors[field]} className={className}>
            <input
              id={field}
              className={compactInputClass(Boolean(errors[field]))}
              placeholder={placeholder}
              maxLength={field.startsWith('domicilio_entre') || field === 'domicilio_calle' ? 100 : 20}
              value={form[field] ?? ''}
              onChange={(event) => setField(field, event.target.value)}
            />
          </CompactField>
        ))}
        <CompactField id="domicilio_localidad" label="Localidad" error={errors.domicilio_localidad} className="sm:col-span-2">
          <CompactSelect id="domicilio_localidad" value={localidadId} onChange={(event) => changeLocality(event.target.value)} invalid={Boolean(errors.domicilio_localidad)}>
            <option value="">Seleccioná la localidad...</option>
            {localidades.map((item) => <option key={item.localidad_id} value={item.localidad_id}>{item.nombre}</option>)}
          </CompactSelect>
        </CompactField>
        <CompactField id="domicilio_barrio" label="Barrio" hint="(opcional)" error={errors.domicilio_barrio} className="sm:col-span-2">
          <CompactSelect
            id="domicilio_barrio"
            value={form.domicilio_barrio ?? ''}
            onChange={(event) => setField('domicilio_barrio', event.target.value)}
            disabled={!localidadId}
            invalid={Boolean(errors.domicilio_barrio)}
          >
            <option value="">{localidadId ? 'Sin especificar' : 'Elegí primero la localidad'}</option>
            {barrios.map((item) => <option key={item.barrio_id} value={item.barrio_id}>{item.nombre}</option>)}
          </CompactSelect>
        </CompactField>
      </div>
    </SettingsSection>
  )
}

export default function ClubSettings({ config }) {
  const form = config.draft.general
  const errors = config.errors.general
  const setField = config.setGeneralField

  const changePhone = (event) => {
    if (isPhoneTooLong(event.target.value)) return
    setField('club_telefono', phoneDigits(event.target.value))
  }

  return (
    <div className="flex flex-col">
      <SettingsSection
        icon="apartment"
        title="Identificación"
        description="Aparece en los comprobantes, los reportes en PDF y el encabezado de los mails."
      >
        <div className="flex flex-wrap items-start gap-6">
          <CompactField id="club_nombre" label="Nombre del club" error={errors.club_nombre} className="w-full sm:w-80">
            <input
              id="club_nombre"
              className={compactInputClass(Boolean(errors.club_nombre))}
              maxLength={120}
              value={form.club_nombre}
              onChange={(event) => setField('club_nombre', event.target.value)}
            />
          </CompactField>
          <CompactField id="club_cuit" label="CUIT" error={errors.club_cuit} className="w-44">
            <CuitInput id="club_cuit" value={form.club_cuit} onChange={(value) => setField('club_cuit', value)} invalid={Boolean(errors.club_cuit)} />
          </CompactField>
        </div>
        <LogoField config={config} />
      </SettingsSection>

      <AddressSection config={config} />

      <SettingsSection icon="contact_mail" title="Contacto">
        <div className="flex flex-wrap items-start gap-6">
          <CompactField id="club_email" label="Mail" error={errors.club_email} className="w-full sm:w-80">
            <input
              id="club_email"
              type="email"
              className={compactInputClass(Boolean(errors.club_email))}
              maxLength={254}
              placeholder="contacto@club.com.ar"
              value={form.club_email}
              onChange={(event) => setField('club_email', event.target.value)}
            />
          </CompactField>
          <CompactField id="club_telefono" label="Teléfono" error={errors.club_telefono} className="w-52">
            <input
              id="club_telefono"
              type="tel"
              className={compactInputClass(Boolean(errors.club_telefono))}
              placeholder="Ej: 221 456-7890"
              value={formatPhoneInput(form.club_telefono ?? '')}
              onChange={changePhone}
            />
          </CompactField>
        </div>
      </SettingsSection>
    </div>
  )
}
