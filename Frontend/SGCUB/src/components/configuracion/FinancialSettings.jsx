import { useState } from 'react'
import { formatDate, getErrorMessage } from '../personas/format'
import { CUOTA_FIELD_LABELS, SURCHARGE_TYPES, formatCuotaValue, formatVigencia, scheduledVersions } from './financialFields'
import { BUTTON_CLASSES } from './settingsForm'
import { Field, INPUT_CLASS, IconButton, Notice, PrefixedInput, SettingsCard } from './settingsParts'

function SurchargeInputs({ due, form, errors, onChange }) {
  const typeField = `tipo_recargo_${due}`
  const valueField = `valor_recargo_${due}`
  const isPercentage = form[typeField] === 'Porcentaje'
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Field label={`Tipo de recargo al ${due}° vencimiento`} htmlFor={typeField}>
        <select id={typeField} className={INPUT_CLASS} value={form[typeField]} onChange={(event) => onChange(typeField, event.target.value)}>
          {SURCHARGE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select>
      </Field>
      <Field label={`Recargo al ${due}° vencimiento`} htmlFor={valueField} error={errors[valueField]}>
        <PrefixedInput
          id={valueField}
          type="number"
          min="0"
          max={isPercentage ? '100' : undefined}
          step="0.01"
          prefix={isPercentage ? undefined : '$'}
          suffix={isPercentage ? '%' : undefined}
          value={form[valueField]}
          onChange={(event) => onChange(valueField, event.target.value)}
        />
      </Field>
    </div>
  )
}

function ScheduledVersions({ versions }) {
  if (!versions.length) return null
  return (
    <Notice tone="info">
      <p className="font-semibold">Cambios programados</p>
      <ul className="mt-1 flex flex-col gap-2">
        {versions.map((version) => (
          <li key={version.configuracion_financiera_id}>
            <span className="font-semibold">{formatVigencia(version.periodo_vigencia)}</span>
            {' '}(cargado por {version.usuario_nombre ?? 'el sistema'} el {formatDate(version.fecha_creacion)}):
            {' '}{version.cambios.map((cambio) => `${CUOTA_FIELD_LABELS[cambio.campo]} ${formatCuotaValue(cambio.campo, cambio.nuevo, version)}`).join(' · ')}
          </li>
        ))}
      </ul>
    </Notice>
  )
}

function CuotaParametersCard({ config, versions, onShowHistory }) {
  const form = config.draft.financiera
  const errors = config.errors.financiera
  const setField = config.setFinancialField

  const numberField = (field, props = {}) => (
    <Field label={CUOTA_FIELD_LABELS[field]} htmlFor={field} error={errors[field]} hint={props.hint}>
      <PrefixedInput
        id={field}
        type="number"
        value={form[field]}
        onChange={(event) => setField(field, event.target.value)}
        {...props.input}
      />
    </Field>
  )

  return (
    <SettingsCard
      icon="request_quote"
      title="Cuotas: montos, fechas y recargos"
      description={`Valores vigentes: ${formatVigencia(config.financiera.periodo_vigencia).toLowerCase()}. Al guardar se elige desde qué mes aplican los cambios.`}
      actions={(
        <button type="button" className={BUTTON_CLASSES.secondary} onClick={onShowHistory}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">history</span>
          Historial de versiones
        </button>
      )}
    >
      <ScheduledVersions versions={versions} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {numberField('monto_inscripcion', { input: { prefix: '$', min: '0', step: '0.01' }, hint: 'Todavía no se cobra.' })}
        {numberField('monto_cuota_social', { input: { prefix: '$', min: '0.01', step: '0.01' } })}
        {numberField('monto_cuota_deportiva', { input: { prefix: '$', min: '0.01', step: '0.01' }, hint: 'Se suma a la cuota social de los jugadores activos.' })}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {numberField('dia_generacion', { input: { min: '1', max: '28', step: '1' }, hint: 'Día del mes en que se crean las cuotas (1 a 28).' })}
        {numberField('dia_vencimiento_1', { input: { min: '1', max: '31', step: '1' } })}
        {numberField('dia_vencimiento_2', { input: { min: '1', max: '31', step: '1' }, hint: 'En meses más cortos se usa el último día.' })}
      </div>

      <div className="flex flex-col gap-4">
        <SurchargeInputs due={1} form={form} errors={errors} onChange={setField} />
        <SurchargeInputs due={2} form={form} errors={errors} onChange={setField} />
      </div>
    </SettingsCard>
  )
}

function DelinquencyCard({ config }) {
  return (
    <SettingsCard icon="how_to_reg" title="Morosidad" description="Se aplica apenas se guarda.">
      <div className="max-w-sm">
        <Field
          label="Cuotas vencidas para considerar moroso"
          htmlFor="cuotas_vencidas_morosidad"
          error={config.errors.general.cuotas_vencidas_morosidad}
          hint="El reporte de morosidad solo incluye a los socios con esta cantidad de cuotas vencidas o más."
        >
          <input
            id="cuotas_vencidas_morosidad"
            type="number"
            min="1"
            max="24"
            step="1"
            className={INPUT_CLASS}
            value={config.draft.general.cuotas_vencidas_morosidad}
            onChange={(event) => config.setGeneralField('cuotas_vencidas_morosidad', event.target.value)}
          />
        </Field>
      </div>
    </SettingsCard>
  )
}

function PaymentMethodRow({ medio, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(medio.nombre)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setEditing(false)
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar el medio de pago.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {editing ? (
          <input
            className={`${INPUT_CLASS} max-w-xs`}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Nombre del medio de pago"
            autoFocus
          />
        ) : (
          <span className={`flex-1 text-base font-semibold ${medio.activo ? 'text-on-surface' : 'text-on-surface-variant line-through'}`}>{medio.nombre}</span>
        )}
        <span className={`rounded-full px-2.5 py-0.5 text-sm font-semibold ${medio.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
          {medio.activo ? 'Habilitado' : 'Deshabilitado'}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {editing ? (
            <>
              <button type="button" className={BUTTON_CLASSES.primary} disabled={busy || !name.trim()} onClick={() => run(() => onUpdate(medio.medio_pago_id, { nombre: name }))}>Guardar</button>
              <button type="button" className={BUTTON_CLASSES.secondary} disabled={busy} onClick={() => { setEditing(false); setName(medio.nombre); setError('') }}>Cancelar</button>
            </>
          ) : (
            <>
              <IconButton icon="edit" label="Renombrar" disabled={busy} onClick={() => setEditing(true)} />
              <IconButton
                icon={medio.activo ? 'toggle_on' : 'toggle_off'}
                label={medio.activo ? 'Deshabilitar' : 'Habilitar'}
                disabled={busy}
                onClick={() => run(() => onUpdate(medio.medio_pago_id, { activo: !medio.activo }))}
              />
              <IconButton
                icon="delete"
                label={medio.en_uso ? 'Ya se usó en pagos: deshabilitalo en lugar de eliminarlo' : 'Eliminar'}
                disabled={busy || medio.en_uso}
                onClick={() => run(() => onDelete(medio.medio_pago_id))}
              />
            </>
          )}
        </div>
      </div>
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </li>
  )
}

function PaymentMethodsCard({ medios, onCreate, onUpdate, onDelete }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const add = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onCreate({ nombre: name })
      setName('')
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo agregar el medio de pago.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SettingsCard
      icon="account_balance_wallet"
      title="Medios de pago aceptados"
      description="Solo los medios habilitados se pueden elegir al registrar un pago. Los que ya se usaron no se eliminan: se deshabilitan."
    >
      <ul className="divide-y divide-outline-variant/30 rounded-lg border border-outline-variant/40">
        {medios.map((medio) => (
          <PaymentMethodRow key={medio.medio_pago_id} medio={medio} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </ul>
      <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <input
          className={`${INPUT_CLASS} sm:max-w-sm`}
          placeholder="Ej: Tarjeta de débito"
          value={name}
          onChange={(event) => { setName(event.target.value); setError('') }}
          aria-label="Nuevo medio de pago"
        />
        <button type="submit" className={BUTTON_CLASSES.primary} disabled={saving || !name.trim()}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
          Agregar medio
        </button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
    </SettingsCard>
  )
}

export default function FinancialSettings({ config, onShowHistory }) {
  return (
    <div className="flex flex-col gap-5">
      <CuotaParametersCard config={config} versions={scheduledVersions(config.versiones)} onShowHistory={onShowHistory} />
      <DelinquencyCard config={config} />
      <PaymentMethodsCard medios={config.medios} onCreate={config.createMedio} onUpdate={config.updateMedio} onDelete={config.deleteMedio} />
    </div>
  )
}
