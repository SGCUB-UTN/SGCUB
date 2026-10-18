import { useEffect, useMemo, useState } from 'react'
import { getComprobantes } from '../api/comprobantes'
import { getResumenFinanciero } from '../api/resumenFinanciero'
import { getSocios } from '../api/socios'
import { parseDueDate } from '../components/documental/dueDate'
import { getDocumentos, getTiposDocumento } from '../api/documentacion'

const UPCOMING_DAYS_WINDOW = 30

/**
 * Derives collection KPIs from the comprobantes list for the current calendar month.
 *
 * @param {Array} comprobantes - Full list of comprobantes returned by the API.
 * @returns {{ totalRecaudadoMes: number, mesLabel: string }}
 */
function calcularRecaudacionMes(comprobantes) {
  const ahora = new Date()
  const mesActual = ahora.getMonth()
  const anioActual = ahora.getFullYear()

  const totalRecaudadoMes = comprobantes
    .filter((comprobante) => {
      if (!comprobante.fecha_emision) return false
      const fecha = new Date(comprobante.fecha_emision)
      return fecha.getMonth() === mesActual && fecha.getFullYear() === anioActual
    })
    .reduce((acumulado, comprobante) => acumulado + Number(comprobante.monto_total ?? 0), 0)

  const mesLabel = ahora.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })

  return { totalRecaudadoMes, mesLabel }
}

/**
 * Classifies active documents into expired and upcoming-to-expire groups.
 *
 * @param {Array} documentos - Active documents from the documentacion API.
 * @returns {{ vencidos: Array, proximosAVencer: Array }}
 */
function clasificarDocumentos(documentos) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const docsConFecha = documentos.filter(
    (doc) => doc.persona_es_activo && doc.fecha_vencimiento,
  )

  const vencidos = []
  const proximosAVencer = []

  docsConFecha.forEach((doc) => {
    const parsed = parseDueDate(doc, today)
    const enriched = { ...doc, ...parsed }

    if (parsed.daysFromToday < 0) {
      vencidos.push({ ...enriched, diasVencido: Math.floor(-parsed.daysFromToday) })
    } else if (parsed.daysFromToday <= UPCOMING_DAYS_WINDOW) {
      proximosAVencer.push({ ...enriched, diasRestantes: Math.ceil(parsed.daysFromToday) })
    }
  })

  return { vencidos, proximosAVencer }
}

/**
 * Central data hook for the dashboard home page.
 *
 * Fetches all required data sources in parallel and exposes derived KPIs
 * for the financial summary, delinquency metrics and document alerts sections.
 */
export default function useDashboard() {
  const [resumenFinanciero, setResumenFinanciero] = useState(null)
  const [socios, setSocios] = useState([])
  const [comprobantes, setComprobantes] = useState([])
  const [documentos, setDocumentos] = useState([])
  const [tiposDocumento, setTiposDocumento] = useState([])

  const [isLoading, setIsLoading] = useState(true)
  const [errors, setErrors] = useState({
    resumenFinanciero: null,
    socios: null,
    comprobantes: null,
    documentos: null,
  })

  useEffect(() => {
    let active = true

    const cargar = async () => {
      setIsLoading(true)

      const results = await Promise.allSettled([
        getResumenFinanciero(),
        getSocios(),
        getComprobantes(),
        getDocumentos(''),
        getTiposDocumento(),
      ])

      if (!active) return

      const [
        resumenResult,
        sociosResult,
        comprobantesResult,
        documentosResult,
        tiposResult,
      ] = results

      setResumenFinanciero(resumenResult.status === 'fulfilled' ? resumenResult.value : null)
      setSocios(sociosResult.status === 'fulfilled' ? (sociosResult.value ?? []) : [])
      setComprobantes(comprobantesResult.status === 'fulfilled' ? (comprobantesResult.value ?? []) : [])
      setDocumentos(documentosResult.status === 'fulfilled' ? (documentosResult.value ?? []) : [])
      setTiposDocumento(tiposResult.status === 'fulfilled' ? (tiposResult.value ?? []) : [])

      setErrors({
        resumenFinanciero: resumenResult.status === 'rejected' ? resumenResult.reason : null,
        socios: sociosResult.status === 'rejected' ? sociosResult.reason : null,
        comprobantes: comprobantesResult.status === 'rejected' ? comprobantesResult.reason : null,
        documentos: documentosResult.status === 'rejected' ? documentosResult.reason : null,
      })

      setIsLoading(false)
    }

    cargar()
    return () => { active = false }
  }, [])

  // --- Derived: socios activos ---
  const sociosActivos = useMemo(
    () => socios.filter((socio) => {
      const estado = (socio.estado_administrativo_nombre ?? '').toLowerCase()
      return estado.includes('activo') && !estado.includes('inactivo')
    }),
    [socios],
  )

  // --- Derived: recaudación del mes actual ---
  const { totalRecaudadoMes, mesLabel } = useMemo(
    () => calcularRecaudacionMes(comprobantes),
    [comprobantes],
  )

  // --- Derived: documentos activos agrupados (most recent per person+type) ---
  const documentosActivos = useMemo(() => {
    if (!documentos.length) return []

    const grupos = {}
    documentos.forEach((doc) => {
      const clave = `${doc.persona}_${doc.tipo_documento}`
      if (!grupos[clave]) grupos[clave] = []
      grupos[clave].push(doc)
    })

    return Object.values(grupos).map(
      (grupo) => [...grupo].sort((a, b) => b.id_documento - a.id_documento)[0],
    )
  }, [documentos])

  const { vencidos, proximosAVencer } = useMemo(
    () => clasificarDocumentos(documentosActivos),
    [documentosActivos],
  )

  // --- Utility: resolve tipo documento name ---
  const getNombreTipo = (id) => {
    const tipo = tiposDocumento.find((t) => String(t.id_tipo_documento) === String(id))
    return tipo ? tipo.nombre : '—'
  }

  return {
    isLoading,
    errors,

    // Financial KPIs
    totalRecaudadoMes,
    mesLabel,
    sociosEnMora: resumenFinanciero?.socios_en_mora ?? null,
    montoAdeudadoTotal: resumenFinanciero?.monto_adeudado_total ?? null,
    cuotasVencidas: resumenFinanciero?.cuotas_vencidas ?? null,
    cuotasVencidas1: resumenFinanciero?.cuotas_vencidas_1 ?? null,
    cuotasVencidas2: resumenFinanciero?.cuotas_vencidas_2 ?? null,
    totalSociosActivos: sociosActivos.length,

    // Document alerts
    vencidos,
    proximosAVencer,
    getNombreTipo,
  }
}
