import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getErrorMessage } from '../personas/format'
import { Field, INPUT_CLASS, IconButton, Notice, SaveBar, SettingsCard, SwitchRow } from './settingsParts'
import { BUTTON_CLASSES, fieldErrors, useSettingsForm } from './settingsForm'

const PROFILES = [
  { field: 'aplica_jugador', label: 'Jugadores' },
  { field: 'aplica_socio', label: 'Socios' },
  { field: 'aplica_docente', label: 'Docentes' },
]

const EMPTY_TYPE = {
  nombre: '',
  aplica_jugador: true,
  aplica_socio: true,
  aplica_docente: false,
  obligatorio: false,
  requiere_vencimiento: false,
  vigencia_meses: '',
}

function DocumentTypeForm({ tipo, onSave, onClose }) {
  const [form, setForm] = useState(() => (tipo ? { ...tipo, vigencia_meses: tipo.vigencia_meses ?? '' } : EMPTY_TYPE))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined, perfiles: undefined, general: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({
        nombre: form.nombre,
        obligatorio: form.obligatorio,
        requiere_vencimiento: form.requiere_vencimiento,
        vigencia_meses: form.vigencia_meses === '' ? null : Number(form.vigencia_meses),
        ...Object.fromEntries(PROFILES.map(({ field }) => [field, form[field]])),
      })
      onClose()
    } catch (requestError) {
      const received = fieldErrors(requestError)
      setErrors(Object.keys(received).length ? received : { general: getErrorMessage(requestError, 'No se pudo guardar el tipo de documento.') })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Nombre" htmlFor="tipo-nombre" error={errors.nombre}>
        <input id="tipo-nombre" className={INPUT_CLASS} value={form.nombre} maxLength={50} onChange={(event) => setField('nombre', event.target.value)} required data-autofocus />
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-on-surface">Se pide a</legend>
        <div className="flex flex-wrap gap-4">
          {PROFILES.map(({ field, label }) => (
            <label key={field} className="inline-flex items-center gap-2 text-base cursor-pointer">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={form[field]} onChange={(event) => setField(field, event.target.checked)} />
              {label}
            </label>
          ))}
        </div>
        {errors.perfiles && <p className="text-sm text-error" role="alert">{errors.perfiles}</p>}
      </fieldset>

      <SwitchRow
        label="Obligatorio"
        description="Forma parte de la documentación que la persona tiene que presentar."
        checked={form.obligatorio}
        onChange={(value) => setField('obligatorio', value)}
      />
      <SwitchRow
        label="Requiere fecha de vencimiento"
        description="No se puede cargar el documento sin indicar cuándo vence."
        checked={form.requiere_vencimiento}
        onChange={(value) => setField('requiere_vencimiento', value)}
      />
      <Field
        label="Vigencia por defecto (meses)"
        htmlFor="tipo-vigencia"
        error={errors.vigencia_meses}
        hint="Opcional. Al cargar un documento, sugiere el vencimiento a partir de la fecha de emisión."
      >
        <input id="tipo-vigencia" type="number" min="1" max="120" step="1" className={INPUT_CLASS} value={form.vigencia_meses} onChange={(event) => setField('vigencia_meses', event.target.value)} />
      </Field>

      {errors.general && <Notice tone="error">{errors.general}</Notice>}
      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON_CLASSES.secondary} onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className={BUTTON_CLASSES.primary} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
      </div>
    </form>
  )
}

const profilesLabel = (tipo) => PROFILES.filter(({ field }) => tipo[field]).map(({ label }) => label).join(', ')

function DocumentTypeRow({ tipo, onEdit, onUpdate, onDelete }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo modificar el tipo de documento.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-t border-outline-variant/30 align-top">
      <td className="px-4 py-3">
        <p className={`font-semibold ${tipo.activo ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>{tipo.nombre}</p>
        {error && <p className="mt-1 text-sm text-error" role="alert">{error}</p>}
      </td>
      <td className="px-4 py-3 text-on-surface-variant">{profilesLabel(tipo)}</td>
      <td className="px-4 py-3 text-on-surface-variant">{tipo.obligatorio ? 'Sí' : 'No'}</td>
      <td className="px-4 py-3 text-on-surface-variant">
        {tipo.requiere_vencimiento ? 'Obligatorio' : 'Opcional'}
        {tipo.vigencia_meses ? ` · ${tipo.vigencia_meses} ${tipo.vigencia_meses === 1 ? 'mes' : 'meses'}` : ''}
      </td>
      <td className="px-4 py-3">
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${tipo.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {tipo.activo ? 'Habilitado' : 'Deshabilitado'}
        </span>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex justify-end">
          <IconButton icon="edit" label="Editar" disabled={busy} onClick={() => onEdit(tipo)} />
          <IconButton
            icon={tipo.activo ? 'toggle_on' : 'toggle_off'}
            label={tipo.activo ? 'Deshabilitar' : 'Habilitar'}
            disabled={busy}
            onClick={() => run(() => onUpdate(tipo.id_tipo_documento, { activo: !tipo.activo }))}
          />
          <IconButton
            icon="delete"
            label={tipo.en_uso ? 'Ya tiene documentos cargados: deshabilitalo en lugar de eliminarlo' : 'Eliminar'}
            disabled={busy || tipo.en_uso}
            onClick={() => run(() => onDelete(tipo.id_tipo_documento))}
          />
        </div>
      </td>
    </tr>
  )
}

function DocumentTypesCard({ tipos, onCreate, onUpdate, onDelete }) {
  const [modal, setModal] = useState({ opened: false, tipo: null, key: 0 })
  const open = (tipo = null) => setModal((current) => ({ opened: true, tipo, key: current.key + 1 }))
  const close = () => setModal((current) => ({ ...current, opened: false }))

  const save = (data) => (modal.tipo ? onUpdate(modal.tipo.id_tipo_documento, data) : onCreate(data))

  return (
    <SettingsCard
      icon="folder_managed"
      title="Tipos de documento"
      description="Los tipos deshabilitados conservan sus documentos, pero no se pueden usar en cargas nuevas."
      actions={(
        <button type="button" className={BUTTON_CLASSES.primary} onClick={() => open()}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
          Nuevo tipo
        </button>
      )}
    >
      <div className="overflow-x-auto rounded-lg border border-outline-variant/40">
        <table className="w-full min-w-[720px] text-left text-base">
          <thead className="bg-surface-container-low text-sm uppercase tracking-wider text-on-surface-variant">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Tipo</th>
              <th className="px-4 py-2.5 font-semibold">Se pide a</th>
              <th className="px-4 py-2.5 font-semibold">Obligatorio</th>
              <th className="px-4 py-2.5 font-semibold">Vencimiento</th>
              <th className="px-4 py-2.5 font-semibold">Estado</th>
              <th className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {tipos.map((tipo) => (
              <DocumentTypeRow key={tipo.id_tipo_documento} tipo={tipo} onEdit={open} onUpdate={onUpdate} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        opened={modal.opened}
        onClose={close}
        centered
        title={<Text fw={700} size="xl">{modal.tipo ? 'Editar tipo de documento' : 'Nuevo tipo de documento'}</Text>}
      >
        {modal.opened && <DocumentTypeForm key={modal.key} tipo={modal.tipo} onSave={save} onClose={close} />}
      </Modal>
    </SettingsCard>
  )
}

const ALERT_FIELDS = ['dias_alerta_documentos']

function DocumentAlertsCard({ general, onSave }) {
  const { form, setField, changes, errors, status, save, reset } = useSettingsForm(general, ALERT_FIELDS, onSave)
  return (
    <SettingsCard icon="notification_important" title="Alertas de vencimiento" description="Se aplica apenas se guarda.">
      <div className="max-w-sm">
        <Field
          label="Días de aviso antes del vencimiento"
          htmlFor="dias_alerta_documentos"
          error={errors.dias_alerta_documentos}
          hint='Un documento pasa a "Por vencer" cuando le quedan estos días o menos.'
        >
          <input id="dias_alerta_documentos" type="number" min="1" max="365" step="1" className={INPUT_CLASS} value={form.dias_alerta_documentos} onChange={(event) => setField('dias_alerta_documentos', event.target.value)} />
        </Field>
      </div>
      <SaveBar changes={changes} status={status} onSave={save} onReset={reset} />
    </SettingsCard>
  )
}

export default function DocumentSettings({ config }) {
  return (
    <div className="flex flex-col gap-5">
      <DocumentTypesCard tipos={config.tipos} onCreate={config.createTipo} onUpdate={config.updateTipo} onDelete={config.deleteTipo} />
      <DocumentAlertsCard general={config.general} onSave={config.saveGeneral} />
    </div>
  )
}
