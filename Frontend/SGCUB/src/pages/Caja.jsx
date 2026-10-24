import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSocio } from '../api/socios'
import { getEstadoCuenta } from '../api/estadoCuenta'
import { getComprobante, getComprobantes } from '../api/comprobantes'
import { getMovimientos } from '../api/movimientos'
import PagoForm from '../components/finanzas/PagoForm'
import ComprobantesTable from '../components/finanzas/ComprobantesTable'
import ComprobanteDetailModal from '../components/finanzas/ComprobanteDetailModal'
import MovimientoManualDetailModal from '../components/finanzas/MovimientoManualDetailModal'
import AmendPagoModal from '../components/finanzas/AmendPagoModal'
import MovimientoManualModal from '../components/finanzas/MovimientoManualModal'
import PageHeader from '../components/shared/PageHeader'
import { PrimaryButton } from '../components/personas/tabs/parts'
import useRegisterPayment from '../hooks/useRegisterPayment'
import { ErrorFile, LoadingFile } from '../components/personas/FileStatus'
import { isActiveStatus } from '../components/personas/format'

function Caja() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const socioId = searchParams.get('socio')
  const { openPayment } = useRegisterPayment()
  const [carga, setCarga] = useState({ loading: true, socio: null, cuenta: null, error: null })
  const [comprobantes, setComprobantes] = useState([])
  const [cargaComprobantes, setCargaComprobantes] = useState({ loading: true, error: null })
  const [movimientosManuales, setMovimientosManuales] = useState([])
  const [cargaMovimientos, setCargaMovimientos] = useState({ loading: true, error: null })
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState(null)
  const [detalleComprobante, setDetalleComprobante] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState(null)
  const [pagoEnCorreccion, setPagoEnCorreccion] = useState(null)
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null)
  const [movimientoManualAbierto, setMovimientoManualAbierto] = useState(false)
  const [ingresoARevertir, setIngresoARevertir] = useState(null)

  const cargarComprobantes = useCallback(async () => {
    try {
      setCargaComprobantes({ loading: true, error: null })
      setComprobantes(await getComprobantes())
      setCargaComprobantes({ loading: false, error: null })
    } catch {
      setCargaComprobantes({ loading: false, error: 'No se pudieron cargar los comprobantes.' })
    }
  }, [])

  const cargarMovimientosManuales = useCallback(async () => {
    try {
      setCargaMovimientos({ loading: true, error: null })
      setMovimientosManuales(await getMovimientos(null, { soloManuales: true }))
      setCargaMovimientos({ loading: false, error: null })
    } catch {
      setCargaMovimientos({ loading: false, error: 'No se pudieron cargar los movimientos manuales.' })
    }
  }, [])

  const recargarCaja = useCallback(async () => {
    await Promise.all([cargarComprobantes(), cargarMovimientosManuales()])
  }, [cargarComprobantes, cargarMovimientosManuales])

  useEffect(() => {
    recargarCaja()
  }, [recargarCaja])

  const seleccionarComprobante = async (comprobante) => {
    setComprobanteSeleccionado(comprobante)
    setDetalleComprobante(null)
    setErrorDetalle(null)
    setCargandoDetalle(true)
    try {
      setDetalleComprobante(await getComprobante(comprobante.comprobante_id))
    } catch {
      setErrorDetalle('No se pudo cargar el detalle.')
    } finally {
      setCargandoDetalle(false)
    }
  }

  useEffect(() => {
    let activo = true
    if (!socioId) {
      setCarga({ loading: false, socio: null, cuenta: null, error: null })
      return () => { activo = false }
    }
    Promise.all([getSocio(socioId), getEstadoCuenta(socioId)])
      .then(([socio, cuenta]) => activo && setCarga({ loading: false, socio, cuenta, error: null }))
      .catch(() => activo && setCarga({ loading: false, socio: null, cuenta: null, error: 'No se pudo cargar la cuenta corriente del socio.' }))
    return () => { activo = false }
  }, [socioId])

  const abrirModalMovimientoManual = (reversedMovement = null) => {
    setIngresoARevertir(reversedMovement)
    setMovimientoManualAbierto(true)
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Caja y cobros' }]}
        title="Caja y cobros"
        actions={(
          <div className="flex flex-wrap gap-2">
            <PrimaryButton icon="add_card" onClick={() => abrirModalMovimientoManual(null)}>
              Otros movimientos
            </PrimaryButton>
            <PrimaryButton icon="payments" onClick={() => openPayment({ onSuccess: recargarCaja })}>
              Registrar pago
            </PrimaryButton>
          </div>
        )}
      />

      {carga.loading && socioId && <LoadingFile text="Cargando formulario de pago..." />}
      {!carga.loading && socioId && (carga.error || !carga.socio || !carga.cuenta) && (
        <ErrorFile
          message={carga.error || 'No se encontró la cuenta corriente.'}
          backTo="/finanzas/estado-cuenta"
          backText="Volver a estado de cuenta"
        />
      )}
      {!carga.loading && socioId && carga.socio && carga.cuenta && !isActiveStatus(carga.socio.estado_administrativo_nombre) && (
        <p className="p-4 bg-surface-container-low rounded-lg text-on-surface-variant">
          El socio está dado de baja. No se pueden registrar pagos a socios inactivos.
        </p>
      )}
      {!carga.loading && socioId && carga.socio && carga.cuenta && isActiveStatus(carga.socio.estado_administrativo_nombre) && (
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <PagoForm
            socio={carga.socio}
            cuenta={carga.cuenta}
            onCancel={() => navigate(`/finanzas/estado-cuenta?socio=${socioId}`)}
            onSuccess={recargarCaja}
          />
        </section>
      )}

      <ComprobantesTable
        comprobantes={comprobantes}
        movimientosManuales={movimientosManuales}
        isLoading={cargaComprobantes.loading || cargaMovimientos.loading}
        error={cargaComprobantes.error || cargaMovimientos.error}
        onSelect={seleccionarComprobante}
        onSelectMovimiento={setMovimientoSeleccionado}
      />

      <ComprobanteDetailModal
        comprobante={comprobanteSeleccionado}
        detalle={detalleComprobante}
        loading={cargandoDetalle}
        error={errorDetalle}
        opened={Boolean(comprobanteSeleccionado)}
        onClose={() => setComprobanteSeleccionado(null)}
        onCorrect={setPagoEnCorreccion}
      />

      <MovimientoManualDetailModal
        movimiento={movimientoSeleccionado}
        movimientos={movimientosManuales}
        opened={Boolean(movimientoSeleccionado)}
        onClose={() => setMovimientoSeleccionado(null)}
        onSelectMovimiento={setMovimientoSeleccionado}
        onIssueCreditNote={(movimiento) => {
          setMovimientoSeleccionado(null)
          abrirModalMovimientoManual(movimiento)
        }}
      />

      <AmendPagoModal
        key={pagoEnCorreccion?.pago_id ?? 'closed'}
        comprobante={comprobanteSeleccionado}
        pago={pagoEnCorreccion}
        detail={detalleComprobante}
        opened={Boolean(pagoEnCorreccion)}
        onClose={() => setPagoEnCorreccion(null)}
        onSuccess={async () => {
          await recargarCaja()
          if (socioId) {
            try {
              const cuentaActualizada = await getEstadoCuenta(socioId)
              setCarga((actual) => ({ ...actual, cuenta: cuentaActualizada }))
            } catch {
              setCarga((actual) => ({
                ...actual,
                error: 'La corrección se registró, pero no se pudo actualizar la cuenta corriente.',
              }))
            }
          }
          setPagoEnCorreccion(null)
          setComprobanteSeleccionado(null)
        }}
      />

      <MovimientoManualModal
        opened={movimientoManualAbierto}
        initialSocio={ingresoARevertir?.socio ?? carga.socio}
        initialReversedMovement={ingresoARevertir}
        onClose={() => {
          setMovimientoManualAbierto(false)
          setIngresoARevertir(null)
        }}
        onSuccess={() => {
          recargarCaja()
          if (socioId) {
            getEstadoCuenta(socioId)
              .then((cuenta) => setCarga((actual) => ({ ...actual, cuenta })))
              .catch(() => {})
          }
        }}
      />
    </div>
  )
}

export default Caja
