const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
const CUSTOM_SCHEDULE = 'Con una programación especial'

const pad = (value) => String(value).padStart(2, '0')
const atTime = (hour, minute) => `a las ${pad(hour)}:${pad(minute)} hs`
const isAny = (field) => field === '*' || field === '?'
const isNumber = (field) => /^\d+$/.test(field)

const joinList = (items) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items.at(-1)}` : items[0])

function describeCron(expression) {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return CUSTOM_SCHEDULE
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields
  if (!isNumber(minute) || !isNumber(hour)) return CUSTOM_SCHEDULE
  const at = atTime(Number(hour), Number(minute))

  if (isAny(dayOfMonth) && isAny(month) && isAny(dayOfWeek)) return `Todos los días ${at}`
  if (isNumber(dayOfMonth) && isNumber(month) && isAny(dayOfWeek) && MONTHS[Number(month) - 1]) {
    return `Todos los años, el ${Number(dayOfMonth)} de ${MONTHS[Number(month) - 1]} ${at}`
  }
  if (isNumber(dayOfMonth) && isAny(month) && isAny(dayOfWeek)) return `El día ${Number(dayOfMonth)} de cada mes ${at}`
  if (isAny(dayOfMonth) && isAny(month) && /^\d(,\d)*$/.test(dayOfWeek)) {
    return `Todos los ${joinList(dayOfWeek.split(',').map((day) => WEEKDAYS_PLURAL[Number(day) % 7]))} ${at}`
  }
  return CUSTOM_SCHEDULE
}

// Turns a django-q schedule into a sentence such as "El día 1 de cada mes a las 01:00 hs"
export function describeSchedule(schedule) {
  if (schedule.schedule_type === 'C') return schedule.cron ? describeCron(schedule.cron) : CUSTOM_SCHEDULE
  if (schedule.schedule_type === 'I') return `Cada ${schedule.minutes} minutos`
  if (schedule.schedule_type === 'H') return 'Cada hora'
  if (!schedule.next_run) return CUSTOM_SCHEDULE

  const date = new Date(schedule.next_run)
  const at = atTime(date.getHours(), date.getMinutes())
  switch (schedule.schedule_type) {
    case 'D': return `Todos los días ${at}`
    case 'W': return `Todos los ${WEEKDAYS_PLURAL[date.getDay()]} ${at}`
    case 'M': return `El día ${date.getDate()} de cada mes ${at}`
    case 'Q': return `Cada 3 meses, el día ${date.getDate()}, ${at}`
    case 'Y': return `Todos los años, el ${date.getDate()} de ${MONTHS[date.getMonth()]} ${at}`
    case 'O': return `Una sola vez, el ${formatLongDate(date)} ${at}`
    default: return CUSTOM_SCHEDULE
  }
}

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const daysFromToday = (date) => Math.round((startOfDay(date) - startOfDay(new Date())) / 86400000)

function formatLongDate(date) {
  const year = date.getFullYear() === new Date().getFullYear() ? '' : ` de ${date.getFullYear()}`
  return `${date.getDate()} de ${MONTHS[date.getMonth()]}${year}`
}

function describeDistance(days) {
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  if (days > 1) return `en ${days} días`
  return 'pendiente'
}

// "1 de noviembre a las 01:00 hs (en 7 días)"
export function describeNextRun(value) {
  if (!value) return 'Sin fecha programada'
  const date = new Date(value)
  return `${formatLongDate(date)} ${atTime(date.getHours(), date.getMinutes())} (${describeDistance(daysFromToday(date))})`
}

// "Hoy, 10:30 hs", "Ayer, 02:00 hs" or "12/01/2026, 10:30 hs"
export function describeWhen(value) {
  if (!value) return 'Sin fecha'
  const date = new Date(value)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())} hs`
  const days = daysFromToday(date)
  if (days === 0) return `Hoy, ${time}`
  if (days === -1) return `Ayer, ${time}`
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${time}`
}
