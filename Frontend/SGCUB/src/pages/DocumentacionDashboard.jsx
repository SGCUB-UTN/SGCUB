import useDocumentacionPadron from '../hooks/useDocumentacionPadron'
import DocumentAffectedCategories from '../components/documental/DocumentAffectedCategories'
import DocumentStatusChart from '../components/documental/DocumentStatusChart'
import PadronComplianceChart from '../components/documental/PadronComplianceChart'
import PageHeader from '../components/shared/PageHeader'
import SectionHeading from '../components/shared/SectionHeading'
import { KpiGrid } from '../components/shared/Kpi'
import { HeadingSkeleton, LineSkeletons, RingSkeleton, SkeletonBlock, SkeletonStatus } from '../components/shared/Skeleton'

const PANEL_CLASS = 'min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm overflow-hidden'
const HEADING_CLASS = 'px-4 sm:px-5 border-b'
const SECTION_CLASS = 'p-4 sm:p-5'

function SummarySkeleton() {
  return (
    <SkeletonStatus label="Cargando resumen documental..." className={PANEL_CLASS}>
      <HeadingSkeleton />
      <div className={`${SECTION_CLASS} grid grid-cols-1 sm:grid-cols-3 gap-6`}>
        {[0, 1].map((index) => (
          <div key={index} className="flex items-center gap-4">
            <RingSkeleton size={120} stroke={16} />
            <LineSkeletons count={3} className="flex-1 flex flex-col gap-3" />
          </div>
        ))}
        <div className="flex flex-col gap-4">
          <SkeletonBlock soft className="h-3.5 w-40" />
          <LineSkeletons count={3} className="flex flex-col gap-4" />
        </div>
      </div>
    </SkeletonStatus>
  )
}

export default function DocumentacionDashboard() {
  const { isLoading, error, resumen } = useDocumentacionPadron()

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <div className="flex flex-col gap-1 max-w-3xl">
        <PageHeader breadcrumb={[{ label: 'Documental' }]} title="Control Documental" />
        <p className="font-body-md text-body-md text-on-surface-variant">
          Seguimiento de la documentación obligatoria de jugadores activos y docentes del club.
        </p>
      </div>

      {error && !resumen && (
        <p className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container" role="alert">
          No se pudo cargar el control documental.
        </p>
      )}

      {isLoading && <SummarySkeleton />}

      {resumen && (
        <section className={PANEL_CLASS} aria-labelledby="documental-summary-title">
          <SectionHeading id="documental-summary-title" icon="monitoring" title="Estado documental" className={HEADING_CLASS} />
          <div className={SECTION_CLASS}>
            <KpiGrid columns={3}>
              <PadronComplianceChart resumen={resumen} />
              <DocumentStatusChart counts={resumen.documentos} />
              <DocumentAffectedCategories categories={resumen.categorias_afectadas} />
            </KpiGrid>
          </div>
        </section>
      )}
    </div>
  )
}
