import { useCallback, useEffect, useMemo, useState } from 'react'
import { PERMISSIONS } from '../auth/permissions'
import { useAuth } from '../auth/useAuth'
import {
  getAutomatizacionExecutions,
  getAutomatizaciones,
  updateAutomatizacionStatus,
} from '../api/automatizaciones'
import { AREA_ORDER, getAutomationInfo } from '../components/automatizaciones/automationCatalog'
import CategoryUpdatePanel from '../components/automatizaciones/CategoryUpdatePanel'
import ExecuteActionModal from '../components/automatizaciones/ExecuteActionModal'
import RecategorizationPanel from '../components/automatizaciones/RecategorizationPanel'
import TurnOffAutomationModal from '../components/automatizaciones/TurnOffAutomationModal'
import { RecordSection } from '../components/personas/tabs/parts'
import PageHeader from '../components/shared/PageHeader'
import useCategoryUpdate from '../hooks/useCategoryUpdate'
import useRecategorization from '../hooks/useRecategorization'

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

const getErrorMessage = (error) => {
  const detail = error.response?.data?.detail
  return typeof detail === 'string'
    ? detail
    : 'No se pudieron cargar o actualizar las automatizaciones. Intentá nuevamente.'
}

function AutomationCard({ automation, canChange, isUpdating, onToggle }) {
  const isActive = automation.is_active
  const info = getAutomationInfo(automation)

  return (
    <article className={`rounded-xl border bg-white px-4 py-3 shadow-sm transition-shadow hover:shadow-md ${isActive ? 'border-slate-200' : 'border-slate-200/80'}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isActive ? 'bg-sky-50 text-sky-700' : 'bg-slate-100 text-slate-500'}`} aria-hidden="true">
          <span className="material-symbols-outlined text-[20px]">{info.icon}</span>
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-slate-900">{info.title}</h3>
          <p className="text-sm text-slate-600">{info.description}</p>
          {info.tip && (
            <p className="mt-1.5 inline-flex items-start gap-1.5 text-sm text-sky-800">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">lightbulb</span>
              {info.tip}
            </p>
          )}
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
              aria-label={`${isActive ? 'Desactivar' : 'Activar'} ${info.title}`}
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
  const recategorization = useRecategorization()
  const categoryUpdate = useCategoryUpdate()
  const [isRunModalOpen, setIsRunModalOpen] = useState(false)
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [pendingTurnOff, setPendingTurnOff] = useState(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  const startRecategorization = async (executedBy) => {
    await recategorization.run(executedBy)
    setIsRunModalOpen(false)
  }

  const startCategoryUpdate = async (executedBy) => {
    await categoryUpdate.run(executedBy)
    setIsCategoryModalOpen(false)
    setHistoryVersion((version) => version + 1)
  }

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
  }, [executionPage, historyVersion])

  const automationGroups = useMemo(() => {
    const groups = new Map(AREA_ORDER.map((area) => [area, []]))
    automatizaciones.forEach((automation) => {
      const { area } = getAutomationInfo(automation)
      if (!groups.has(area)) groups.set(area, [])
      groups.get(area).push(automation)
    })
    return [...groups].filter(([, items]) => items.length > 0)
  }, [automatizaciones])

  const changeStatus = async (automation) => {
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
      setPendingTurnOff(null)
    }
  }

  const toggleStatus = (automation) => {
    if (automation.is_active) setPendingTurnOff(automation)
    else changeStatus(automation)
  }

  return (
    <div className="min-h-full bg-slate-50/70 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <div className="flex flex-col gap-3">
          <div>
            <PageHeader
              breadcrumb={[{ label: 'Administración' }, { label: 'Automatizaciones' }]}
              title="Automatizaciones"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </div>
        )}

        <RecordSection title="Acciones ejecutables">
          <CategoryUpdatePanel
            status={categoryUpdate.status}
            isLoading={categoryUpdate.isLoading}
            error={categoryUpdate.error}
            canRun={canChange}
            onRun={() => setIsCategoryModalOpen(true)}
          />
          <hr className="mx-auto w-1/3 border-slate-300" />
          <RecategorizationPanel
            execution={recategorization.execution}
            isLoading={recategorization.isLoading}
            error={recategorization.error}
            categories={categoryUpdate.status}
            canRun={canChange}
            onRun={() => setIsRunModalOpen(true)}
          />
        </RecordSection>

        <ExecuteActionModal
          id="category-update"
          opened={isCategoryModalOpen}
          title="Actualizar categorías al nuevo año"
          description={(
            <>
              <p>¿Querés pasar las categorías al año {categoryUpdate.status?.anio_actual}?</p>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="material-symbols-outlined text-base" aria-hidden="true">warning</span>
                <p>
                  Se cambia el año de todas las categorías y se renombran las infantiles (por ejemplo, "2015" pasa a "2016").
                  Normalmente se hace una vez por año, al comenzar la temporada.
                </p>
              </div>
            </>
          )}
          confirmLabel="Actualizar categorías"
          confirmIcon="event_repeat"
          savingLabel="Actualizando..."
          errorMessage="No se pudieron actualizar las categorías."
          onConfirm={startCategoryUpdate}
          onClose={() => setIsCategoryModalOpen(false)}
        />

        <ExecuteActionModal
          id="recategorization"
          opened={isRunModalOpen}
          title="Ejecutar recategorización"
          description={(
            <>
              <p>¿Querés ejecutar la recategorización de jugadores?</p>
              <p>
                Se revisarán todos los jugadores activos y con baja parcial, y se les asignará la categoría que corresponde
                según su año de nacimiento.
              </p>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <span className="material-symbols-outlined text-base" aria-hidden="true">schedule</span>
                <p>El proceso puede tardar unos minutos. Podés seguir usando el sistema mientras se ejecuta.</p>
              </div>
            </>
          )}
          confirmLabel="Ejecutar recategorización"
          confirmIcon="bolt"
          savingLabel="Iniciando..."
          errorMessage="No se pudo iniciar la recategorización."
          onConfirm={startRecategorization}
          onClose={() => setIsRunModalOpen(false)}
        />

        <TurnOffAutomationModal
          automation={pendingTurnOff}
          isUpdating={updatingId !== null}
          onConfirm={() => changeStatus(pendingTurnOff)}
          onClose={() => setPendingTurnOff(null)}
        />

        <RecordSection
          title="Ejecuciones automáticas"
          extra={!isLoading && (
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
              {automatizaciones.length} {automatizaciones.length === 1 ? 'tarea' : 'tareas'}
            </span>
          )}
        >

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

          {!isLoading && automationGroups.map(([area, items]) => (
            <div key={area} className="flex flex-col gap-3">
              <h3 className="mt-2 text-sm font-semibold uppercase tracking-wider text-slate-500">{area}</h3>
              {items.map((automation) => (
                <AutomationCard
                  key={automation.id}
                  automation={automation}
                  canChange={canChange}
                  isUpdating={updatingId !== null}
                  onToggle={toggleStatus}
                />
              ))}
            </div>
          ))}
        </RecordSection>

        <RecordSection title="Registro de últimas ejecuciones">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
          </div>
        </RecordSection>
      </div>
    </div>
  )
}
