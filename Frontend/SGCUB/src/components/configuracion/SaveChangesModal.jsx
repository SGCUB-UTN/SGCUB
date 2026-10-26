import { useEffect, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getImpactoConfiguracionFinanciera } from '../../api/configuracion'
import { getAutorizantes } from '../../api/usuarios'
import { getErrorMessage } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { CUOTA_FIELD_LABELS, formatCuotaValue, upcomingPeriods } from './financialFields'
import { generalChangeRows } from './generalFields'
import { BUTTON_CLASSES } from './settingsForm'
import { Field, Notice, SelectInput } from './settingsParts'

function ResponsableSelect({ value, onChange, invalid }) {
  const [authorizers, setAuthorizers] = useState(null)

  useEffect(() => {
    let active = true
    getAutorizantes()
      .then((users) => active && setAuthorizers(users))
      .catch(() => active && setAuthorizers([]))
    return () => { active = false }
  }, [])

  const placeholder = authorizers === null
    ? 'Cargando...'
    : authorizers.length ? 'Seleccionar...' : 'No se pudieron cargar los usuarios'

  return (
    <SelectInput
      id="responsable-configuracion"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={!authorizers?.length}
      invalid={invalid}
    >
      <option value="">{placeholder}</option>
      {(authorizers ?? []).map((user) => <option key={user.id} value={user.full_name}>{user.full_name}</option>)}
    </SelectInput>
  )
}

function ImpactNote({ period }) {
  const [impact, setImpact] = useState({ period: null, count: null, error: false })

  useEffect(() => {
    let cancelled = false
    getImpactoConfiguracionFinanciera(period)
      .then((data) => {
        if (!cancelled) setImpact({ period, count: data.cuotas_afectadas, error: false })
      })
      .catch(() => {
        if (!cancelled) setImpact({ period, count: null, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [period])

  let message
  if (impact.period !== period) message = 'calculando cuántas cuotas se van a actualizar...'
  else if (impact.error) message = 'no se pudo calcular cuántas cuotas se van a actualizar.'
  else if (!impact.count) message = `todavía no hay cuotas generadas desde ${formatPeriod(period)}: los cambios se aplican a las que se generen.`
  else message = `se ${impact.count === 1 ? 'actualizará 1 cuota impaga' : `actualizarán ${impact.count} cuotas impagas`} a partir de ${formatPeriod(period)}, incluidas las parcialmente pagas. Las cuotas pagas no cambian.`

  return (
    <p className="flex items-start gap-2 text-base text-sky-900" role="status">
      <span className="material-symbols-outlined shrink-0 text-[20px] text-sky-700" aria-hidden="true">info</span>
      <span><strong>Impacto:</strong> {message}</span>
    </p>
  )
}

// Section title inside the table; the line above divides it from the previous section
function SectionRow({ title, first }) {
  return (
    <tr className={first ? '' : 'border-t-2 border-slate-300'}>
      <th colSpan={4} className="px-4 pb-1.5 pt-3 text-sm font-bold text-on-surface">{title}</th>
    </tr>
  )
}

function ChangeRow({ label, before, after }) {
  return (
    <tr>
      <td className="px-4 py-1.5 text-on-surface">{label}</td>
      <td className="px-4 py-1.5 text-right text-slate-500">{before}</td>
      <td className="w-6 py-1.5 text-center text-slate-400" aria-hidden="true">→</td>
      <td className="px-4 py-1.5 text-right font-semibold text-primary">{after}</td>
    </tr>
  )
}

function ChangesSummary({ config, period }) {
  const { changes, draft, financiera: current } = config
  const immediate = generalChangeRows(config)
  const hasFinancial = changes.financiera.length > 0
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        <table className="w-full text-left text-base">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 font-semibold">Parámetro</th>
              <th className="px-4 py-2 text-right font-semibold">Valor actual</th>
              <th className="w-6 py-2"><span className="sr-only">Cambia a</span></th>
              <th className="px-4 py-2 text-right font-semibold">Nuevo valor</th>
            </tr>
          </thead>
          <tbody>
            {hasFinancial && <SectionRow first title={`Cambios aplicados a partir de ${formatPeriod(period).toLowerCase()}`} />}
            {changes.financiera.map((field) => (
              <ChangeRow
                key={field}
                label={CUOTA_FIELD_LABELS[field]}
                before={formatCuotaValue(field, current[field], current)}
                after={formatCuotaValue(field, draft.financiera[field], draft.financiera)}
              />
            ))}
            {immediate.length > 0 && <SectionRow first={!hasFinancial} title="Cambios aplicados al instante" />}
            {immediate.map((row) => <ChangeRow key={row.key} label={row.label} before={row.before} after={row.after} />)}
            <tr><td colSpan={4} className="h-2" /></tr>
          </tbody>
        </table>
      </div>
      {hasFinancial && <ImpactNote period={period} />}
    </div>
  )
}

function SaveChangesForm({ config, onSaved, onClose }) {
  const [responsable, setResponsable] = useState('')
  const [period, setPeriod] = useState(() => upcomingPeriods(1)[0])
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const asksPeriod = config.changes.financiera.length > 0

  const confirm = async () => {
    if (!responsable) {
      setErrors({ responsable: 'Elegí quién es el responsable de los cambios.' })
      return
    }
    setErrors({})
    setSaving(true)
    try {
      const result = await config.save({ responsable, periodo: period })
      onSaved(result)
      onClose()
    } catch (requestError) {
      const data = requestError.response?.data ?? {}
      setErrors({
        responsable: data.responsable?.join?.(' '),
        periodo: data.financiera?.periodo_vigencia?.join?.(' '),
        general: data.general || data.financiera
          ? 'Hay datos con errores: revisalos en la pantalla (quedan marcados en rojo) y volvé a guardar.'
          : getErrorMessage(requestError, 'No se pudieron guardar los cambios.'),
      })
      setSaving(false)
    }
  }

  return (
    <div className="flex max-h-[calc(100vh-11rem)] flex-col">
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-1">
        <div className={`grid grid-cols-1 gap-4 ${asksPeriod ? 'sm:grid-cols-2' : ''}`}>
          <Field label="Responsable" htmlFor="responsable-configuracion" error={errors.responsable}>
            <ResponsableSelect value={responsable} onChange={setResponsable} invalid={Boolean(errors.responsable)} />
          </Field>
          {asksPeriod && (
            <Field label="Período de aplicación" htmlFor="periodo-vigencia" error={errors.periodo}>
              <SelectInput id="periodo-vigencia" value={period} onChange={(event) => setPeriod(event.target.value)} invalid={Boolean(errors.periodo)}>
                {upcomingPeriods().map((option) => <option key={option} value={option}>{formatPeriod(option)}</option>)}
              </SelectInput>
            </Field>
          )}
        </div>

        <hr className="border-0 border-t border-outline-variant/40" />

        <ChangesSummary config={config} period={period} />

        {errors.general && <Notice tone="error">{errors.general}</Notice>}
      </div>

      <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-outline-variant/30 pt-4">
        <button type="button" className={BUTTON_CLASSES.secondary} onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="button" className={BUTTON_CLASSES.primary} onClick={confirm} disabled={saving}>
          {saving ? 'Guardando...' : 'Confirmar'}
        </button>
      </div>
    </div>
  )
}

export default function SaveChangesModal({ opened, onClose, ...props }) {
  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title={<Text fw={700} size="xl">Guardar cambios de configuración</Text>}>
      {opened && <SaveChangesForm onClose={onClose} {...props} />}
    </Modal>
  )
}
