import { formatAmount } from '../personas/format'
import { currentPeriod, formatPeriod } from '../shared/periodFormat'

// Version created before the configuration was versioned: it applies since always
export const INITIAL_PERIOD = '2000-01'

export const SURCHARGE_TYPES = [
  { value: 'MontoFijo', label: 'Monto fijo ($)' },
  { value: 'Porcentaje', label: 'Porcentaje (%)' },
]

// Cuota parameters: changing them requires the period they apply from
export const CUOTA_FIELDS = [
  'monto_cuota_social',
  'monto_cuota_deportiva',
  'dia_generacion',
  'dia_vencimiento_1',
  'dia_vencimiento_2',
  'tipo_recargo_1',
  'valor_recargo_1',
  'tipo_recargo_2',
  'valor_recargo_2',
]

export const CUOTA_FIELD_LABELS = {
  monto_cuota_social: 'Cuota social',
  monto_cuota_deportiva: 'Cuota deportiva',
  dia_generacion: 'Día de generación de cuotas',
  dia_vencimiento_1: 'Día del 1° vencimiento',
  dia_vencimiento_2: 'Día del 2° vencimiento',
  tipo_recargo_1: 'Tipo de recargo (1° vencimiento)',
  valor_recargo_1: 'Recargo (1° vencimiento)',
  tipo_recargo_2: 'Tipo de recargo (2° vencimiento)',
  valor_recargo_2: 'Recargo (2° vencimiento)',
}

const AMOUNT_FIELDS = ['monto_cuota_social', 'monto_cuota_deportiva']
const DAY_FIELDS = ['dia_generacion', 'dia_vencimiento_1', 'dia_vencimiento_2']

export const formatCuotaValue = (field, value, version) => {
  if (value === null || value === undefined || value === '') return '—'
  if (AMOUNT_FIELDS.includes(field)) return formatAmount(value)
  if (DAY_FIELDS.includes(field)) return `Día ${value}`
  if (field.startsWith('tipo_recargo')) return SURCHARGE_TYPES.find((type) => type.value === value)?.label ?? value
  if (field.startsWith('valor_recargo')) {
    const type = version?.[field.replace('valor', 'tipo')]
    return type === 'Porcentaje' ? `${Number(value)}%` : formatAmount(value)
  }
  return String(value)
}

export const formatVigencia = (period) => (period === INITIAL_PERIOD ? 'Desde el inicio' : `Desde ${formatPeriod(period)}`)

export const nextPeriod = (today = new Date()) => currentPeriod(new Date(today.getFullYear(), today.getMonth() + 1, 1))

// Versions that start after the current period: the latest one created for each period
export const scheduledVersions = (versions) => {
  const current = currentPeriod()
  const byPeriod = {}
  versions
    .filter((version) => version.periodo_vigencia > current)
    .forEach((version) => {
      const kept = byPeriod[version.periodo_vigencia]
      if (!kept || version.configuracion_financiera_id > kept.configuracion_financiera_id) byPeriod[version.periodo_vigencia] = version
    })
  return Object.values(byPeriod).sort((a, b) => a.periodo_vigencia.localeCompare(b.periodo_vigencia))
}

export const validateCuotaForm = (form) => {
  const errors = {}
  const number = (field) => Number(form[field])
  AMOUNT_FIELDS.forEach((field) => {
    if (!(number(field) > 0)) errors[field] = 'Ingresá un monto mayor a cero.'
  })
  DAY_FIELDS.forEach((field) => {
    const max = field === 'dia_generacion' ? 28 : 31
    if (!Number.isInteger(number(field)) || number(field) < 1 || number(field) > max) errors[field] = `Ingresá un día entre 1 y ${max}.`
  })
  if (!errors.dia_vencimiento_2 && number('dia_vencimiento_2') < number('dia_vencimiento_1')) {
    errors.dia_vencimiento_2 = 'El segundo vencimiento no puede ser anterior al primero.'
  }
  if (!errors.dia_generacion && number('dia_generacion') > number('dia_vencimiento_1')) {
    errors.dia_generacion = 'Las cuotas deben generarse antes del primer vencimiento o el mismo día.'
  }
  ;[1, 2].forEach((due) => {
    const field = `valor_recargo_${due}`
    if (form[field] === '' || number(field) < 0) errors[field] = 'Ingresá un valor igual o mayor a cero.'
    else if (form[`tipo_recargo_${due}`] === 'Porcentaje' && number(field) > 100) errors[field] = 'El porcentaje no puede superar el 100%.'
  })
  return errors
}
