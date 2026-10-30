import { useEffect, useMemo, useState } from 'react'
import { downloadDelinquencyPdf, getReporteMorosidad } from '../api/morosidad'
import MorosidadFilters from '../components/finanzas/MorosidadFilters'
import MorosidadReport from '../components/finanzas/MorosidadReport'
import { defaultReference } from '../components/finanzas/delinquencyFilters'
import PageHeader from '../components/shared/PageHeader'
import SectionHeading from '../components/shared/SectionHeading'
import { SecondaryButton } from '../components/personas/tabs/parts'
import useCategorias from '../hooks/useCategorias'

const PANEL_CLASS = 'min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm overflow-hidden'
const HEADING_CLASS = 'px-4 sm:px-5 border-b'
const SECTION_CLASS = 'p-4 sm:p-5'

const INITIAL_FILTERS = { periodo: 'anual', referencia: defaultReference('anual'), alcance: 'activos', categoriaId: '', tipo: 'todos' }

const isReady = (filters, socio) => (
  (filters.alcance !== 'categoria' || Boolean(filters.categoriaId))
  && (filters.alcance !== 'socio' || Boolean(socio))
)

function Morosidad() {
  const { categorias } = useCategorias()
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [socio, setSocio] = useState(null)
  const [result, setResult] = useState({ key: null, reporte: null, error: '' })
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const requestFilters = useMemo(() => ({ ...filters, socioId: socio?.socio_id ?? '' }), [filters, socio])
  const requestKey = JSON.stringify(requestFilters)
  const ready = isReady(filters, socio)
  const isLoading = ready && result.key !== requestKey

  useEffect(() => {
    if (!ready) return undefined
    let active = true
    const key = JSON.stringify(requestFilters)
    getReporteMorosidad(requestFilters)
      .then((reporte) => active && setResult({ key, reporte, error: '' }))
      .catch((requestError) => active && setResult({
        key,
        reporte: null,
        error: requestError.response?.data?.detail || 'No se pudo generar el reporte de morosidad.',
      }))
    return () => { active = false }
  }, [ready, requestFilters])

  const changeFilters = (changes) => {
    setExportError('')
    setFilters((current) => {
      const next = { ...current, ...changes }
      if (changes.periodo && changes.periodo !== current.periodo) next.referencia = defaultReference(changes.periodo)
      return next
    })
  }

  const exportPdf = async () => {
    setExportError('')
    setIsExporting(true)
    try {
      await downloadDelinquencyPdf(requestFilters)
    } catch (requestError) {
      setExportError(requestError.response?.data?.detail || 'No se pudo generar el PDF del reporte.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Reporte de morosidad' }]}
        title="Reporte de morosidad"
        actions={(
          <SecondaryButton
            icon={isExporting ? 'progress_activity' : 'picture_as_pdf'}
            onClick={exportPdf}
            disabled={!ready || isLoading || isExporting || !result.reporte}
          >
            {isExporting ? 'Generando PDF...' : 'Exportar PDF'}
          </SecondaryButton>
        )}
      />
      {exportError && <p className="text-sm text-error" role="alert">{exportError}</p>}

      <section className={PANEL_CLASS} aria-labelledby="morosidad-filters-title">
        <SectionHeading id="morosidad-filters-title" icon="filter_alt" title="Filtros" className={HEADING_CLASS} />
        <div className={SECTION_CLASS}>
          <MorosidadFilters
            filters={filters}
            onChange={changeFilters}
            categorias={categorias}
            socio={socio}
            onSocioChange={setSocio}
          />
        </div>
      </section>

      {ready ? (
        <MorosidadReport reporte={result.reporte} isLoading={isLoading} error={result.error} />
      ) : (
        <p className="py-12 text-center border-2 border-dashed border-outline-variant/50 rounded-md text-on-surface-variant">
          {filters.alcance === 'categoria' ? 'Elegí una categoría para ver su morosidad.' : 'Buscá el socio que querés consultar.'}
        </p>
      )}
    </div>
  )
}

export default Morosidad
