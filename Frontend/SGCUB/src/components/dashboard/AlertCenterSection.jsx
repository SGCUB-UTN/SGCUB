import { Link } from 'react-router-dom'
import { PERMISSIONS } from '../../auth/permissions'
import { useAuth } from '../../auth/useAuth'
import { formatCount, formatDateTime } from '../cuota/cuotaPeriod'
import { PANEL_CLASS, PANEL_HEADING_CLASS as HEADING_CLASS } from '../shared/panel'
import { formatPeriod } from '../shared/periodFormat'
import SectionHeading from '../shared/SectionHeading'
import { HeadingSkeleton, SkeletonBlock, SkeletonStatus } from '../shared/Skeleton'

const TONES = {
  error: { icon: 'error', iconClass: 'text-error', badge: 'bg-error-container text-on-error-container' },
  warning: { icon: 'warning', iconClass: 'text-amber-600', badge: 'bg-secondary-fixed text-on-secondary-fixed' },
  success: { icon: 'check_circle', iconClass: 'text-emerald-700', badge: 'bg-emerald-50 text-emerald-700' },
  neutral: { icon: 'info', iconClass: 'text-outline', badge: 'bg-surface-container-high text-on-surface-variant' },
}

const NEEDS_ACTION = new Set(['error', 'warning'])
const AUTOMATIONS = { to: '/automatizaciones', permission: PERMISSIONS.manageAutomations }

function categoriesRow(updated, year) {
  if (updated) return null
  return {
    key: 'categories',
    title: 'Actualizar las categorías',
    description: `Todavía no se actualizaron las categorías al año ${year}.`,
    tone: 'warning',
    status: 'Pendiente',
    ...AUTOMATIONS,
  }
}

function recategorizationRow(recategorization, year) {
  if (!recategorization.executed) {
    return {
      key: 'recategorization',
      title: 'Recategorizar a los jugadores',
      description: `Todavía no se ejecutó la recategorización automática de ${year}.`,
      tone: 'warning',
      status: 'Pendiente',
      ...AUTOMATIONS,
    }
  }
  if (recategorization.status === 'revision_pendiente') {
    return {
      key: 'recategorization',
      title: 'Revisar la recategorización',
      description: `La recategorización de ${year} tiene resultados por revisar.`,
      tone: 'warning',
      status: 'Por revisar',
      to: '/automatizaciones/recategorizacion',
      permission: PERMISSIONS.manageAutomations,
    }
  }
  if (recategorization.status === 'en_curso') {
    return {
      key: 'recategorization',
      title: 'Recategorización en curso',
      description: `La recategorización de ${year} se está ejecutando.`,
      tone: 'neutral',
      status: 'En curso',
      ...AUTOMATIONS,
    }
  }
  return null
}

function generationRow(generation) {
  const base = { key: 'generation', title: 'Generación automática de cuotas', to: '/finanzas/cuotas' }
  if (!generation) {
    return { ...base, description: 'Todavía no hay ejecuciones automáticas registradas.', tone: 'neutral', status: 'Sin ejecuciones' }
  }
  const when = `${formatPeriod(generation.period)} · ${formatDateTime(generation.executed_at)}`
  if (generation.successful) {
    return { ...base, description: `Última ejecución: ${when}.`, tone: 'success', status: 'Correcta' }
  }
  return { ...base, description: generation.summary || `La ejecución de ${when} falló.`, tone: 'error', status: 'Con errores' }
}

function mailRow(failures) {
  const base = { key: 'mails', title: 'Envío automático de mails', to: '/comunicaciones/historial' }
  if (failures.count === 0) {
    return { ...base, description: `Sin fallos en los últimos ${failures.days} días.`, tone: 'success', status: 'Sin errores' }
  }
  const plural = failures.count === 1 ? 'mail automático no se pudo enviar' : 'mails automáticos no se pudieron enviar'
  return {
    ...base,
    description: `${formatCount(failures.count)} ${plural} en los últimos ${failures.days} días. Último fallo: ${formatDateTime(failures.last_failure_at)}.`,
    tone: 'error',
    status: failures.count === 1 ? '1 fallido' : `${formatCount(failures.count)} fallidos`,
  }
}

function backupRow(backup) {
  if (backup.configured) return null
  return {
    key: 'backup',
    title: 'Backup de los datos',
    description: 'Todavía no hay un backup automático configurado.',
    tone: 'neutral',
    status: 'Sin configurar',
  }
}

function buildRows(alerts, year) {
  return [
    categoriesRow(alerts.categories_updated, year),
    recategorizationRow(alerts.recategorization, year),
    generationRow(alerts.last_generation),
    mailRow(alerts.mail_failures),
    backupRow(alerts.backup),
  ].filter(Boolean)
}

function AlertRow({ row, canOpen }) {
  const tone = TONES[row.tone]
  const content = (
    <>
      <span className={`material-symbols-outlined text-[20px] shrink-0 ${tone.iconClass}`} aria-hidden="true">{tone.icon}</span>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="font-medium text-base text-on-surface">{row.title}</span>
        <span className="text-sm text-on-surface-variant line-clamp-2" title={row.description}>{row.description}</span>
      </div>
      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${tone.badge}`}>{row.status}</span>
      {canOpen && <span className="material-symbols-outlined text-[20px] shrink-0 text-on-surface-variant" aria-hidden="true">chevron_right</span>}
    </>
  )
  const rowClass = 'flex items-center gap-3 py-3 px-4 sm:px-5'
  if (!canOpen) return <li className={rowClass}>{content}</li>
  return (
    <li>
      <Link
        to={row.to}
        className={`${rowClass} transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:bg-surface-container-low`}
      >
        {content}
      </Link>
    </li>
  )
}

function AlertCenterSkeleton() {
  return (
    <SkeletonStatus label="Cargando alertas..." className={`${PANEL_CLASS} lg:col-span-7`}>
      <HeadingSkeleton withAction />
      <div className="flex flex-col divide-y divide-outline-variant/20">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 py-3 px-4 sm:px-5">
            <SkeletonBlock round className="w-5 h-5 shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <SkeletonBlock className="h-4 w-2/5" />
              <SkeletonBlock soft className="h-3 w-3/5" />
            </div>
            <SkeletonBlock round className="h-6 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  )
}

export default function AlertCenterSection({ isLoading, alerts }) {
  const { hasPermission } = useAuth()
  if (isLoading) return <AlertCenterSkeleton />

  const rows = alerts ? buildRows(alerts, new Date().getFullYear()) : []
  const pending = rows.filter((row) => NEEDS_ACTION.has(row.tone)).length
  const summary = pending === 0 ? 'Todo en orden' : pending === 1 ? '1 por resolver' : `${pending} por resolver`

  return (
    <section className={`${PANEL_CLASS} lg:col-span-7`} aria-labelledby="alert-center-title">
      <SectionHeading
        id="alert-center-title"
        icon="notifications_active"
        title="Alertas y tareas pendientes"
        className={HEADING_CLASS}
        actions={alerts && (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${pending === 0 ? TONES.success.badge : TONES.error.badge}`}>
            {summary}
          </span>
        )}
      />
      {alerts ? (
        <ul className="flex flex-col divide-y divide-outline-variant/20">
          {rows.map((row) => (
            <AlertRow key={row.key} row={row} canOpen={Boolean(row.to) && (!row.permission || hasPermission(row.permission))} />
          ))}
        </ul>
      ) : (
        <p className="px-4 sm:px-5 py-4 text-sm text-on-surface-variant">Sin datos de alertas.</p>
      )}
    </section>
  )
}
