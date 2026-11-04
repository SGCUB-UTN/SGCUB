import { Link } from 'react-router-dom'
import CuotaSituationChart from './CuotaSituationChart'
import { PANEL_BODY_CLASS as BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS as HEADING_CLASS } from '../shared/panel'
import { formatPeriod } from '../shared/periodFormat'
import SectionHeading from '../shared/SectionHeading'
import { HeadingSkeleton, LineSkeletons, RingSkeleton, SkeletonStatus } from '../shared/Skeleton'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'

function CuotaStatusSkeleton() {
  return (
    <SkeletonStatus label="Cargando situación de las cuotas..." className={`${PANEL_CLASS} lg:col-span-5`}>
      <HeadingSkeleton withAction />
      <div className={`${BODY_CLASS} flex flex-col sm:flex-row items-center gap-5`}>
        <RingSkeleton />
        <LineSkeletons count={3} className="w-full sm:w-48 flex flex-col gap-3" />
      </div>
    </SkeletonStatus>
  )
}

export default function CuotaStatusSection({ isLoading, cuotas }) {
  if (isLoading) return <CuotaStatusSkeleton />

  const title = cuotas ? `Cuotas de ${formatPeriod(cuotas.period)}` : 'Cuotas del mes'

  return (
    <section className={`${PANEL_CLASS} lg:col-span-5`} aria-labelledby="cuota-status-title">
      <SectionHeading
        id="cuota-status-title"
        icon="donut_large"
        title={title}
        className={HEADING_CLASS}
        actions={(
          <Link to="/finanzas/cuotas" className={`${TEXT_BUTTON_CLASS} text-sm`}>
            Ver cuotas
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        )}
      />
      <div className={BODY_CLASS}>
        {cuotas
          ? <CuotaSituationChart situation={cuotas} label={title} />
          : <p className="text-sm text-on-surface-variant">Sin datos de cuotas.</p>}
      </div>
    </section>
  )
}
