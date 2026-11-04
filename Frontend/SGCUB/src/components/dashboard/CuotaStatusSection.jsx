import { Link } from 'react-router-dom'
import CuotaSituationChart from './CuotaSituationChart'
import { formatMoney, formatWholeMoney } from '../cuota/cuotaPeriod'
import { KpiColumn } from '../shared/Kpi'
import { PANEL_BODY_CLASS as BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS as HEADING_CLASS } from '../shared/panel'
import { formatPeriod } from '../shared/periodFormat'
import SectionHeading from '../shared/SectionHeading'
import { HeadingSkeleton, LineSkeletons, RingSkeleton, SkeletonBlock, SkeletonStatus } from '../shared/Skeleton'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'

function CuotaStatusSkeleton() {
  return (
    <SkeletonStatus label="Cargando situación de las cuotas..." className={PANEL_CLASS}>
      <HeadingSkeleton withAction />
      <div className={`${BODY_CLASS} flex flex-col sm:flex-row sm:items-start gap-6`}>
        <div className="flex flex-col gap-2 shrink-0">
          <SkeletonBlock soft className="h-3.5 w-40" />
          <div className="flex items-center gap-4">
            <RingSkeleton size={120} stroke={16} />
            <LineSkeletons count={3} className="w-36 flex flex-col gap-3" />
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-4 sm:pl-6">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <SkeletonBlock soft className="h-3.5 w-40 max-w-full" />
              <SkeletonBlock className="h-7 w-32 max-w-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonStatus>
  )
}

export default function CuotaStatusSection({ isLoading, cuotas, income }) {
  if (isLoading) return <CuotaStatusSkeleton />

  const label = cuotas ? `Estado de las cuotas de ${formatPeriod(cuotas.period)}` : 'Estado de las cuotas'

  return (
    <section className={PANEL_CLASS} aria-labelledby="cuota-status-title">
      <SectionHeading
        id="cuota-status-title"
        icon="donut_large"
        title="Finanzas"
        className={HEADING_CLASS}
        actions={(
          <Link to="/finanzas/cuotas" className={`${TEXT_BUTTON_CLASS} text-sm`}>
            Ver cuotas
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        )}
      />
      <div className={BODY_CLASS}>
        {cuotas ? (
          <div className="flex flex-col sm:flex-row sm:items-start gap-6">
            <div className="shrink-0">
              <CuotaSituationChart situation={cuotas} label={label} />
            </div>
            {income && (
              <div className="flex-1 min-w-0 flex flex-col gap-4 sm:pl-6 sm:border-l border-outline-variant/40">
                <KpiColumn label="Ingresos por cuotas" value={formatWholeMoney(income.cuotas)} title={formatMoney(income.cuotas)} />
                <div className="pt-4 border-t border-outline-variant/40">
                  <KpiColumn label="Otros movimientos" value={formatWholeMoney(income.other)} title={formatMoney(income.other)} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-on-surface-variant">Sin datos de cuotas.</p>
        )}
      </div>
    </section>
  )
}
