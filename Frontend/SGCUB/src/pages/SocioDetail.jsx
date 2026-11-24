import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { activateSocio, deactivateSocio, getSocio } from '../api/socios'
import PersonStatusModal from '../components/personas/PersonStatusModal'
import PersonHeader, { ActivateButton, DeactivateButton, LockedProfileNotice, PayButton } from '../components/personas/HeaderPersona'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PersonalDataTab from '../components/personas/tabs/PersonalDataTab'
import { FinancialStatement } from '../components/personas/tabs/FinancialTab'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { memberStatuses } from '../components/personas/profileStatus'
import { yearsSince, isActiveStatus, formatDni, formatDate, formatNumber, yearsText, getErrorMessage } from '../components/personas/format'
import { buildCuotaBadges } from '../components/finanzas/cuotaBadges'
import { hasPendingDebt, pendingDebt } from '../components/finanzas/accountStatement'
import { currentPeriod } from '../components/shared/periodFormat'
import { formatMoney } from '../components/cuota/cuotaPeriod'
import useLocalidades from '../hooks/useLocalidades'
import useRegisterPayment from '../hooks/useRegisterPayment'
import useSocioFinances from '../hooks/useSocioFinances'
import useToast from '../hooks/useToast'
import { downloadImage, buildPhotoFilename } from '../utils/downloadImage'
import { uploadPersonaFoto } from '../api/personaFoto'

function SocioDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? undefined
  const { localidades } = useLocalidades()
  const { openPayment } = useRegisterPayment()
  const { showToast } = useToast()

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
      const actualizado = await getSocio(socio.socio_id)
      setCarga((actual) => ({ ...actual, datos: actualizado }))
      refreshFinances()
      setModaldeactivateAbierto(false)
      showToast({ title: 'Socio dado de baja', description: `${socio.nombre} ${socio.apellido} quedó de baja. La ficha pasa a solo lectura.` })
    } catch (requestError) {
      setErrorEliminacion(getErrorMessage(requestError, 'No se pudo dar de baja al socio.'))
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
      refreshFinances()
      setModalActivarAbierto(false)
      showToast({ title: 'Socio dado de alta', description: `${socio.nombre} ${socio.apellido} vuelve a estar activo.` })
    } catch (requestError) {
      setErrorActivacion(getErrorMessage(requestError, 'No se pudo dar de alta al socio.'))
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
  const puedePagar = activo || hasPendingDebt(finances.account)
  const nombreSocio = `${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim()
  const deuda = pendingDebt(finances.account, currentPeriod())
  const avisoDeuda = deuda > 0 && `Tiene un saldo adeudado de ${formatMoney(deuda)}: la deuda se conserva y se puede seguir pagando.`

  const handleDownloadPhoto = async () => {
    if (!socio.foto_url) return
    try {
      await downloadImage(socio.foto_url, buildPhotoFilename(socio.foto_url, socio.nombre, socio.apellido))
    } catch (err) {
      console.error(err)
      showToast({ tone: 'error', title: 'No se pudo descargar la foto', description: 'Probá de nuevo en unos minutos.' })
    }
  }

  const handleUploadPhoto = async (file) => {
    const personaId = socio.persona?.persona_id || socio.persona
    if (!personaId) return
    const personaActualizada = await uploadPersonaFoto(personaId, file)
    setCarga((actual) => ({ ...actual, datos: { ...actual.datos, foto_url: personaActualizada.foto_url } }))
  }

  const tabs = [
    {
      id: 'datos-personales',
      label: 'Datos personales',
      icon: 'person',
      content: (
        <PersonalDataTab
          persona={socio}
          localidades={localidades}
          onEdit={activo ? () => navigate(`/padron/socios/${socio.socio_id}/editar`) : undefined}
        />
      ),
    },
    {
      id: 'financiero',
      label: 'Financiero',
      icon: 'account_balance_wallet',
      badge: cuotaBadges,
      content: <FinancialStatement socio={socio} finances={finances} readOnly={!activo} />,
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
        photoUrl={socio.foto_url}
        onDownloadPhoto={handleDownloadPhoto}
        onUploadPhoto={activo ? handleUploadPhoto : undefined}
        isActive={activo}
        statuses={memberStatuses(socio, finances.account)}
        metadata={[
          { label: 'DNI', value: formatDni(socio.dni) },
          { label: 'Socio N°', value: formatNumber(socio.numero_socio), highlighted: true },
          { label: 'Alta', value: formatDate(socio.fecha_alta) },
          { label: 'Antigüedad', value: yearsText(yearsSince(socio.fecha_alta)) },
        ]}
        statusAction={activo && (
          <DeactivateButton
            onClick={() => {
              setErrorEliminacion('')
              setModaldeactivateAbierto(true)
            }}
          />
        )}
        actions={(
          <PayButton
            onClick={() => openPayment({ socioId: socio.socio_id, onSuccess: refreshFinances })}
            disabledReason={puedePagar ? undefined : 'Socio de baja sin deuda pendiente'}
          />
        )}
        footer={!activo && (
          <LockedProfileNotice
            canPay={puedePagar}
            actions={(
              <ActivateButton
                onClick={() => {
                  setErrorActivacion('')
                  setModalActivarAbierto(true)
                }}
              />
            )}
          />
        )}
      />

      <PersonTabs key={`${id}-${requestedTab}`} tabs={tabs} defaultTab={requestedTab} />

      <PersonStatusModal
        opened={modalActivarAbierto}
        action="alta"
        title="Confirmar alta de socio"
        personName={nombreSocio}
        consequences={['Vuelve a generar la cuota mensual.', 'La ficha vuelve a ser editable.']}
        onClose={() => setModalActivarAbierto(false)}
        onConfirm={confirmarActivacion}
        loading={activando}
        error={errorActivacion}
      />

      <PersonStatusModal
        opened={modaldeactivateAbierto}
        action="baja"
        title="Confirmar baja de socio"
        personName={nombreSocio}
        consequences={['No se le generan más cuotas.', avisoDeuda, 'La ficha queda en solo lectura.']}
        onClose={() => setModaldeactivateAbierto(false)}
        onConfirm={confirmarEliminacion}
        loading={deactivate}
        error={errorEliminacion}
      />
    </div>
  )
}

export default SocioDetail
