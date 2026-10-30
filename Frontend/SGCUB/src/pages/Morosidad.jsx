import { useEffect, useMemo, useState } from 'react'
import { downloadDelinquencyPdf, getReporteMorosidad } from '../api/morosidad'
import MorosidadFilters from '../components/finanzas/MorosidadFilters'
import MorosidadReport from '../components/finanzas/MorosidadReport'
import { defaultReference } from '../components/finanzas/delinquencyFilters'
import PageHeader from '../components/shared/PageHeader'
import { SecondaryButton } from '../components/personas/tabs/parts'
import useCategorias from '../hooks/useCategorias'

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
    <div className="w-full flex flex-col pb-8">
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
      {exportError && <p className="mb-2 text-sm text-error" role="alert">{exportError}</p>}

      <div className="mt-4">
        <MorosidadFilters
          filters={filters}
          onChange={changeFilters}
          categorias={categorias}
          socio={socio}
          onSocioChange={setSocio}
        />
      </div>

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
