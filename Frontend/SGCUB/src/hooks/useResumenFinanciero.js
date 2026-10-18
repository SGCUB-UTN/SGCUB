import { useEffect, useMemo, useState } from 'react'
import { getComprobantes } from '../api/comprobantes'
import { getCuotas } from '../api/cuotas'
import { getResumenFinanciero } from '../api/resumenFinanciero'
import { formatPeriod, periodOptions } from '../components/shared/periodFormat'
import { CUOTA_STATES, countByState, cuotaState, isOverdue } from '../components/finanzas/cuotaStates'

// Local 'YYYY-MM' of today (toISOString would use UTC and may shift the month)
function currentPeriod() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

export default function useResumenFinanciero() {
  const [resumen, setResumen] = useState(null)
  const [cuotas, setCuotas] = useState([])
  const [comprobantes, setComprobantes] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errors, setErrors] = useState({})
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod)

  useEffect(() => {
    let active = true

    const loadAll = async () => {
      const [resumenResult, cuotasResult, comprobantesResult] = await Promise.allSettled([
        getResumenFinanciero(),
        getCuotas(),
        getComprobantes(),
      ])

      if (!active) return

      if (resumenResult.status === 'fulfilled') {
        setResumen(resumenResult.value)
      } else {
        setErrors((prev) => ({ ...prev, resumen: resumenResult.reason }))
      }

      if (cuotasResult.status === 'fulfilled') {
        setCuotas(cuotasResult.value)
      } else {
        setErrors((prev) => ({ ...prev, cuotas: cuotasResult.reason }))
      }

      if (comprobantesResult.status === 'fulfilled') {
        setComprobantes(comprobantesResult.value)
      } else {
        setErrors((prev) => ({ ...prev, comprobantes: comprobantesResult.reason }))
      }

      if (active) setIsLoading(false)
    }

    loadAll()
    return () => { active = false }
  }, [])

  // The current month is always offered, even before its cuotas are generated
  const availablePeriods = useMemo(
    () => periodOptions([...cuotas, { periodo: currentPeriod() }], (c) => c.periodo),
    [cuotas],
  )

  const selectedPeriodLabel = useMemo(() => formatPeriod(selectedPeriod), [selectedPeriod])

  const periodKpis = useMemo(() => {
    const periodCuotas = cuotas.filter((c) => c.periodo === selectedPeriod)
    const cuotasGeneradas = periodCuotas.length
    const cuotasPagas = countByState(periodCuotas, CUOTA_STATES.PAGA)

    let totalRecaudadoPeriodo = 0
    if (selectedPeriod) {
      const [year, month] = selectedPeriod.split('-').map(Number)
      totalRecaudadoPeriodo = comprobantes
        .filter((c) => {
          if (!c.fecha_emision || c.estado === 'Anulado') return false
          const d = new Date(c.fecha_emision)
          return d.getFullYear() === year && d.getMonth() + 1 === month
        })
        .reduce((sum, c) => sum + Number(c.monto_total ?? 0), 0)
    }

    return {
      cuotasGeneradas,
      cuotasPagas,
      cuotasImpagas: cuotasGeneradas - cuotasPagas,
      totalRecaudadoPeriodo,
    }
  }, [cuotas, comprobantes, selectedPeriod])

  const debtorRows = useMemo(() => {
    const bySocio = new Map()

    cuotas.forEach((cuota) => {
      const pending = Number(cuota.saldo_pendiente ?? 0)
      if (pending <= 0 || cuotaState(cuota) === CUOTA_STATES.PAGA) return

      const socio = cuota.socio
      if (!socio) return
      const id = socio.socio_id

      if (!bySocio.has(id)) {
        bySocio.set(id, {
          socio_id: id,
          jugador_id: socio.jugador_id ?? null,
          numero_socio: socio.numero_socio,
          nombre: socio.nombre,
          apellido: socio.apellido,
          dni: socio.dni,
          deudaEnFecha: 0,
          cuotasVencidas: 0,
          cuotasVencidas1: 0,
          cuotasVencidas2: 0,
          deudaVencida: 0,
        })
      }

      const row = bySocio.get(id)
      const estado = cuotaState(cuota)
      if (estado === CUOTA_STATES.EN_FECHA) {
        row.deudaEnFecha += pending
      } else if (isOverdue(cuota)) {
        row.cuotasVencidas += 1
        if (estado === CUOTA_STATES.VENCIDA_2) row.cuotasVencidas2 += 1
        else row.cuotasVencidas1 += 1
        row.deudaVencida += pending
      }
    })

    return [...bySocio.values()].sort((a, b) =>
      `${a.apellido} ${a.nombre}`.localeCompare(`${b.apellido} ${b.nombre}`, 'es'),
    )
  }, [cuotas])

  return {
    isLoading,
    errors,
    resumen,
    selectedPeriod,
    setSelectedPeriod,
    availablePeriods,
    selectedPeriodLabel,
    periodKpis,
    debtorRows,
  }
}
