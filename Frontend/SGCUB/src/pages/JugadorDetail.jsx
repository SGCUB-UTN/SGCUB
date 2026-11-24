import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { activateJugador, deactivateJugador, getJugador, patchJugador } from '../api/jugadores'
import { activateSocio } from '../api/socios'
import PersonStatusModal from '../components/personas/PersonStatusModal'
import PersonHeader, { ActivateButton, DeactivateButton, HeaderNotice, LockedProfileNotice, PayButton } from '../components/personas/HeaderPersona'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PersonalDataTab from '../components/personas/tabs/PersonalDataTab'
import FamilyTab from '../components/personas/tabs/FamilyTab'
import { FinancialStatement } from '../components/personas/tabs/FinancialTab'
import DocumentationTab from '../components/personas/tabs/DocumentationTab'
import { EmptyState } from '../components/personas/tabs/parts'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { exemptCategory, memberStatuses } from '../components/personas/profileStatus'
import { isActiveStatus, formatDni, formatDate, formatNumber, getErrorMessage, yearsSince, yearsText } from '../components/personas/format'
import useLocalidades from '../hooks/useLocalidades'
import useRegisterPayment from '../hooks/useRegisterPayment'
import useDocumentacion from "../hooks/useDocumentacion"
import { buildDocumentBadges } from '../components/documental/documentBadges'
import { findMissingDocumentTypes } from '../components/documental/missingDocuments'
import { buildCuotaBadges } from '../components/finanzas/cuotaBadges'
import { hasPendingDebt, pendingDebt } from '../components/finanzas/accountStatement'
import { currentPeriod } from '../components/shared/periodFormat'
import { formatMoney } from '../components/cuota/cuotaPeriod'
import useSocioFinances from '../hooks/useSocioFinances'
import useToast from '../hooks/useToast'
import CometDescargarButton from '../components/comet/CometDescargarButton'
import { getContactsPayload, getContactsPayloadWith } from '../components/jugadores/contacts'
import { RECATEGORIZATION_REVIEW_PATH } from '../components/automatizaciones/automationCatalog'
import { downloadImage, buildPhotoFilename } from '../utils/downloadImage'
import { uploadPersonaFoto } from '../api/personaFoto'

const READ_ONLY = 'La ficha queda en solo lectura.'
const EDITABLE = 'La ficha vuelve a ser editable.'

const DEACTIVATION_TYPES = [
  { value: 'completa', label: 'Baja completa', description: 'Da de baja al jugador y al socio. Deja de abonar la cuota.' },
  { value: 'parcial', label: 'Baja parcial', description: 'Da de baja solo al jugador. Mantiene la cuota social.' },
]

const ACTIVATION_TYPES = [
  {
    value: 'completa',
    label: 'Alta completa',
    description: 'Da de alta al socio y al jugador. Abona la cuota social y la deportiva.',
    consequences: [EDITABLE],
  },
  {
    value: 'parcial',
    label: 'Alta parcial',
    description: 'Da de alta solo al socio. Abona la cuota social y queda como ex jugador.',
    consequences: ['La ficha sigue en solo lectura hasta el alta como jugador.'],
  },
]

const ORIGINS = {
  jugadores: [{ label: 'Personas' }, { label: 'Jugadores', to: '/padron/jugadores' }],
  socios: [{ label: 'Personas' }, { label: 'Socios', to: '/padron/socios' }],
  recategorizacion: [
    { label: 'Administración' },
    { label: 'Automatizaciones', to: '/automatizaciones' },
    { label: 'Revisión de la recategorización', to: RECATEGORIZATION_REVIEW_PATH },
  ],
}

function JugadorDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? undefined
  const navigate = useNavigate()
  const origin = ORIGINS[useLocation().state?.from] ?? ORIGINS.jugadores

  const [carga, setCarga] = useState({ id: null, datos: null, error: null })
  const loading = carga.id !== id
  const jugador = carga.datos
  const error = carga.error
  const setJugador = (datos) => setCarga((actual) => ({ ...actual, datos }))

  const { localidades } = useLocalidades()
  const { openPayment } = useRegisterPayment()
  const { showToast } = useToast()
  const documentation = useDocumentacion(jugador?.socio?.persona)
  const { documentosActivos: activos, tipos: tiposDocumento } = documentation
  const badgeConfig = React.useMemo(
    () => buildDocumentBadges(activos, findMissingDocumentTypes(tiposDocumento, activos, 'jugador').length),
    [activos, tiposDocumento],
  )
  // Loaded here so the tab badge and the financial tab share a single request
  const finances = useSocioFinances(jugador?.socio?.socio_id)
  const refreshFinances = finances.reload
  const cuotaBadges = React.useMemo(() => buildCuotaBadges(finances.account), [finances.account])
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


  const [modalBajaAbierto, setModalBajaAbierto] = useState(false)
  const [modalBajaCompletaAbierto, setModalBajaCompletaAbierto] = useState(false)
  const [dandoDeBaja, setDandoDeBaja] = useState(false)
  const [errorBaja, setErrorBaja] = useState('')
  const [modalAltaAbierto, setModalAltaAbierto] = useState(false)
  const [dandoDeAlta, setDandoDeAlta] = useState(false)
  const [errorAlta, setErrorAlta] = useState('')

  useEffect(() => {
    let activo = true
    getJugador(id)
      .then((datos) => activo && setCarga({ id, datos, error: null }))
      .catch((requestError) => {
        if (activo) setCarga({ id, datos: null, error: requestError.response?.data?.detail || 'No se pudo cargar la información del jugador.' })
      })
    return () => { activo = false }
  }, [id])


  const agregarContacto = async (contacto) => {
    const contactoPayload = {
      persona: contacto.persona,
      relacion: contacto.relacion,
      responsable_legal: Boolean(contacto.responsable_legal),
    }
    try {
      const actualizado = await patchJugador(jugador.jugador_id, {
        vinculos_familiares: [...getContactsPayload(jugador), contactoPayload],
      })
      setJugador(actualizado)
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError, 'No se pudo agregar el contacto.'), { cause: requestError })
    }
  }

  const editarContacto = async (contacto) => {
    try {
      const actualizado = await patchJugador(jugador.jugador_id, {
        vinculos_familiares: getContactsPayloadWith(jugador, contacto),
      })
      setJugador(actualizado)
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError, 'No se pudo modificar el contacto.'), { cause: requestError })
    }
  }

  const eliminarContacto = async (contacto) => {
    try {
      const contactosRestantes = getContactsPayload(jugador)
        .filter((item) => item.vinculo_familiar_id !== contacto.vinculo_familiar_id)
      const actualizado = await patchJugador(jugador.jugador_id, {
        vinculos_familiares: contactosRestantes,
      })
      setJugador(actualizado)
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError, 'No se pudo eliminar el contacto.'), { cause: requestError })
    }
  }

  const nombreJugador = `${jugador?.socio?.nombre ?? ''} ${jugador?.socio?.apellido ?? ''}`.trim()

  const openModal = (setError, setOpened) => {
    setError('')
    setOpened(true)
  }

  const confirmarBaja = async (completa) => {
    setDandoDeBaja(true)
    setErrorBaja('')
    try {
      await deactivateJugador(jugador.jugador_id, { completa })
      setJugador(await getJugador(jugador.jugador_id))
      refreshFinances()
      setModalBajaAbierto(false)
      setModalBajaCompletaAbierto(false)
      showToast(completa
        ? { title: 'Jugador dado de baja', description: `${nombreJugador} quedó de baja como jugador y como socio.` }
        : { title: 'Baja parcial registrada', description: `${nombreJugador} deja la actividad deportiva y sigue como socio.` })
    } catch (requestError) {
      setErrorBaja(getErrorMessage(requestError, 'No se pudo dar de baja al jugador.'))
    } finally {
      setDandoDeBaja(false)
    }
  }

  const confirmarAlta = async (completa) => {
    setDandoDeAlta(true)
    setErrorAlta('')
    try {
      if (completa) {
        setJugador(await activateJugador(jugador.jugador_id))
      } else {
        await activateSocio(jugador.socio.socio_id)
        setJugador(await getJugador(jugador.jugador_id))
      }
      refreshFinances()
      setModalAltaAbierto(false)
      showToast(completa
        ? { title: 'Jugador dado de alta', description: `${nombreJugador} vuelve a estar activo.` }
        : { title: 'Alta como socio registrada', description: `${nombreJugador} vuelve como socio, sin actividad deportiva.` })
    } catch (requestError) {
      setErrorAlta(getErrorMessage(requestError, 'No se pudo dar de alta al jugador.'))
    } finally {
      setDandoDeAlta(false)
    }
  }

  if (loading) return <LoadingFile text="Cargando detalle del jugador..." />
  if (error || !jugador) {
    return (
      <ErrorFile
        message={error || 'El jugador solicitado no existe o no se pudo encontrar.'}
        backTo="/padron/jugadores"
        backText="Volver a jugadores"
      />
    )
  }

  const socio = jugador.socio ?? {}
  const contactos = jugador.vinculos_familiares ?? []
  const activo = isActiveStatus(jugador.estado?.nombre)
  const bajaParcial = jugador.tipo_baja === 'parcial'
  const puedePagar = Boolean(socio.socio_id)
    && (isActiveStatus(socio.estado_administrativo_nombre) || hasPendingDebt(finances.account))
  const payDisabledReason = !socio.socio_id
    ? 'El jugador no tiene un socio asociado'
    : !puedePagar ? 'Socio de baja sin deuda pendiente' : undefined
  const edadJugador = yearsSince(socio.fecha_nacimiento)
  const mostrarResponsableLegal = edadJugador === null || edadJugador < 18
  const categoriaExenta = exemptCategory(jugador)
  const altaConEleccion = jugador.tipo_baja === 'completa'
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
    if (!socio.persona) return
    const personaActualizada = await uploadPersonaFoto(socio.persona, file)
    setCarga((actual) => ({
      ...actual,
      datos: {
        ...actual.datos,
        socio: {
          ...actual.datos.socio,
          foto_url: personaActualizada.foto_url,
        },
      },
    }))
  }

  const tabs = [
    {
      id: 'datos-personales',
      label: 'Datos personales',
      icon: 'person',
      content: (
        <PersonalDataTab
          persona={{
            ...socio,
            esquema_vacunacion: jugador.esquema_vacunacion,
            nivel_educacion: jugador.nivel_educacion,
          }}
          localidades={localidades}
          onEdit={activo ? () => navigate(`/padron/jugadores/${jugador.jugador_id}/editar`) : undefined}
          extraActions={<CometDescargarButton jugadorId={jugador.jugador_id} />}
          deportivo={{
            categoria: jugador.categoria?.nombre,
            categoria_secundaria: jugador.categoria_secundaria?.nombre,
            obra_social: jugador.obra_social,
            talla: jugador.tallaIndumentaria,
          }}
        />
      ),
    },
    {
      id: 'familiar',
      label: 'Familiares y contactos',
      icon: 'family_restroom',
      content: (
        <FamilyTab
          contacts={contactos}
          onAdd={activo ? agregarContacto : undefined}
          onEdit={activo ? editarContacto : undefined}
          onDelete={activo ? eliminarContacto : undefined}
          domicilioTitular={socio}
          mostrarResponsableLegal={mostrarResponsableLegal}
        />
      ),
    },
    {
      id: 'documentacion',
      label: 'Documentación',
      icon: 'folder_shared',
      badge: badgeConfig,
      content: <DocumentationTab documentation={documentation} personaId={socio?.persona?.persona_id || socio?.persona} personaInfo={socio} personaType="jugador" readOnly={!activo} />,
    },
    {
      id: 'financiero',
      label: 'Financiero',
      icon: 'account_balance_wallet',
      badge: cuotaBadges,
      content: socio.socio_id
        ? <FinancialStatement socio={socio} finances={finances} exemptCategory={categoriaExenta} readOnly={!activo} />
        : <EmptyState icon="account_balance_wallet" title="Sin datos de socio" description="El jugador no tiene un socio asociado." />,
    },
  ]

  return (
    <div className="flex flex-col w-full pb-8">
      <PersonHeader
        breadcrumb={[
          ...origin,
          { label: `Socio ${formatNumber(socio.numero_socio)}` },
        ]}
        name={socio.nombre}
        surname={socio.apellido}
        photoUrl={socio.foto_url}
        onDownloadPhoto={handleDownloadPhoto}
        onUploadPhoto={activo ? handleUploadPhoto : undefined}
        isActive={activo}
        statuses={memberStatuses(socio, finances.account, jugador)}
        metadata={[
          { label: 'DNI', value: formatDni(socio.dni) },
          { label: 'Socio N°', value: formatNumber(socio.numero_socio), highlighted: true },
          { label: 'Alta', value: formatDate(socio.fecha_alta) },
          { label: 'Antigüedad', value: yearsText(yearsSince(socio.fecha_alta)) },
          {
            label: 'Categoría',
            value: [jugador.categoria?.nombre || 'Sin categoría', jugador.categoria_secundaria?.nombre].filter(Boolean).join(', '),
          },
        ]}
        statusAction={activo && <DeactivateButton onClick={() => openModal(setErrorBaja, setModalBajaAbierto)} />}
        actions={(
          <PayButton
            onClick={() => openPayment({ socioId: socio.socio_id, onSuccess: refreshFinances })}
            disabledReason={payDisabledReason}
          />
        )}
        footer={bajaParcial ? (
          <HeaderNotice
            icon="pause_circle"
            title="Baja parcial"
            actions={(
              <>
                <ActivateButton onClick={() => openModal(setErrorAlta, setModalAltaAbierto)}>
                  Alta como jugador
                </ActivateButton>
                <DeactivateButton variant="outline" onClick={() => openModal(setErrorBaja, setModalBajaCompletaAbierto)}>
                  Baja completa
                </DeactivateButton>
              </>
            )}
          >
            {categoriaExenta
              ? `Sin actividad deportiva. Sigue como socio, sin cuotas por estar en la categoría ${categoriaExenta.nombre}. La ficha queda en solo lectura.`
              : 'Sin actividad deportiva. Sigue como socio y abona la cuota social. La ficha queda en solo lectura.'}
          </HeaderNotice>
        ) : !activo && (
          <LockedProfileNotice
            canPay={puedePagar}
            actions={<ActivateButton onClick={() => openModal(setErrorAlta, setModalAltaAbierto)} />}
          />
        )}
      />

      <PersonTabs key={`${id}-${requestedTab}`} tabs={tabs} defaultTab={requestedTab} />

      <PersonStatusModal
        opened={modalAltaAbierto}
        action="alta"
        title="Confirmar alta de jugador"
        personName={nombreJugador}
        options={altaConEleccion ? ACTIVATION_TYPES : undefined}
        consequences={altaConEleccion ? [] : ['Vuelve a la actividad deportiva y abona la cuota deportiva.', EDITABLE]}
        onClose={() => setModalAltaAbierto(false)}
        onConfirm={(tipo) => confirmarAlta(!altaConEleccion || tipo === 'completa')}
        loading={dandoDeAlta}
        error={errorAlta}
      />

      <PersonStatusModal
        opened={modalBajaCompletaAbierto}
        action="baja"
        title="Confirmar baja completa"
        personName={nombreJugador}
        confirmLabel="Dar de baja completa"
        consequences={['También se da de baja al socio: deja de abonar la cuota social.', avisoDeuda, 'La ficha sigue en solo lectura.']}
        onClose={() => setModalBajaCompletaAbierto(false)}
        onConfirm={() => confirmarBaja(true)}
        loading={dandoDeBaja}
        error={errorBaja}
      />

      <PersonStatusModal
        opened={modalBajaAbierto}
        action="baja"
        title="Confirmar baja de jugador"
        personName={nombreJugador}
        options={DEACTIVATION_TYPES}
        consequences={[avisoDeuda, READ_ONLY]}
        onClose={() => setModalBajaAbierto(false)}
        onConfirm={(tipo) => confirmarBaja(tipo === 'completa')}
        loading={dandoDeBaja}
        error={errorBaja}
      />
    </div>
  )
}

export default JugadorDetail
