import { Link } from 'react-router-dom'
import CometModoBadge from '../../components/comet/CometModoBadge'
import PageHeader from '../../components/shared/PageHeader'
import { useCometCompeticiones, useCometStatus } from '../../hooks/useComet'

const SECCIONES = [
  { to: '/comet/competiciones', icon: 'emoji_events', titulo: 'Competiciones', descripcion: 'Torneos y ligas registradas en COMET.' },
  { to: '/comet/equipos', icon: 'groups_3', titulo: 'Equipos', descripcion: 'Equipos del club dados de alta en COMET.' },
  { to: '/comet/partidos', icon: 'sports_soccer', titulo: 'Partidos', descripcion: 'Fixture y partidos programados.' },
  { to: '/comet/tablas', icon: 'leaderboard', titulo: 'Tablas', descripcion: 'Tablas de posiciones por competición.' },
  { to: '/comet/inscripciones', icon: 'assignment', titulo: 'Inscripciones', descripcion: 'Inscripciones de jugadores a competiciones.' },
  { to: '/comet/jugadores', icon: 'badge', titulo: 'Jugadores COMET', descripcion: 'Jugadores ya exportados a COMET.' },
  { to: '/comet/logs', icon: 'history', titulo: 'Historial', descripcion: 'Auditoría de operaciones contra COMET.' },
]

function SeccionCard({ to, icon, titulo, descripcion }) {
  return (
    <Link
      to={to}
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-5 flex flex-col gap-3 hover:border-primary/40 hover:shadow-sm transition-all group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-[22px]" aria-hidden="true">{icon}</span>
        </div>
        <h3 className="text-base font-semibold text-on-surface">{titulo}</h3>
      </div>
      <p className="text-sm text-on-surface-variant">{descripcion}</p>
      <div className="flex items-center gap-1 text-primary text-sm font-semibold mt-auto">
        <span>Ver</span>
        <span className="material-symbols-outlined text-[16px] group-hover:translate-x-0.5 transition-transform" aria-hidden="true">arrow_forward</span>
      </div>
    </Link>
  )
}

export default function CometHub() {
  // Usamos una sección cualquiera solo para detectar si el backend está OK.
  // El modo lo devuelve el backend en cada respuesta; acá usamos un default.
 const { error } = useCometCompeticiones()
  const { status } = useCometStatus()
  const modo = status?.modo ?? null

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Integraciones' }, { label: 'COMET' }]}
        title="Integración COMET"
        actions={modo ? <CometModoBadge modo={modo} /> : null}      />

      {modo === 'mock' && (
        <div className="bg-warning-container/30 border border-warning/40 rounded-lg p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-warning shrink-0" aria-hidden="true">info</span>
          <div className="text-sm text-on-surface-variant">
            <p className="font-semibold text-on-surface">Estás viendo datos de prueba</p>
            <p>La integración con COMET está en modo <strong>mock</strong>. Los datos que se muestran son simulados y no vienen del sistema oficial.</p>
          </div>
        </div>
      )}

      {!modo && (
        <div className="bg-error-container/30 border border-error/40 rounded-lg p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-error shrink-0" aria-hidden="true">error</span>
          <div className="text-sm">
            <p className="font-semibold text-on-surface">No se pudo conectar con la integración COMET</p>
            <p className="text-on-surface-variant">Verificá que el backend esté corriendo y con las variables de entorno configuradas.</p>
          </div>
        </div>
      )}

      <section aria-label="Secciones COMET">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SECCIONES.map((seccion) => <SeccionCard key={seccion.to} {...seccion} />)}
        </div>
      </section>
    </div>
  )
}