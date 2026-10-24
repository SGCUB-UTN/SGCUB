import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getSocio } from '../api/socios'
import { getEstadoCuenta } from '../api/estadoCuenta'
import { getComprobante, getComprobantes } from '../api/comprobantes'
import PagoForm from '../components/finanzas/PagoForm'
import ComprobantesTable from '../components/finanzas/ComprobantesTable'
import ComprobanteDetailModal from '../components/finanzas/ComprobanteDetailModal'
import AmendPagoModal from '../components/finanzas/AmendPagoModal'
import MovimientoManualModal from '../components/finanzas/MovimientoManualModal'
import PageHeader from '../components/shared/PageHeader'
import SocioPicker from '../components/finanzas/SocioPicker'
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
  const [comprobanteSeleccionado, setComprobanteSeleccionado] = useState(null)
  const [detalleComprobante, setDetalleComprobante] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [errorDetalle, setErrorDetalle] = useState(null)
  const [pagoEnCorreccion, setPagoEnCorreccion] = useState(null)
  const [movimientoManualAbierto, setMovimientoManualAbierto] = useState(false)

  const cargarComprobantes = useCallback(async () => {
    try {
      setCargaComprobantes({ loading: true, error: null })
      setComprobantes(await getComprobantes())
      setCargaComprobantes({ loading: false, error: null })
    } catch {
      setCargaComprobantes({ loading: false, error: 'No se pudieron cargar los comprobantes.' })
    }
  }, [])

  useEffect(() => {
    cargarComprobantes()
  }, [cargarComprobantes])

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
      setCarga({ loading: false, socio: null, cuenta: null, error: 'Seleccioná un socio desde su estado de cuenta para registrar un pago.' })
      return () => { activo = false }
    }
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
        actions={(
          <div className="flex flex-wrap gap-2">
            <PrimaryButton icon="add_card" onClick={() => setMovimientoManualAbierto(true)}>Otros movimientos</PrimaryButton>
            <PrimaryButton icon="payments" onClick={() => openPayment({ onSuccess: cargarComprobantes })}>Registrar pago</PrimaryButton>
          </div>
        )}
      />
      {carga.loading && socioId && <LoadingFile text="Cargando formulario de pago..." />}
      {!carga.loading && socioId && (carga.error || !carga.socio || !carga.cuenta) && <ErrorFile message={carga.error || 'No se encontró la cuenta corriente.'} backTo="/finanzas/estado-cuenta" backText="Volver a estado de cuenta" />}
      {!carga.loading && socioId && carga.socio && carga.cuenta && !isActiveStatus(carga.socio.estado_administrativo_nombre) && (
        <p className="p-4 bg-surface-container-low rounded-lg text-on-surface-variant">El socio está dado de baja. No se pueden registrar pagos a socios inactivos.</p>
      )}
      {!carga.loading && socioId && carga.socio && carga.cuenta && isActiveStatus(carga.socio.estado_administrativo_nombre) && <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm"><PagoForm socio={carga.socio} cuenta={carga.cuenta} onCancel={() => navigate(`/finanzas/estado-cuenta?socio=${socioId}`)} onSuccess={cargarComprobantes} /></section>}
      {!socioId && (
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-sm">
          <SocioPicker onSelect={(socio) => navigate(`/caja?socio=${socio.socio_id}`)} description="Elegí el socio al que le vas a registrar el pago." />
        </section>
      )}
      <ComprobantesTable comprobantes={comprobantes} isLoading={cargaComprobantes.loading} error={cargaComprobantes.error} onSelect={seleccionarComprobante} />
      <ComprobanteDetailModal comprobante={comprobanteSeleccionado} detalle={detalleComprobante} loading={cargandoDetalle} error={errorDetalle} opened={Boolean(comprobanteSeleccionado)} onClose={() => setComprobanteSeleccionado(null)} onCorrect={setPagoEnCorreccion} />
      <AmendPagoModal
        key={pagoEnCorreccion?.pago_id ?? 'closed'}
        comprobante={comprobanteSeleccionado}
        pago={pagoEnCorreccion}
        detail={detalleComprobante}
        opened={Boolean(pagoEnCorreccion)}
        onClose={() => setPagoEnCorreccion(null)}
        onSuccess={async () => {
          await cargarComprobantes()
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
        initialSocio={carga.socio}
        onClose={() => setMovimientoManualAbierto(false)}
        onSuccess={() => {
          cargarComprobantes()
          if (socioId) getEstadoCuenta(socioId).then((cuenta) => setCarga((actual) => ({ ...actual, cuenta }))).catch(() => {})
        }}
      />
    </div>
  )
}

export default Caja