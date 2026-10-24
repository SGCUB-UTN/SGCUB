import { useCallback, useEffect, useMemo, useState } from 'react'
import { PERMISSIONS } from '../auth/permissions'
import { useAuth } from '../auth/useAuth'
import {
  getAutomatizacionExecutions,
  getAutomatizaciones,
  updateAutomatizacionStatus,
} from '../api/automatizaciones'
import PageHeader from '../components/shared/PageHeader'

const FREQUENCIES = {
  O: 'Una vez',
  H: 'Cada hora',
  D: 'Diaria',
  W: 'Semanal',
  M: 'Mensual',
  Q: 'Trimestral',
  Y: 'Anual',
}

const MONTHS = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

const formatCronField = (field, names, unit) => {
  if (field === '*' || field === '?') return `cada ${unit}`
  if (field.startsWith('*/')) return `cada ${field.slice(2)} ${unit}`
  const values = field.split(',')
  const readableValues = values.map((value) => {
    if (value.includes('-')) {
      const [start, end] = value.split('-').map(Number)
      return `${names[start] ?? start} a ${names[end] ?? end}`
    }
    const numericValue = Number(value)
    return names[numericValue] ?? numericValue
  })
  return readableValues.join(', ')
}

const formatMonthDays = (field) => {
  if (/^\d+$/.test(field)) return `los ${field}`
  if (/^\d+-\d+$/.test(field)) {
    const [start, end] = field.split('-')
    return `del ${start} al ${end}`
  }
  if (/^\d+(,\d+)+$/.test(field)) return `los días ${field.split(',').join(', ')}`
  if (field.startsWith('*/')) return `cada ${field.slice(2)} días`
  return `los días ${formatCronField(field, [], 'días')}`
}

const formatCron = (expression) => {
  const fields = expression.trim().split(/\s+/)
  if (fields.length !== 5) return `Programada con la expresión ${expression}`

  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields
  const minuteNumber = Number(minute)
  const hourNumber = Number(hour)
  const fixedTime = Number.isInteger(minuteNumber)
    && Number.isInteger(hourNumber)
    && minuteNumber >= 0 && minuteNumber < 60
    && hourNumber >= 0 && hourNumber < 24
  const timeDescription = fixedTime
    ? `a las ${String(hourNumber).padStart(2, '0')}:${String(minuteNumber).padStart(2, '0')}`
    : `cuando coincidan ${formatCronField(minute, [], 'minutos')} y ${formatCronField(hour, [], 'horas')}`

  const hasDayOfMonth = dayOfMonth !== '*' && dayOfMonth !== '?'
  const hasMonth = month !== '*' && month !== '?'
  const hasDayOfWeek = dayOfWeek !== '*' && dayOfWeek !== '?'
  let dateDescription = 'todos los días'

  if (hasDayOfMonth && hasMonth && !hasDayOfWeek) {
    dateDescription = `${formatMonthDays(dayOfMonth)} de ${formatCronField(month, MONTHS, 'meses')}`
  } else if (hasDayOfMonth && !hasMonth && !hasDayOfWeek) {
    dateDescription = `${formatMonthDays(dayOfMonth)} de cada mes`
  } else if (!hasDayOfMonth && hasMonth && !hasDayOfWeek) {
    dateDescription = `cada día de ${formatCronField(month, MONTHS, 'meses')}`
  } else if (!hasDayOfMonth && !hasMonth && hasDayOfWeek) {
    dateDescription = `cada ${formatCronField(dayOfWeek, WEEKDAYS, 'días de la semana').replace(/^cada /, '')}`
  } else if (hasDayOfMonth || hasMonth || hasDayOfWeek) {
    dateDescription = [
      hasDayOfMonth && `${formatMonthDays(dayOfMonth)} del mes`,
      hasMonth && `mes ${formatCronField(month, MONTHS, 'meses')}`,
      hasDayOfWeek && `día de semana ${formatCronField(dayOfWeek, WEEKDAYS, 'días')}`,
    ].filter(Boolean).join(', ')
  }

  return `${dateDescription} ${timeDescription}`
}

const getFrequency = (schedule) => {
  if (schedule.schedule_type === 'C' && schedule.cron) return formatCron(schedule.cron)
  if (schedule.schedule_type === 'I') return `Cada ${schedule.minutes} minuto/s`
  return FREQUENCIES[schedule.schedule_type] ?? 'Programada'
}

const formatDate = (value) => {
  if (!value) return 'Sin fecha programada'
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

const formatExecutionTime = (value) => {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const formatTime = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
  const dateKey = (item) => `${item.getFullYear()}-${item.getMonth()}-${item.getDate()}`

  if (dateKey(date) === dateKey(today)) return `Hoy, ${formatTime} hs`
  if (dateKey(date) === dateKey(yesterday)) return `Ayer, ${formatTime} hs`

  const dateLabel = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)
  return `${dateLabel}, ${formatTime} hs`
}

const getTimeUntil = (value) => {
  if (!value) return 'Sin próxima ejecución'
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60000))
  if (minutes < 60) return `En ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `En ${hours} h ${minutes % 60} min`
  const days = Math.floor(hours / 24)
  return `En ${days} día${days === 1 ? '' : 's'}`
}

const getCategory = (schedule) => {
  const text = `${schedule.name} ${schedule.func}`.toLowerCase()
  if (text.includes('finanza') || text.includes('cuota') || text.includes('mora')) return 'Finanzas'
  if (text.includes('padron') || text.includes('categor') || text.includes('jugador')) return 'Padrón'
  return 'Sistema'
}

const getIcon = (schedule) => {
  const text = `${schedule.name} ${schedule.func}`.toLowerCase()
  if (text.includes('mora') || text.includes('recargo')) return 'payments'
  if (text.includes('año') || text.includes('categoria')) return 'event_repeat'
  if (text.includes('cuota')) return 'request_quote'
  return 'schedule'
}

const getErrorMessage = (error) => {
  const detail = error.response?.data?.detail
  return typeof detail === 'string'
    ? detail
    : 'No se pudieron cargar o actualizar las automatizaciones. Intentá nuevamente.'
}

function SummaryCard({ label, value, supportingText, icon, tone = 'blue' }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <article className="flex min-w-0 items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-2 truncate text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-500">{supportingText}</p>
      </div>
      <span className={`material-symbols-outlined flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`} aria-hidden="true">
        {icon}
      </span>
    </article>
  )
}

function AutomationCard({ automation, canChange, isUpdating, onToggle }) {
  const isActive = automation.is_active

  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${isActive ? 'border-slate-200' : 'border-slate-200/80'}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className={`material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`} aria-hidden="true">
          {getIcon(automation)}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">{automation.name}</h3>
            <span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
              {getCategory(automation)}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">repeat</span>
              Frecuencia: {getFrequency(automation)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">event</span>
              Próxima: {formatDate(automation.next_run)}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-100 pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
          <div className="text-left sm:text-right">
            <p className={`text-xs font-bold uppercase tracking-wider ${isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
              {isActive ? 'Activo' : 'Inactivo'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {isActive ? getTimeUntil(automation.next_run) : 'Ejecución pausada'}
            </p>
          </div>
          {canChange && (
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              aria-label={`${isActive ? 'Desactivar' : 'Activar'} ${automation.name}`}
              onClick={() => onToggle(automation)}
              disabled={isUpdating}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 ${isActive ? 'bg-sky-700' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

export default function Automatizaciones() {
  const { hasPermission } = useAuth()
  const canChange = hasPermission(PERMISSIONS.editAutomations)
  const [automatizaciones, setAutomatizaciones] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState(null)
  const [error, setError] = useState('')
  const [executionLog, setExecutionLog] = useState({
    results: [],
    count: 0,
    page: 1,
    page_size: 5,
    total_pages: 0,
  })
  const [executionPage, setExecutionPage] = useState(1)
  const [isLoadingExecutions, setIsLoadingExecutions] = useState(true)
  const [executionError, setExecutionError] = useState('')

  const loadAutomatizaciones = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      setAutomatizaciones(await getAutomatizaciones())
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAutomatizaciones()
  }, [loadAutomatizaciones])

  useEffect(() => {
    let cancelled = false
    const loadExecutions = async () => {
      setIsLoadingExecutions(true)
      setExecutionError('')
      try {
        const result = await getAutomatizacionExecutions(executionPage)
        if (!cancelled) setExecutionLog(result)
      } catch (requestError) {
        if (!cancelled) setExecutionError(getErrorMessage(requestError))
      } finally {
        if (!cancelled) setIsLoadingExecutions(false)
      }
    }

    loadExecutions()
    return () => {
      cancelled = true
    }
  }, [executionPage])

  const { active, inactive, nextAutomation } = useMemo(() => {
    const activeSchedules = automatizaciones.filter((item) => item.is_active)
    const next = activeSchedules
      .filter((item) => item.next_run)
      .sort((first, second) => new Date(first.next_run) - new Date(second.next_run))[0]

    return {
      active: activeSchedules.length,
      inactive: automatizaciones.length - activeSchedules.length,
      nextAutomation: next,
    }
  }, [automatizaciones])

  const toggleStatus = async (automation) => {
    setUpdatingId(automation.id)
    setError('')
    try {
      const updated = await updateAutomatizacionStatus(automation.id, !automation.is_active)
      setAutomatizaciones((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )))
    } catch (requestError) {
      setError(getErrorMessage(requestError))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="min-h-full bg-slate-50/70 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div>
            <PageHeader
              breadcrumb={[{ label: 'Administración' }, { label: 'Automatizaciones' }]}
              title="Automatizaciones del Sistema"
            />
            <p className="max-w-2xl text-sm text-slate-500">
              Configurá el estado de las tareas programadas y consultá sus próximas ejecuciones.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        <section aria-label="Resumen de automatizaciones" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Automatizaciones activas"
            value={isLoading || error ? '—' : active}
            supportingText={error ? 'No se pudo consultar el servicio' : `${automatizaciones.length} registradas`}
            icon="autorenew"
            tone="blue"
          />
          <SummaryCard
            label="Pausadas"
            value={isLoading || error ? '—' : inactive}
            supportingText={error ? 'No se pudo consultar el servicio' : 'No generarán nuevas tareas programadas'}
            icon="pause_circle"
            tone="amber"
          />
          <SummaryCard
            label="Próxima ejecución"
            value={isLoading || error ? '—' : nextAutomation ? getTimeUntil(nextAutomation.next_run) : 'Sin tareas'}
            supportingText={error ? 'No se pudo consultar el servicio' : nextAutomation ? nextAutomation.name : 'No hay tareas activas con fecha próxima'}
            icon="schedule"
            tone="green"
          />
        </section>

        <section aria-label="Estado del planificador" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700" aria-hidden="true">
                hub
              </span>
              <div>
                <h2 className="font-semibold text-slate-900">Estado de las tareas programadas</h2>
                <p className="text-xs text-slate-500">
                  {isLoading
                    ? 'Consultando tareas registradas...'
                    : error
                      ? 'No se pudo consultar el estado del planificador.'
                      : `${active} de ${automatizaciones.length} tareas habilitadas`}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs font-semibold sm:self-auto ${isLoading || error ? 'bg-slate-100 text-slate-600' : active > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <span className={`h-2 w-2 rounded-full ${isLoading || error ? 'bg-slate-400' : active > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {isLoading ? 'Consultando' : error ? 'Estado no disponible' : active > 0 ? 'Tareas habilitadas' : 'Todas pausadas'}
            </span>
          </div>
          <div className="h-1.5 bg-slate-100">
            <div
              className={`h-full transition-all ${active > 0 ? 'bg-sky-700' : 'bg-slate-300'}`}
              style={{ width: `${!isLoading && !error && automatizaciones.length ? (active / automatizaciones.length) * 100 : 0}%` }}
            />
          </div>
        </section>

        <section aria-labelledby="automation-list-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 id="automation-list-title" className="text-base font-bold text-slate-900">Automatizaciones configuradas</h2>
              <p className="mt-0.5 text-xs text-slate-500">Activá o pausá cada tarea sin modificar su programación.</p>
            </div>
            {!isLoading && (
              <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                {automatizaciones.length} {automatizaciones.length === 1 ? 'tarea' : 'tareas'}
              </span>
            )}
          </div>

          {!canChange && !isLoading && (
            <p className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600" role="status">
              Tenés permiso de consulta, pero no para cambiar el estado de las automatizaciones.
            </p>
          )}

          {isLoading && (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500" role="status">
              Cargando automatizaciones...
            </div>
          )}

          {!isLoading && !error && automatizaciones.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <span className="material-symbols-outlined text-3xl text-slate-400" aria-hidden="true">event_busy</span>
              <p className="mt-2 text-sm font-medium text-slate-700">No hay automatizaciones registradas.</p>
            </div>
          )}

          {!isLoading && automatizaciones.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              canChange={canChange}
              isUpdating={updatingId !== null}
              onToggle={toggleStatus}
            />
          ))}
        </section>

        <section aria-labelledby="execution-log-title" className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-700" aria-hidden="true">receipt_long</span>
              <div>
                <h2 id="execution-log-title" className="font-semibold text-slate-900">Registro de últimas ejecuciones</h2>
                <p className="text-xs text-slate-500">Historial de tareas completadas, exitosas o fallidas.</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-2 self-start text-xs text-slate-500 sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-sky-600" />
              Historial disponible
            </span>
          </div>

          {executionError && (
            <div className="m-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
              {executionError}
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="bg-sky-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Fecha y hora</th>
                  <th className="px-4 py-3">Automatización</th>
                  <th className="px-4 py-3">Módulo / alcance</th>
                  <th className="px-4 py-3">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoadingExecutions && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500" role="status">
                      Cargando ejecuciones...
                    </td>
                  </tr>
                )}
                {!isLoadingExecutions && !executionError && executionLog.results.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      Todavía no hay ejecuciones registradas.
                    </td>
                  </tr>
                )}
                {!isLoadingExecutions && executionLog.results.map((execution) => (
                  <tr key={execution.id} className="text-slate-600">
                    <td className="whitespace-nowrap px-4 py-4">{formatExecutionTime(execution.executed_at)}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{execution.automation}</td>
                    <td className="px-4 py-4">{execution.scope}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${execution.success ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${execution.success ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        {execution.success ? 'Exitosa' : 'Fallida'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <p>
              {isLoadingExecutions
                ? 'Cargando registros...'
                : `Mostrando ${executionLog.count === 0 ? 0 : (executionLog.page - 1) * executionLog.page_size + 1}–${(executionLog.page - 1) * executionLog.page_size + executionLog.results.length} de ${executionLog.count.toLocaleString('es-AR')} ejecuciones`}
            </p>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <button
                type="button"
                onClick={() => setExecutionPage((page) => Math.max(1, page - 1))}
                disabled={isLoadingExecutions || executionLog.page <= 1}
                aria-label="Página anterior"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_left</span>
              </button>
              <span className="whitespace-nowrap font-medium text-slate-700">
                Página {executionLog.page} de {executionLog.total_pages}
              </span>
              <button
                type="button"
                onClick={() => setExecutionPage((page) => Math.min(executionLog.total_pages, page + 1))}
                disabled={isLoadingExecutions || executionLog.page >= executionLog.total_pages}
                aria-label="Página siguiente"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
