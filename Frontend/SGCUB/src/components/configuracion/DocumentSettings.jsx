import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getErrorMessage } from '../personas/format'
import { IntegerInput } from './formattedInputs'
import { BUTTON_CLASSES, SMALL_BUTTON_CLASSES, TABLE_CLASSES, fieldErrors } from './settingsForm'
import { Field, INPUT_CLASS, IconButton, Notice, SettingsSection, StatusPill } from './settingsParts'

// Documentation is only loaded for players and docentes
const PROFILES = [
  { field: 'aplica_jugador', label: 'Jugadores' },
  { field: 'aplica_docente', label: 'Docentes' },
]

const EMPTY_TYPE = {
  nombre: '',
  aplica_jugador: true,
  aplica_docente: false,
  obligatorio: false,
}

function DocumentTypeForm({ tipo, onSave, onClose }) {
  const [form, setForm] = useState(() => tipo ?? EMPTY_TYPE)
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
        ...Object.fromEntries(PROFILES.map(({ field }) => [field, form[field]])),
        aplica_socio: false,
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

      {/* The checkbox is centered on the title and its description */}
      <div className="flex items-center gap-3">
        <input
          id="tipo-obligatorio"
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-primary cursor-pointer"
          checked={form.obligatorio}
          onChange={(event) => setField('obligatorio', event.target.checked)}
          aria-describedby="tipo-obligatorio-descripcion"
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor="tipo-obligatorio" className="text-sm font-semibold text-on-surface cursor-pointer">Obligatorio</label>
          <p id="tipo-obligatorio-descripcion" className="text-sm text-on-surface-variant">
            Forma parte de la documentación que la persona tiene que presentar. Si no está cargado, figura como faltante en su ficha.
          </p>
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
    <tr className={TABLE_CLASSES.row}>
      <td className={TABLE_CLASSES.cell}>
        <p className={`font-medium ${tipo.activo ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>{tipo.nombre}</p>
        {error && <p className="mt-1 text-xs font-medium text-error" role="alert">{error}</p>}
      </td>
      <td className={`${TABLE_CLASSES.cell} text-on-surface-variant`}>{profilesLabel(tipo)}</td>
      <td className={`${TABLE_CLASSES.cell} text-on-surface-variant`}>{tipo.obligatorio ? 'Sí' : 'No'}</td>
      <td className={TABLE_CLASSES.cell}><StatusPill active={tipo.activo} /></td>
      <td className={TABLE_CLASSES.actionsCell}>
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

function DocumentTypesSection({ tipos, onCreate, onUpdate, onDelete }) {
  const [modal, setModal] = useState({ opened: false, tipo: null, key: 0 })
  const open = (tipo = null) => setModal((current) => ({ opened: true, tipo, key: current.key + 1 }))
  const close = () => setModal((current) => ({ ...current, opened: false }))

  const save = (data) => (modal.tipo ? onUpdate(modal.tipo.id_tipo_documento, data) : onCreate(data))

  return (
    <SettingsSection
      icon="folder_managed"
      title="Tipos de documento"
      flush
      extra={(
        <button type="button" className={SMALL_BUTTON_CLASSES.primary} onClick={() => open()}>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
          Nuevo tipo
        </button>
      )}
    >
      <div className={TABLE_CLASSES.wrapper}>
        <table className={`${TABLE_CLASSES.table} min-w-[720px]`}>
          <thead className={TABLE_CLASSES.head}>
            <tr>
              <th className={TABLE_CLASSES.headCell}>Tipo</th>
              <th className={TABLE_CLASSES.headCell}>Se pide a</th>
              <th className={TABLE_CLASSES.headCell}>Obligatorio</th>
              <th className={TABLE_CLASSES.headCell}>Estado</th>
              <th className={`${TABLE_CLASSES.headCell} text-right`}>Acciones</th>
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
    </SettingsSection>
  )
}

function DocumentAlertsSection({ config }) {
  const error = config.errors.general.dias_alerta_documentos
  return (
    <SettingsSection
      icon="notification_important"
      title="Alertas de vencimiento"
    >
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="dias_alerta_documentos" className="text-sm font-medium text-on-surface">Días de aviso antes del vencimiento</label>
          <div className="w-20">
            <IntegerInput
              id="dias_alerta_documentos"
              unit="días"
              maxLength={2}
              value={config.draft.general.dias_alerta_documentos}
              onChange={(value) => config.setGeneralField('dias_alerta_documentos', value)}
              invalid={Boolean(error)}
            />
          </div>
        </div>
        {error && <p className="text-xs font-medium text-error" role="alert">{error}</p>}
      </div>
    </SettingsSection>
  )
}

export default function DocumentSettings({ config }) {
  return (
    <div className="flex flex-col">
      <DocumentTypesSection tipos={config.tipos} onCreate={config.createTipo} onUpdate={config.updateTipo} onDelete={config.deleteTipo} />
      <DocumentAlertsSection config={config} />
    </div>
  )
}
