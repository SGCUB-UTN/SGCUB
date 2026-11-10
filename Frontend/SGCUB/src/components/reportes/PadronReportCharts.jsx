import DistributionBars from './DistributionBars'
import DistributionDonut from './DistributionDonut'
import MembershipEvolutionChart from './MembershipEvolutionChart'
import ReportKpis from './ReportKpis'
import { STATUS_COLORS, seriesColors } from './reportCharts'

const TOP_LIMIT = 5
const CATEGORY_LIMIT = 8
const PLAYERS_CAPTION = 'Solo jugadores'

export default function PadronReportCharts({ report }) {
  const { kpis, charts, evolution } = report

  return (
    <div className="flex flex-col gap-4">
      <ReportKpis kpis={kpis} ageRanges={charts.age_ranges} />

      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionDonut title="Roles" items={charts.roles} colors={seriesColors(charts.roles)} />
        <DistributionDonut
          title="Vacunación"
          caption={PLAYERS_CAPTION}
          items={charts.vaccination}
          colors={STATUS_COLORS.vaccination}
          centerCaption="jugadores"
          emptyLabel="No hay jugadores en el reporte"
        />
        <DistributionDonut title="Género" items={charts.gender} colors={seriesColors(charts.gender)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionBars title="Rangos de edad" items={charts.age_ranges} />
        <DistributionBars
          title={`Top ${TOP_LIMIT} localidades`}
          items={charts.localities}
          total={kpis.total}
          limit={TOP_LIMIT}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <DistributionBars
          title="Nivel educativo"
          caption={PLAYERS_CAPTION}
          items={charts.education}
          hideEmpty
          emptyLabel="No hay jugadores en el reporte."
        />
        <DistributionBars
          title="Obra social"
          caption={PLAYERS_CAPTION}
          items={charts.health_insurance}
          limit={TOP_LIMIT}
          emptyLabel="No hay jugadores en el reporte."
        />
        <DistributionDonut
          title="Estado documental"
          caption="Jugadores y docentes activos"
          items={charts.documentation}
          colors={STATUS_COLORS.documentation}
          emptyLabel="Sin jugadores ni docentes activos"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DistributionBars
          title="Categorías"
          caption="Una persona puede estar en más de una categoría"
          items={charts.categories}
          total={kpis.total}
          limit={CATEGORY_LIMIT}
          emptyLabel="Nadie del reporte tiene categoría asignada."
        />
        <DistributionBars
          title="Antigüedad como socio"
          caption="Solo socios"
          items={charts.seniority}
          emptyLabel="No hay socios en el reporte."
        />
      </div>

      <MembershipEvolutionChart evolution={evolution} />
    </div>
  )
}
