import { useState } from 'react'
import { downloadReportePadron } from '../api/reportesPadron'
import PadronReportCharts from '../components/reportes/PadronReportCharts'
import PadronReportFilters from '../components/reportes/PadronReportFilters'
import { INITIAL_FILTERS, activeFilterCount, sameFilters } from '../components/reportes/reportFilters'
import { EmptyState, SecondaryButton } from '../components/personas/tabs/parts'
import PageHeader from '../components/shared/PageHeader'
import SectionHeading from '../components/shared/SectionHeading'
import { SkeletonBlock, SkeletonStatus } from '../components/shared/Skeleton'
import { PANEL_BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS } from '../components/shared/panel'
import { TEXT_BUTTON_CLASS } from '../components/shared/textButton'
import useReportePadron from '../hooks/useReportePadron'

const EXPORT_LABELS = { pdf: 'PDF', csv: 'CSV' }

function FilterCountBadge({ count }) {
  if (!count) return null
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold tabular-nums">
      {count} {count === 1 ? 'filtro activo' : 'filtros activos'}
    </span>
  )
}

function ReportSkeleton() {
  return (
    <SkeletonStatus label="Generando reporte..." className="flex flex-col gap-4">
      <SkeletonBlock className="h-28 w-full" soft />
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((index) => <SkeletonBlock key={index} className="h-52" soft />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((index) => <SkeletonBlock key={index} className="h-52" soft />)}
      </div>
    </SkeletonStatus>
  )
}

function ReportesPadron() {
  const [draft, setDraft] = useState(INITIAL_FILTERS)
  const [applied, setApplied] = useState(INITIAL_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(true)
  const [exporting, setExporting] = useState(null)
  const [exportError, setExportError] = useState('')
  const { report, error, isLoading } = useReportePadron(applied)

  const pendingChanges = !sameFilters(draft, applied)
  const canClear = !sameFilters(draft, INITIAL_FILTERS) || !sameFilters(applied, INITIAL_FILTERS)

  const changeDraft = (changes) => setDraft((current) => ({ ...current, ...changes }))

  const apply = () => {
    setExportError('')
    setApplied(draft)
  }

  const clear = () => {
    setExportError('')
    setDraft(INITIAL_FILTERS)
    setApplied(INITIAL_FILTERS)
  }

  const exportReport = async (format) => {
    setExportError('')
    setExporting(format)
    try {
      await downloadReportePadron(applied, format)
    } catch (requestError) {
      setExportError(requestError.response?.data?.detail || `No se pudo generar el ${EXPORT_LABELS[format]} del reporte.`)
    } finally {
      setExporting(null)
    }
  }

  const exportButton = (format, icon) => (
    <SecondaryButton
      icon={exporting === format ? 'progress_activity' : icon}
      onClick={() => exportReport(format)}
      disabled={isLoading || exporting !== null || !report}
    >
      {exporting === format ? `Generando ${EXPORT_LABELS[format]}...` : `Exportar ${EXPORT_LABELS[format]}`}
    </SecondaryButton>
  )

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Personas' }, { label: 'Reportes' }]}
        title="Reportes del padrón"
        actions={(
          <>
            {exportButton('pdf', 'picture_as_pdf')}
            {exportButton('csv', 'table_view')}
          </>
        )}
      />
      {exportError && <p className="text-sm text-error" role="alert">{exportError}</p>}

      <section className={PANEL_CLASS} aria-labelledby="padron-report-filters-title">
        <SectionHeading
          id="padron-report-filters-title"
          icon="filter_alt"
          title="Filtros"
          className={PANEL_HEADING_CLASS}
          actions={(
            <>
              {pendingChanges && <span className="text-sm text-on-surface-variant">Hay cambios sin aplicar</span>}
              <FilterCountBadge count={activeFilterCount(applied)} />
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                aria-expanded={filtersOpen}
                aria-controls="padron-report-filters"
                className={`${TEXT_BUTTON_CLASS} text-sm`}
              >
                {filtersOpen ? 'Ocultar' : 'Mostrar'}
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">
                  {filtersOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>
            </>
          )}
        />
        {filtersOpen && (
          <div id="padron-report-filters" className={PANEL_BODY_CLASS}>
            <PadronReportFilters
              filters={draft}
              onChange={changeDraft}
              onApply={apply}
              onClear={clear}
              canApply={pendingChanges}
              canClear={canClear}
            />
          </div>
        )}
      </section>

      {error ? (
        <p className="text-sm text-error" role="alert">{error}</p>
      ) : !report ? (
        <ReportSkeleton />
      ) : (
        <div aria-busy={isLoading} className={`transition-opacity duration-150 ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}>
          {report.kpis.total === 0 ? (
            <EmptyState icon="person_search" title="Sin resultados" description="No hay personas que cumplan con los filtros aplicados." />
          ) : (
            <PadronReportCharts report={report} />
          )}
        </div>
      )}
    </div>
  )
}

export default ReportesPadron
