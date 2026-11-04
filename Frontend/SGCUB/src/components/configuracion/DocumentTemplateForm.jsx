import { useEffect, useState } from 'react'
import { getPlantillaDocumento, updatePlantillaDocumento } from '../../api/documentacion'
import { getErrorMessage } from '../personas/format'
import A4TemplatePreview from './A4TemplatePreview'
import MarkdownEditor from './MarkdownEditor'
import { BUTTON_CLASSES, changedFields, fieldErrors } from './settingsForm'
import { BlockTitle, Field, INPUT_CLASS, Notice } from './settingsParts'

const FIELDS = ['titulo', 'cuerpo', 'talon_leyenda', 'firma_jugador_menor', 'mostrar_categoria']

function CheckboxField({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-descripcion`}
      />
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={id} className="text-sm font-semibold text-on-surface cursor-pointer">{label}</label>
        <p id={`${id}-descripcion`} className="text-sm text-on-surface-variant">{description}</p>
      </div>
    </div>
  )
}

export default function DocumentTemplateForm({ tipo, logoUrl, clubName, onClose }) {
  const [saved, setSaved] = useState(null)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let active = true
    getPlantillaDocumento(tipo.id_tipo_documento)
      .then((plantilla) => {
        if (!active) return
        setSaved(plantilla)
        setForm(plantilla)
      })
      .catch((requestError) => {
        if (active) setLoadError(getErrorMessage(requestError, 'No se pudo cargar la plantilla.'))
      })
    return () => { active = false }
  }, [tipo.id_tipo_documento])

  if (loadError) return <Notice tone="error">{loadError}</Notice>
  if (!form) return <p className="py-8 text-center text-sm text-on-surface-variant">Cargando plantilla...</p>

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, general: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const changes = changedFields(form, saved, FIELDS)
    if (!changes.length) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await updatePlantillaDocumento(tipo.id_tipo_documento, Object.fromEntries(changes.map((field) => [field, form[field]])))
      onClose()
    } catch (requestError) {
      const received = fieldErrors(requestError)
      setErrors(Object.keys(received).length ? received : { general: getErrorMessage(requestError, 'No se pudo guardar la plantilla.') })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Field label="Título" htmlFor="plantilla-titulo" error={errors.titulo}>
            <input
              id="plantilla-titulo"
              className={INPUT_CLASS}
              value={form.titulo}
              maxLength={120}
              onChange={(event) => setField('titulo', event.target.value)}
              required
              data-autofocus
            />
          </Field>

          <Field label="Contenido" htmlFor="plantilla-cuerpo" hint="Seleccioná el texto y usá los botones para la negrita, la cursiva y las listas." error={errors.cuerpo}>
            <MarkdownEditor id="plantilla-cuerpo" value={form.cuerpo} onChange={(value) => setField('cuerpo', value)} rows={14} maxLength={20000} invalid={Boolean(errors.cuerpo)} />
          </Field>

          <div className="flex flex-col gap-4 border-t border-outline-variant/40 pt-4">
            <BlockTitle>Talón</BlockTitle>
            <Field label="Leyenda de conformidad" htmlFor="plantilla-leyenda" error={errors.talon_leyenda}>
              <MarkdownEditor
                id="plantilla-leyenda"
                value={form.talon_leyenda}
                onChange={(value) => setField('talon_leyenda', value)}
                rows={3}
                lists={false}
                maxLength={500}
                invalid={Boolean(errors.talon_leyenda)}
              />
            </Field>

            {tipo.aplica_jugador && (
              <>
                <CheckboxField
                  id="plantilla-mostrar-categoria"
                  label="Indicar la categoría del jugador"
                  description="Agrega al talón la categoría a la que ingresa el jugador. A los docentes no se les indica."
                  checked={form.mostrar_categoria}
                  onChange={(value) => setField('mostrar_categoria', value)}
                />
                <CheckboxField
                  id="plantilla-firma-menor"
                  label="El jugador menor de edad también firma"
                  description="Si lo desmarcás, en el talón de los menores firma solo el responsable legal."
                  checked={form.firma_jugador_menor}
                  onChange={(value) => setField('firma_jugador_menor', value)}
                />
              </>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <BlockTitle>Vista previa</BlockTitle>
          <A4TemplatePreview form={form} tipo={tipo} logoUrl={logoUrl} clubName={clubName} />
        </div>
      </div>

      {errors.general && <Notice tone="error">{errors.general}</Notice>}
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON_CLASSES.secondary} onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className={BUTTON_CLASSES.primary} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  )
}
