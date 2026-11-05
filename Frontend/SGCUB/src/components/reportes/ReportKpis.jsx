import useEntered from '../../hooks/useEntered'
import { formatCount, formatPercentage } from '../cuota/cuotaPeriod'
import { WIDTH_MOTION, grown } from '../shared/chartMotion'
import { KpiColumn, KpiGrid } from '../shared/Kpi'
import { PANEL_CLASS } from '../shared/panel'
import { NO_DATA_KEY, formatDecimal } from './reportCharts'

const playersCaption = (players) => (players === 1 ? 'Sobre 1 jugador' : `Sobre ${formatCount(players)} jugadores`)

function PercentKpi({ label, value, players }) {
  const entered = useEntered()
  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">{label}</h3>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-tight text-on-surface">{value == null ? '—' : formatPercentage(value)}</p>
      <div role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? 0} aria-label={label} className="pt-2">
        <div className="h-2 rounded bg-primary-fixed overflow-hidden">
          <div className={`h-full rounded bg-primary ${WIDTH_MOTION}`} style={{ width: grown(entered, `${Math.min(value ?? 0, 100)}%`) }} />
        </div>
      </div>
      <p className="mt-auto pt-1 text-sm text-on-surface-variant">{players ? playersCaption(players) : 'No hay jugadores en el reporte'}</p>
    </div>
  )
}

export default function ReportKpis({ kpis, ageRanges }) {
  const withoutBirthDate = ageRanges.find((item) => item.key === NO_DATA_KEY)?.count ?? 0
  return (
    <section className={`${PANEL_CLASS} p-4 sm:p-5`} aria-label="Resumen del reporte">
      <KpiGrid columns={4}>
        <KpiColumn label="Total de personas" value={formatCount(kpis.total)} caption="Según los filtros aplicados" />
        <KpiColumn
          label="Edad promedio"
          value={kpis.average_age == null ? '—' : `${formatDecimal(kpis.average_age)} años`}
          caption={withoutBirthDate ? `${formatCount(withoutBirthDate)} sin fecha de nacimiento` : 'Sobre todas las personas'}
        />
        <PercentKpi label="Vacunación al día" value={kpis.vaccination_up_to_date} players={kpis.players} />
        <PercentKpi label="Con obra social" value={kpis.with_health_insurance} players={kpis.players} />
      </KpiGrid>
    </section>
  )
}
