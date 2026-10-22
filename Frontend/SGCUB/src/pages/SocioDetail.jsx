import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { activateSocio, deactivateSocio, getSocio } from '../api/socios'
import ActivateSocioModal from '../components/socios/ActivateSocioModal'
import DeactivateSocioModal from '../components/socios/DeactivateSocioModal'
import PersonHeader, { ActivateButton, BenefitButton, DeactivateButton, EditButton, PayButton } from '../components/personas/HeaderPersona'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PersonalDataTab from '../components/personas/tabs/PersonalDataTab'
import { FinancialStatement } from '../components/personas/tabs/FinancialTab'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { socialStatus } from '../components/personas/profileStatus'
import { yearsSince, isActiveStatus, formatDni, formatDate, formatNumber, yearsText } from '../components/personas/format'
import { buildCuotaBadges } from '../components/finanzas/cuotaBadges'
import useLocalidades from '../hooks/useLocalidades'
import useAssignBenefit from '../hooks/useAssignBenefit'
import useRegisterPayment from '../hooks/useRegisterPayment'
import useSocioFinances from '../hooks/useSocioFinances'

function SocioDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? undefined
  const { localidades } = useLocalidades()
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()

  const [carga, setCarga] = useState({ id: null, datos: null, error: null })
  const loading = carga.id !== id
  const socio = carga.datos
  const error = carga.error

  // Loaded here so the tab badge and the financial tab share a single request
  const finances = useSocioFinances(socio?.socio_id)
  const refreshFinances = finances.reload
  const cuotaBadges = useMemo(() => buildCuotaBadges(finances.account), [finances.account])
  const financialFocusApplied = useRef(false)

  useEffect(() => {
    if (
      requestedTab !== 'financiero'
      || loading
      || finances.loading
      || !finances.account
      || financialFocusApplied.current
    ) return

    const cuotasHeading = document.getElementById('cuotas-title')
    if (!cuotasHeading) return

    financialFocusApplied.current = true
    cuotasHeading.focus({ preventScroll: true })
    cuotasHeading.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [finances.account, finances.loading, loading, requestedTab])

  const [modaldeactivateAbierto, setModaldeactivateAbierto] = useState(false)
  const [deactivate, setdeactivate] = useState(false)
  const [errorEliminacion, setErrorEliminacion] = useState('')
  const [modalActivarAbierto, setModalActivarAbierto] = useState(false)
  const [activando, setActivando] = useState(false)
  const [errorActivacion, setErrorActivacion] = useState('')

  useEffect(() => {
    let activo = true
    getSocio(id)
      .then((datos) => activo && setCarga({ id, datos, error: null }))
      .catch((requestError) => {
        if (activo) setCarga({ id, datos: null, error: requestError.response?.data?.detail || 'Error al cargar el detalle del socio.' })
      })
    return () => { activo = false }
  }, [id])

  const confirmarEliminacion = async () => {
    setdeactivate(true)
    setErrorEliminacion('')
    try {
      await deactivateSocio(socio.socio_id)
      setModaldeactivateAbierto(false)
      navigate('/padron/socios')
    } catch (requestError) {
      setErrorEliminacion(requestError.response?.data?.detail || 'No se pudo dar de baja al socio.')
    } finally {
      setdeactivate(false)
    }
  }

  const confirmarActivacion = async () => {
    setActivando(true)
    setErrorActivacion('')
    try {
      const actualizado = await activateSocio(socio.socio_id)
      setCarga((actual) => ({ ...actual, datos: actualizado }))
      setModalActivarAbierto(false)
    } catch (requestError) {
      setErrorActivacion(requestError.response?.data?.detail || 'No se pudo dar de alta al socio.')
    } finally {
      setActivando(false)
    }
  }

  if (loading) return <LoadingFile text="Cargando detalle del socio..." />
  if (error || !socio) {
    return <ErrorFile message={error || 'El socio solicitado no existe.'} backTo="/padron/socios" backText="Volver al padrón" />
  }
  if (socio.jugador_id) {
    return <Navigate to={`/padron/jugadores/${socio.jugador_id}`} replace state={{ from: 'socios' }} />
  }

  const activo = isActiveStatus(socio.estado_administrativo_nombre)

  const tabs = [
    {
      id: 'datos-personales',
      label: 'Datos personales',
      icon: 'person',
      content: <PersonalDataTab persona={socio} localidades={localidades} />,
    },
    {
      id: 'financiero',
      label: 'Financiero',
      icon: 'account_balance_wallet',
      badge: cuotaBadges,
      content: <FinancialStatement socio={socio} finances={finances} />,
    },
  ]

  return (
    <div className="flex flex-col w-full pb-8">
      <PersonHeader
        breadcrumb={[
          { label: 'Personas' },
          { label: 'Socios', to: '/padron/socios' },
          { label: `Socio ${formatNumber(socio.numero_socio)}` },
        ]}
        name={socio.nombre}
        surname={socio.apellido}
        statuses={[socialStatus(socio, finances.account)]}
        metadata={[
          { label: 'DNI', value: formatDni(socio.dni) },
          { label: 'Socio N°', value: formatNumber(socio.numero_socio), highlighted: true },
          { label: 'Alta', value: formatDate(socio.fecha_alta) },
          { label: 'Antigüedad', value: yearsText(yearsSince(socio.fecha_alta)) },
        ]}
        statusAction={activo ? (
          <DeactivateButton
            onClick={() => {
              setErrorEliminacion('')
              setModaldeactivateAbierto(true)
            }}
          />
        ) : (
          <ActivateButton
            onClick={() => {
              setErrorActivacion('')
              setModalActivarAbierto(true)
            }}
          />
        )}
        actions={activo && (
          <>
            <EditButton onClick={() => navigate(`/padron/socios/${socio.socio_id}/editar`)} />
            <BenefitButton variant="neutral" onClick={() => openBenefit({ socioId: socio.socio_id, onSuccess: refreshFinances })}>
              Beca o descuento
            </BenefitButton>
            <PayButton onClick={() => openPayment({ socioId: socio.socio_id, onSuccess: refreshFinances })} />
          </>
        )}
      />

      <PersonTabs key={`${id}-${requestedTab}`} tabs={tabs} defaultTab={requestedTab} />

      <ActivateSocioModal
        opened={modalActivarAbierto}
        onClose={() => !activando && setModalActivarAbierto(false)}
        onConfirm={confirmarActivacion}
        socio={socio}
        loading={activando}
        error={errorActivacion}
      />

      <DeactivateSocioModal
        opened={modaldeactivateAbierto}
        onClose={() => !deactivate && setModaldeactivateAbierto(false)}
        onConfirm={confirmarEliminacion}
        socio={socio}
        loading={deactivate}
        error={errorEliminacion}
      />
    </div>
  )
}

export default SocioDetail
