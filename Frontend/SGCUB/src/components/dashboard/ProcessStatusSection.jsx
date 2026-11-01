import { Link } from 'react-router-dom'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'

const PROCESOS_ESTATICOS = [
  {
    id: 'comet-sync',
    nombre: 'Sincronización COMET',
    descripcion: 'Actualización de fichas federativas con AFA',
    estado: 'ejecutando',
    detalle: 'Último ciclo: hace 2 h',
  },
  {
    id: 'backup-db',
    nombre: 'Backup de base de datos',
    descripcion: 'Respaldo nocturno automático del sistema',
    estado: 'ejecutando',
    detalle: 'Último ciclo: 02:00 AM',
  },
  {
    id: 'smtp-alertas',
    nombre: 'Alertas SMTP',
    descripcion: 'Envío de notificaciones por correo electrónico',
    estado: 'fallo',
    detalle: 'Timeout relay — reintentar',
  },
]

const ESTADO_STYLES = {
  ejecutando: {
    badge: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    label: 'En ejecución',
    icon: 'check_circle',
    iconClass: 'text-emerald-700',
  },
  fallo: {
    badge: 'bg-error-container text-on-error-container',
    dot: 'bg-error',
    label: 'Con fallo',
    icon: 'error',
    iconClass: 'text-error',
  },
  inactivo: {
    badge: 'bg-surface-container-high text-on-surface-variant',
    dot: 'bg-outline',
    label: 'Inactivo',
    icon: 'pause_circle',
    iconClass: 'text-outline',
  },
}

const procesosConFallo = PROCESOS_ESTATICOS.filter((p) => p.estado === 'fallo')
const procesosEjecutando = PROCESOS_ESTATICOS.filter((p) => p.estado === 'ejecutando')

export default function ProcessStatusSection() {
  return (
    <section
      aria-labelledby="dashboard-process-title"
      className="lg:col-span-7 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden"
    >
      <div className="p-space-lg flex flex-col gap-space-md border-b border-surface-container">
        <div className="flex items-center gap-space-sm">
          <div className="min-w-0">
            <h2 id="dashboard-process-title" className="text-xl font-semibold text-on-surface">
              Estado de procesos
            </h2>
            <p className="text-base text-on-surface-variant">Servicios en segundo plano y tareas programadas</p>
          </div>
          <Link
            to="/automatizaciones"
            className={`${TEXT_BUTTON_CLASS} ml-auto text-sm shrink-0`}
          >
            Ver automatizaciones
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          <div className="rounded-lg p-3 flex flex-col bg-error-container/40 text-error">
            <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">error</span>
              <span>Con fallo</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-2xl font-bold">{procesosConFallo.length}</span>
              {procesosConFallo.length > 0 && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-error text-on-error text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                  title="Reintentar procesos con fallo"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">refresh</span>
                  Reintentar
                </button>
              )}
            </div>
            <span className="text-sm opacity-80">{procesosConFallo.map((p) => p.nombre).join(', ')}</span>
          </div>

          <div className="rounded-lg p-3 flex flex-col bg-emerald-50 text-emerald-700">
            <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check_circle</span>
              <span>En ejecución</span>
            </div>
            <span className="text-2xl font-bold mt-1">{procesosEjecutando.length}</span>
            <span className="text-sm opacity-80">{procesosEjecutando.map((p) => p.nombre).join(', ')}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <div className="py-3 px-4 bg-surface-container-low/60 border-b border-outline-variant/30 text-sm font-semibold text-on-surface-variant uppercase tracking-wider">
          Detalle de procesos
        </div>

        <div className="flex flex-col divide-y divide-outline-variant/20">
          {PROCESOS_ESTATICOS.map((proceso) => {
            const style = ESTADO_STYLES[proceso.estado] ?? ESTADO_STYLES.inactivo
            return (
              <div key={proceso.id} className="flex items-center justify-between gap-3 py-3 px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`material-symbols-outlined text-[20px] shrink-0 ${style.iconClass}`} aria-hidden="true">
                    {style.icon}
                  </span>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-base text-on-surface truncate">{proceso.nombre}</span>
                    <span className="text-sm text-on-surface-variant truncate">{proceso.descripcion}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0 gap-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold ${style.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
                    {style.label}
                  </span>
                  <span className="text-sm text-on-surface-variant">{proceso.detalle}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="p-space-md bg-surface-container-low flex items-center gap-2 mt-auto">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">info</span>
        <span className="text-sm text-on-surface-variant">
          Datos de referencia. La integración en tiempo real está pendiente de desarrollo.
        </span>
      </div>
    </section>
  )
}
