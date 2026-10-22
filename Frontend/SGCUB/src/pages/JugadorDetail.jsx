import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { activateJugador, deactivateJugador, getJugador, patchJugador } from '../api/jugadores'
import ActivateJugadorModal from '../components/jugadores/ActivateJugadorModal'
import DeactivateJugadorModal from '../components/jugadores/DeactivateJugadorModal'
import PersonHeader, { ActionsDivider, ActivateButton, BenefitButton, DeactivateButton, EditButton, PayButton } from '../components/personas/HeaderPersona'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PersonalDataTab from '../components/personas/tabs/PersonalDataTab'
import FamilyTab from '../components/personas/tabs/FamilyTab'
import { FinancialStatement } from '../components/personas/tabs/FinancialTab'
import DocumentationTab from '../components/personas/tabs/DocumentationTab'
import { EmptyState } from '../components/personas/tabs/parts'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { isActiveStatus, formatDni, formatDate, formatNumber, getErrorMessage, yearsSince } from '../components/personas/format'
import useLocalidades from '../hooks/useLocalidades'
import useAssignBenefit from '../hooks/useAssignBenefit'
import useRegisterPayment from '../hooks/useRegisterPayment'
import useDocumentacion from "../hooks/useDocumentacion"
import { buildDocumentBadges } from '../components/documental/documentBadges'
import { buildCuotaBadges } from '../components/finanzas/cuotaBadges'
import useSocioFinances from '../hooks/useSocioFinances'
import CometJugadorCard from '../components/comet/CometJugadorCard'
import { getContactsPayload } from '../components/jugadores/contacts'

function JugadorDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('tab') ?? undefined
  const navigate = useNavigate()

  const [carga, setCarga] = useState({ id: null, datos: null, error: null })
  const loading = carga.id !== id
  const jugador = carga.datos
  const error = carga.error
  const setJugador = (datos) => setCarga((actual) => ({ ...actual, datos }))

  const { localidades } = useLocalidades()
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const { documentosActivos: activos } = useDocumentacion(jugador?.socio?.persona)
  const badgeConfig = React.useMemo(() => buildDocumentBadges(activos), [activos])
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

  const confirmarBaja = async (completa) => {
    setDandoDeBaja(true)
    setErrorBaja('')
    try {
      await deactivateJugador(jugador.jugador_id, { completa })
      setModalBajaAbierto(false)
      navigate('/padron/jugadores')
    } catch (requestError) {
      setErrorBaja(requestError.response?.data?.detail || 'No se pudo dar de baja el jugador.')
    } finally {
      setDandoDeBaja(false)
    }
  }

  const confirmarAlta = async () => {
    setDandoDeAlta(true)
    setErrorAlta('')
    try {
      setJugador(await activateJugador(jugador.jugador_id))
      setModalAltaAbierto(false)
    } catch (requestError) {
      setErrorAlta(getErrorMessage(requestError, 'No se pudo dar de alta el jugador.'))
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
  const edadJugador = yearsSince(socio.fecha_nacimiento)
  const mostrarResponsableLegal = edadJugador === null || edadJugador < 18

  const tabs = [
    {
      id: 'datos-personales',
      label: 'Datos personales',
      icon: 'person',
      content: (
        <PersonalDataTab
          persona={socio}
          localidades={localidades}
          deportivo={{
            categoria: jugador.categoria?.nombre,
            categoria_secundaria: jugador.categoria_secundaria?.nombre,
            estado: jugador.estado?.nombre,
            obra_social: jugador.obra_social,
            talla: jugador.tallaIndumentaria,
          }}
        />
      ),
    },
    {
      id: 'familiar',
      label: 'Familiar / Contactos',
      icon: 'family_restroom',
      badge: contactos.length ? { label: contactos.length, tono: 'info' } : undefined,
      content: (
        <FamilyTab
          contacts={contactos}
          onAdd={agregarContacto}
          onDelete={eliminarContacto}
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
      content: <DocumentationTab personaId={socio?.persona?.persona_id || socio?.persona} personaInfo={socio} personaType="jugador" />,
    },
    {
      id: 'financiero',
      label: 'Financiero',
      icon: 'account_balance_wallet',
      badge: cuotaBadges,
      content: socio.socio_id
        ? <FinancialStatement socio={socio} finances={finances} />
        : <EmptyState icon="account_balance_wallet" title="Sin datos de socio" description="El jugador no tiene un socio asociado." />,
    },
    {
      id: 'comet',
      label: 'COMET',
      icon: 'cloud_sync',
      content: <CometJugadorCard jugador={jugador} />,
    },
  ]

  return (
    <div className="flex flex-col w-full pb-8">
      <PersonHeader
        breadcrumb={[
          { label: 'Personas' },
          { label: 'Jugadores', to: '/padron/jugadores' },
          { label: `Jugador ${formatNumber(jugador.jugador_id)}` },
        ]}
        name={socio.nombre}
        surname={socio.apellido}
        status={jugador.estado?.nombre ? { label: jugador.estado.nombre, isActive: isActiveStatus(jugador.estado.nombre) } : null}
        metadata={[
          { label: 'DNI', value: formatDni(socio.dni) },
          { label: 'Socio N°', value: formatNumber(socio.numero_socio), highlighted: true },
          { label: 'Categoría', value: jugador.categoria?.nombre || '—' },
          { label: 'Fecha de alta', value: formatDate(socio.fecha_alta) },
        ]}
        actions={activo ? (
          <>
            <DeactivateButton
              onClick={() => {
                setErrorBaja('')
                setModalBajaAbierto(true)
              }}
            />
            <EditButton onClick={() => navigate(`/padron/jugadores/${jugador.jugador_id}/editar`)} />
            {socio.socio_id && (
              <>
                <ActionsDivider />
                <BenefitButton onClick={() => openBenefit({ socioId: socio.socio_id, onSuccess: refreshFinances })} />
                <PayButton onClick={() => openPayment({ socioId: socio.socio_id, onSuccess: refreshFinances })} />
              </>
            )}
          </>
        ) : (
          <ActivateButton
            onClick={() => {
              setErrorAlta('')
              setModalAltaAbierto(true)
            }}
          />
        )}
      />

      <PersonTabs key={`${id}-${requestedTab}`} tabs={tabs} defaultTab={requestedTab} />

      <ActivateJugadorModal
        opened={modalAltaAbierto}
        onClose={() => !dandoDeAlta && setModalAltaAbierto(false)}
        onConfirm={confirmarAlta}
        jugador={jugador}
        loading={dandoDeAlta}
        error={errorAlta}
      />

      <DeactivateJugadorModal
        opened={modalBajaAbierto}
        onClose={() => !dandoDeBaja && setModalBajaAbierto(false)}
        onConfirm={confirmarBaja}
        jugador={jugador}
        loading={dandoDeBaja}
        error={errorBaja}
      />
    </div>
  )
}

export default JugadorDetail
