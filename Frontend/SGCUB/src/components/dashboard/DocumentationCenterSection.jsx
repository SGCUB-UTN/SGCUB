import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { shareOf } from '../finanzas/cashFormat'
import DonutChart from '../shared/DonutChart'
import { legendItemProps } from '../shared/donutLegend'
import { KpiColumn } from '../shared/Kpi'
import { PANEL_BODY_CLASS as BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS as HEADING_CLASS } from '../shared/panel'
import SectionHeading from '../shared/SectionHeading'
import { HeadingSkeleton, RingSkeleton, SkeletonBlock, SkeletonStatus } from '../shared/Skeleton'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'

const SEGMENTS = [
  { key: 'valid', label: 'Vigente', fill: 'bg-emerald-600', stroke: 'stroke-emerald-600' },
  { key: 'expiring', label: 'Próxima a vencer', fill: 'bg-amber-600', stroke: 'stroke-amber-600' },
  { key: 'missing', label: 'Faltante', fill: 'bg-outline', stroke: 'stroke-outline' },
  { key: 'expired', label: 'Vencida', fill: 'bg-error', stroke: 'stroke-error' },
]

const upToDate = (profile) => (
  <>
    {formatPercentage(shareOf(profile.up_to_date, profile.total))}{' '}
    <span className="text-base font-normal text-on-surface-variant">({formatCount(profile.up_to_date)} / {formatCount(profile.total)})</span>
  </>
)

function DocumentStateChart({ documents }) {
  const [activeKey, setActiveKey] = useState(null)
  const total = SEGMENTS.reduce((sum, segment) => sum + documents[segment.key], 0)
  const segments = SEGMENTS.map((segment) => ({
    key: segment.key,
    label: segment.label,
    amount: documents[segment.key],
    strokeClass: segment.stroke,
    display: formatCount(documents[segment.key]),
    share: formatPercentage(shareOf(documents[segment.key], total)),
  }))

  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Estado de la documentación</h3>
      <div className="mt-2 flex items-center gap-4">
        <DonutChart
          segments={segments}
          total={total}
          size={120}
          stroke={16}
          centerValue={formatPercentage(shareOf(documents.valid + documents.expiring, total))}
          caption="vigente"
          label={`Estado de la documentación: ${SEGMENTS.map((segment) => `${formatCount(documents[segment.key])} ${segment.label.toLowerCase()}`).join(', ')}`}
          emptyLabel="Sin documentación exigida ni cargada"
          activeKey={activeKey}
          onActiveChange={setActiveKey}
        />
        <ul className="flex flex-col gap-1 min-w-0 text-sm">
          {SEGMENTS.map((segment) => {
            const interaction = legendItemProps(segment.key, activeKey, setActiveKey)
            return (
              <li key={segment.key} {...interaction} className={`${interaction.className} flex items-center gap-2 min-w-0`}>
                <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${segment.fill}`} aria-hidden="true" />
                <span className="text-on-surface-variant">{segment.label}</span>
                <span className="font-semibold tabular-nums text-on-surface">{formatCount(documents[segment.key])}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function DocumentationCenterSkeleton() {
  return (
    <SkeletonStatus label="Cargando documentación..." className={PANEL_CLASS}>
      <HeadingSkeleton withAction />
      <div className={`${BODY_CLASS} flex flex-col sm:flex-row sm:items-start gap-6`}>
        <RingSkeleton size={120} stroke={16} />
        <div className="flex-1 flex flex-col gap-4 sm:pl-6">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <SkeletonBlock soft className="h-3.5 w-40 max-w-full" />
              <SkeletonBlock className="h-7 w-40 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonStatus>
  )
}

export default function DocumentationCenterSection({ isLoading, documentation }) {
  if (isLoading) return <DocumentationCenterSkeleton />

  return (
    <section className={PANEL_CLASS} aria-labelledby="documentation-center-title">
      <SectionHeading
        id="documentation-center-title"
        icon="folder_shared"
        title="Documentación"
        className={HEADING_CLASS}
        actions={(
          <Link to="/documental" className={`${TEXT_BUTTON_CLASS} text-sm`}>
            Ver control documental
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        )}
      />
      <div className={BODY_CLASS}>
        {documentation ? (
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <DocumentStateChart documents={documentation.documents} />
            <div className="flex-1 min-w-0 flex flex-col gap-4 sm:pl-6 sm:border-l border-outline-variant/40">
              <KpiColumn
                label="Jugadores al día"
                value={upToDate(documentation.players)}
              />
              <div className="pt-4 border-t border-outline-variant/40">
                <KpiColumn
                  label="Docentes al día"
                  value={upToDate(documentation.teachers)}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">Sin datos de documentación.</p>
        )}
      </div>
    </section>
  )
}
