import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSocio } from '../api/socios'
import { getEstadoCuenta } from '../api/estadoCuenta'
import PeriodSelector from '../components/cuota/PeriodSelector'
import { isValidPeriod } from '../components/cuota/cuotaPeriod'
import CashKpis from '../components/finanzas/CashKpis'
import PagoForm from '../components/finanzas/PagoForm'
import ComprobantesTable from '../components/finanzas/ComprobantesTable'
import ComprobanteDetailModal from '../components/finanzas/ComprobanteDetailModal'
import DevolucionDetailModal from '../components/finanzas/DevolucionDetailModal'
import OtroMovimientoModal from '../components/finanzas/OtroMovimientoModal'
import PageHeader from '../components/shared/PageHeader'
import SectionDivider from '../components/shared/SectionDivider'
import { currentPeriod, formatPeriod } from '../components/shared/periodFormat'

import useMovimientosCaja from '../hooks/useMovimientosCaja'
import useRegisterPayment from '../hooks/useRegisterPayment'
import { ErrorFile, LoadingFile } from '../components/personas/FileStatus'
import { isActiveStatus } from '../components/personas/format'

const SIN_SOCIO = { loading: false, socio: null, cuenta: null, error: null }

function Caja() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const socioId = searchParams.get('socio')
  const requestedPeriod = searchParams.get('periodo')
  const period = isValidPeriod(requestedPeriod) ? requestedPeriod : currentPeriod()
  const { openPayment } = useRegisterPayment()
  const [cargaSocio, setCarga] = useState({ loading: true, socio: null, cuenta: null, error: null })
  const carga = socioId ? cargaSocio : SIN_SOCIO
  const movimientos = useMovimientosCaja(period)
  const [comprobanteId, setComprobanteId] = useState(null)
  const [devolucionSeleccionada, setDevolucionSeleccionada] = useState(null)
  const [movimientoAbierto, setMovimientoAbierto] = useState(false)

  const recargarCaja = movimientos.reload

  const recargarCuenta = useCallback(() => {
    if (!socioId) return
    getEstadoCuenta(socioId)
      .then((cuenta) => setCarga((actual) => ({ ...actual, cuenta })))
      .catch(() => setCarga((actual) => ({ ...actual, error: 'No se pudo actualizar la cuenta corriente.' })))
  }, [socioId])

  const recargarTodo = useCallback(() => {
    recargarCaja()
    recargarCuenta()
  }, [recargarCaja, recargarCuenta])

  const changePeriod = (value) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.set('periodo', value)
    return next
  })

  useEffect(() => {
    if (!socioId) return undefined
    let activo = true
    Promise.all([getSocio(socioId), getEstadoCuenta(socioId)])
      .then(([socio, cuenta]) => activo && setCarga({ loading: false, socio, cuenta, error: null }))
      .catch(() => activo && setCarga({ loading: false, socio: null, cuenta: null, error: 'No se pudo cargar la cuenta corriente del socio.' }))
    return () => { activo = false }
  }, [socioId])

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Caja y cobros' }]}
        title="Caja y cobros"
        actions={<PeriodSelector value={period} onChange={changePeriod} />}
      />

      {carga.loading && socioId && <LoadingFile text="Cargando formulario de pago..." />}
      {!carga.loading && socioId && (carga.error || !carga.socio || !carga.cuenta) && (
        <ErrorFile
          message={carga.error || 'No se encontró la cuenta corriente.'}
          backTo="/padron/socios"
          backText="Volver a socios"
        />
      )}
      {!carga.loading && socioId && carga.socio && carga.cuenta && !isActiveStatus(carga.socio.estado_administrativo_nombre) && (
        <p className="p-4 bg-surface-container-low rounded-lg text-on-surface-variant">
          El socio está dado de baja. No se pueden registrar pagos a socios inactivos.
        </p>
      )}
      {!carga.loading && socioId && carga.socio && carga.cuenta && isActiveStatus(carga.socio.estado_administrativo_nombre) && (
        <PagoForm
          socio={carga.socio}
          cuenta={carga.cuenta}
          onCancel={() => navigate(`/padron/socios/${socioId}?tab=financiero`)}
          onSuccess={recargarCaja}
        />
      )}

      <SectionDivider>Resumen mensual</SectionDivider>

      <CashKpis
        period={period}
        comprobantes={movimientos.comprobantes}
        devoluciones={movimientos.devoluciones}
        isLoading={movimientos.isLoading}
        error={movimientos.error}
      />

      <ComprobantesTable
        period={period}
        comprobantes={movimientos.comprobantes}
        devoluciones={movimientos.devoluciones}
        isLoading={movimientos.isLoading}
        error={movimientos.error}
        onSelect={(comprobante) => setComprobanteId(comprobante.comprobante_id)}
        onSelectDevolucion={setDevolucionSeleccionada}
        onRegisterPayment={() => openPayment({ onSuccess: recargarCaja })}
        onRegisterMovement={() => setMovimientoAbierto(true)}
      />

      <ComprobanteDetailModal
        comprobanteId={comprobanteId}
        opened={Boolean(comprobanteId)}
        onClose={() => setComprobanteId(null)}
        onChanged={recargarTodo}
      />

      <DevolucionDetailModal
        devolucion={devolucionSeleccionada}
        opened={Boolean(devolucionSeleccionada)}
        onClose={() => setDevolucionSeleccionada(null)}
      />

      <OtroMovimientoModal
        opened={movimientoAbierto}
        initialSocio={carga.socio}
        onClose={() => setMovimientoAbierto(false)}
        onSuccess={recargarTodo}
      />
    </div>
  )
}

export default Caja
