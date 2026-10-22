import { useEffect, useMemo, useState } from 'react'
import { getJugadores } from '../api/jugadores'
import { downloadDelinquencyPdf, getReporteMorosidad } from '../api/morosidad'
import { getSocios } from '../api/socios'
import MorosidadReport from '../components/finanzas/MorosidadReport'
import PageHeader from '../components/shared/PageHeader'
import { matchesSearch } from '../components/shared/search'

function Morosidad() {
  const [socios, setSocios] = useState([])
  const [jugadores, setJugadores] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [rosterError, setRosterError] = useState('')
  const [scope, setScope] = useState('activos')
  const [busqueda, setBusqueda] = useState('')
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('')
  const [seleccionados, setSeleccionados] = useState([])
  const [socioIndividual, setSocioIndividual] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [reporte, setReporte] = useState(null)
  const [generationError, setGenerationError] = useState('')
  const [reportFilters, setReportFilters] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  useEffect(() => {
    let activo = true
    Promise.all([getSocios(), getJugadores()])
      .then(([sociosRespuesta, jugadoresRespuesta]) => {
        if (!activo) return
        setSocios(sociosRespuesta ?? [])
        setJugadores(jugadoresRespuesta ?? [])
      })
      .catch(() => activo && setRosterError('No se pudieron cargar socios y categorías.'))
      .finally(() => activo && setIsLoading(false))
    return () => { activo = false }
  }, [])

  const categoriaPorSocio = useMemo(() => Object.fromEntries(
    jugadores.map((jugador) => [
      String(jugador.socio?.socio_id),
      typeof jugador.categoria === 'object' ? jugador.categoria?.nombre : '',
    ]),
  ), [jugadores])

  const categorias = useMemo(() => [...new Set(
    Object.values(categoriaPorSocio).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'es')), [categoriaPorSocio])

  const sociosFiltrados = useMemo(() => {
    const termino = busqueda.trim()
    return socios.filter((socio) => {
      const coincideTexto = !termino || matchesSearch(termino, [socio.nombre, socio.apellido, socio.dni, socio.numero_socio])
      const categoria = categoriaPorSocio[String(socio.socio_id)] || 'Sin categoría'
      const coincideCategoria = !categoriaSeleccionada || categoria === categoriaSeleccionada
      return coincideTexto && coincideCategoria
    })
  }, [busqueda, categoriaPorSocio, categoriaSeleccionada, socios])

  const generarReporte = async () => {
    if (scope === 'manual' && seleccionados.length === 0) {
      setGenerationError('Seleccioná al menos un socio para generar el reporte.')
      return
    }
    if (scope === 'socio' && !socioIndividual) {
      setGenerationError('Seleccioná el socio que querés consultar.')
      return
    }

    const filters = {
      alcance: scope,
      q: scope === 'filtrados' ? busqueda.trim() : '',
      categoria: scope === 'filtrados' ? categoriaSeleccionada : '',
      socioIds: scope === 'manual' ? seleccionados : [],
      socioId: scope === 'socio' ? socioIndividual : '',
    }

    setGenerationError('')
    setExportError('')
    setIsGenerating(true)
    try {
      const resultado = await getReporteMorosidad(filters)
      setReporte(resultado)
      setReportFilters(filters)
    } catch (requestError) {
      setGenerationError(requestError.response?.data?.detail || 'No se pudo generar el reporte de morosidad.')
    } finally {
      setIsGenerating(false)
    }
  }

  const exportPdf = async () => {
    if (!reportFilters) return
    setExportError('')
    setIsExporting(true)
    try {
      await downloadDelinquencyPdf(reportFilters)
    } catch (requestError) {
      setExportError(requestError.response?.data?.detail || 'No se pudo generar el PDF del reporte.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader breadcrumb={[{ label: 'Finanzas' }, { label: 'Reporte de morosidad' }]} title="Reporte de morosidad" />
      <MorosidadReport
        sociosFiltrados={sociosFiltrados}
        categorias={categorias}
        categoriaPorSocio={categoriaPorSocio}
        isLoading={isLoading}
        rosterError={rosterError}
        scope={scope}
        onScopeChange={setScope}
        busqueda={busqueda}
        onBusquedaChange={setBusqueda}
        categoriaSeleccionada={categoriaSeleccionada}
        onCategoriaChange={setCategoriaSeleccionada}
        seleccionados={seleccionados}
        onSeleccionadosChange={setSeleccionados}
        socioIndividual={socioIndividual}
        onSocioIndividualChange={setSocioIndividual}
        isGenerating={isGenerating}
        onGenerate={generarReporte}
        reporte={reporte}
        generationError={generationError}
        isExporting={isExporting}
        onExportPdf={exportPdf}
        exportError={exportError}
      />
    </div>
  )
}

export default Morosidad