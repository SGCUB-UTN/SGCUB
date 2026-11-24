import { Link } from 'react-router-dom'
import { formatCount } from '../cuota/cuotaPeriod'
import { KpiColumn, KpiGrid } from '../shared/Kpi'
import { PANEL_BODY_CLASS as BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS as HEADING_CLASS } from '../shared/panel'
import SectionHeading from '../shared/SectionHeading'
import { HeadingSkeleton, SkeletonBlock, SkeletonStatus } from '../shared/Skeleton'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'

const INDICATORS = [
  { key: 'socios', label: 'Socios' },
  { key: 'jugadores', label: 'Jugadores' },
  { key: 'baja_parcial', label: 'Jugadores de baja parcial' },
]

function MemberCountsSkeleton() {
  return (
    <SkeletonStatus label="Cargando indicadores del padrón..." className={PANEL_CLASS}>
      <HeadingSkeleton withAction />
      <div className={`${BODY_CLASS} grid grid-cols-1 sm:grid-cols-3 gap-6`}>
        {INDICATORS.map((indicator) => (
          <div key={indicator.key} className="flex flex-col gap-2">
            <SkeletonBlock soft className="h-3.5 w-24" />
            <SkeletonBlock className="h-7 w-16" />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  )
}

export default function MemberCountsSection({ isLoading, members }) {
  if (isLoading) return <MemberCountsSkeleton />

  return (
    <section className={PANEL_CLASS} aria-labelledby="member-counts-title">
      <SectionHeading
        id="member-counts-title"
        icon="groups"
        title="Indicadores del padrón"
        className={HEADING_CLASS}
        actions={(
          <Link to="/padron/socios" className={`${TEXT_BUTTON_CLASS} text-base`}>
            Ver padrón
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        )}
      />
      <div className={BODY_CLASS}>
        <KpiGrid columns={3}>
          {INDICATORS.map((indicator) => (
            <KpiColumn
              key={indicator.key}
              label={indicator.label}
              value={members ? formatCount(members[indicator.key]) : '—'}
            />
          ))}
        </KpiGrid>
      </div>
    </section>
  )
}
