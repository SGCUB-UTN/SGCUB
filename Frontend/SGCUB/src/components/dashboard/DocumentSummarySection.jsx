import { Link } from 'react-router-dom'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'

const TOP_URGENT_COUNT = 4

const TONES = {
  error: {
    badge: 'bg-error-container text-error',
    row: 'hover:bg-error-container/20 focus:bg-error-container/20',
    name: 'group-hover:text-error',
  },
  warning: {
    badge: 'bg-secondary-fixed text-on-secondary-fixed',
    row: 'hover:bg-surface-container-low focus:bg-surface-container-low',
    name: 'group-hover:text-primary',
  },
}

function UrgentDocRow({ doc, getTypeName, tone, badgeLabel }) {
  const style = TONES[tone]
  return (
    <Link
      to={`${doc.url_perfil}?tab=documentacion`}
      className={`flex items-center justify-between gap-3 py-3 px-4 transition-colors group focus:outline-none ${style.row}`}
    >
      <div className="flex flex-col min-w-0">
        <span className={`font-medium text-base text-on-surface truncate transition-colors ${style.name}`}>
          {doc.persona_nombre_completo ?? '—'}
        </span>
        <span className="text-sm text-on-surface-variant truncate">
          {getTypeName(doc.tipo_documento)}{doc.categoria_nombre ? ` · ${doc.categoria_nombre}` : ''}
        </span>
      </div>
      <span className={`shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${style.badge}`}>
        {badgeLabel}
      </span>
    </Link>
  )
}

function DocListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-outline-variant/20 animate-pulse">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-3 px-4">
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-4 w-3/5 bg-surface-container-high rounded" />
            <div className="h-3 w-2/5 bg-surface-container-high rounded" />
          </div>
          <div className="h-6 w-24 bg-surface-container-high rounded-full shrink-0" />
        </div>
      ))}
    </div>
  )
}

function MetricTile({ icon, label, value, caption, className }) {
  return (
    <div className={`rounded-lg p-3 flex flex-col ${className}`}>
      <div className="flex items-center gap-1 text-sm font-semibold uppercase tracking-wider">
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <span className="text-2xl font-bold mt-1">{value}</span>
      <span className="text-sm opacity-80">{caption}</span>
    </div>
  )
}

export default function DocumentSummarySection({ isLoading, vencidos, proximosAVencer, getNombreTipo }) {
  const sortedExpired = [...vencidos].sort((a, b) => b.diasVencido - a.diasVencido)
  const sortedUpcoming = [...proximosAVencer].sort((a, b) => a.diasRestantes - b.diasRestantes)
  const urgentDocs = [...sortedExpired, ...sortedUpcoming].slice(0, TOP_URGENT_COUNT)

  return (
    <section
      aria-labelledby="dashboard-doc-summary-title"
      className="lg:col-span-5 bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden"
    >
      <div className="p-space-lg flex flex-col gap-space-md border-b border-surface-container">
        <div className="flex items-center gap-space-sm">
          <div className="min-w-0">
            <h2 id="dashboard-doc-summary-title" className="text-xl font-semibold text-on-surface">
              Resumen documental
            </h2>
            <p className="text-base text-on-surface-variant">Aptos físicos y legajos de deportistas</p>
          </div>
          <Link
            to="/documental"
            className={`${TEXT_BUTTON_CLASS} ml-auto text-sm shrink-0`}
          >
            Ver control documental
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          <MetricTile
            icon="gpp_bad"
            label="Vencidos"
            value={isLoading ? '—' : vencidos.length}
            caption="Inhabilitados para jugar"
            className="bg-error-container/40 text-error"
          />
          <MetricTile
            icon="notification_important"
            label="Por vencer"
            value={isLoading ? '—' : proximosAVencer.length}
            caption="Próximos 30 días"
            className="bg-secondary-fixed/50 text-on-secondary-fixed"
          />
        </div>
      </div>

      <div className="flex flex-col flex-1">
        <div className="py-3 px-4 bg-surface-container-low/60 border-b border-outline-variant/30 text-sm font-semibold text-on-surface-variant uppercase tracking-wider">
          Casos más urgentes
        </div>

        {isLoading ? (
          <DocListSkeleton />
        ) : urgentDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-space-lg text-center gap-2">
            <span className="material-symbols-outlined text-[32px] text-emerald-700" aria-hidden="true">verified_user</span>
            <p className="text-base font-medium text-on-surface">Sin alertas documentales</p>
            <p className="text-sm text-on-surface-variant">Toda la documentación activa está al día.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-outline-variant/20">
            {urgentDocs.map((doc) => {
              const isExpired = doc.diasVencido != null
              return (
                <UrgentDocRow
                  key={doc.id_documento}
                  doc={doc}
                  getTypeName={getNombreTipo}
                  tone={isExpired ? 'error' : 'warning'}
                  badgeLabel={isExpired ? `${doc.diasVencido} día/s de mora` : `Vence en ${doc.diasRestantes} día/s`}
                />
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
