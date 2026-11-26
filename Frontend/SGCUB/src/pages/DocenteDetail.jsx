import React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { activateDocente, deactivateDocente, getCargosDocente, getDocente, patchDocente } from '../api/docentes'
import ActivateDocenteModal from '../components/docentes/ActivateDocenteModal'
import PersonStatusModal from '../components/personas/PersonStatusModal'
import PersonHeader, { DeactivateButton, ActivateButton, LockedProfileNotice } from '../components/personas/HeaderPersona'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PersonalDataTab from '../components/personas/tabs/PersonalDataTab'
import FamilyTab from '../components/personas/tabs/FamilyTab'
import CategoriesTab from '../components/personas/tabs/CategoriesTab'
import DocumentationTab from '../components/personas/tabs/DocumentationTab'
import { getContactsPayload, getContactsPayloadWith } from '../components/jugadores/contacts'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { teacherStatuses } from '../components/personas/profileStatus'
import { yearsSince, formatDni, formatDate, formatNumber, yearsText, isActiveStatus, getErrorMessage } from '../components/personas/format'
import useCategorias from '../hooks/useCategorias'
import useLocalidades from '../hooks/useLocalidades'
import useToast from '../hooks/useToast'

import useDocumentacion from "../hooks/useDocumentacion"
import { buildDocumentBadges } from '../components/documental/documentBadges'
import { findMissingDocumentTypes } from '../components/documental/missingDocuments'
import { downloadImage, buildPhotoFilename } from '../utils/downloadImage'
import { uploadPersonaFoto } from '../api/personaFoto'

function DocenteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get("tab") ?? undefined
  const { localidades } = useLocalidades()
  const { categorias } = useCategorias()
  const { showToast } = useToast()
  const [cargos, setCargos] = useState([])

  const [carga, setCarga] = useState({ id: null, docente: null, error: null })
  const loading = carga.id !== id
  const { docente, error } = carga

  const documentation = useDocumentacion(docente?.persona)
  const { documentosActivos: activos, tipos: tiposDocumento } = documentation
  const badgeConfig = React.useMemo(
    () => buildDocumentBadges(activos, findMissingDocumentTypes(tiposDocumento, activos, 'docente').length),
    [activos, tiposDocumento],
  )

  const [modalBajaAbierto, setModalBajaAbierto] = useState(false)
  const [dandoDeBaja, setDandoDeBaja] = useState(false)
  const [errorBaja, setErrorBaja] = useState('')
  const [modalAltaAbierto, setModalAltaAbierto] = useState(false)
  const [modalAltaKey, setModalAltaKey] = useState(0)
  const [dandoDeAlta, setDandoDeAlta] = useState(false)
  const [errorAlta, setErrorAlta] = useState('')

  useEffect(() => {
    let activo = true
    getDocente(id)
      .then((datosDocente) => activo && setCarga({ id, docente: datosDocente, error: null }))
      .catch((requestError) => {
        if (activo) setCarga({ id, docente: null, error: requestError.response?.data?.detail || 'No se pudo cargar la información del docente.' })
      })
    return () => { activo = false }
  }, [id])

  useEffect(() => {
    let activo = true
    getCargosDocente()
      .then((datos) => activo && setCargos(datos))
      .catch((requestError) => console.error('Error al cargar cargos:', requestError))
    return () => { activo = false }
  }, [])

  const guardarAsignaciones = async (asignaciones) => {
    try {
      const actualizado = await patchDocente(docente.docente_id, { asignaciones })
      setCarga((actual) => ({ ...actual, docente: actualizado }))
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError, 'No se pudieron guardar los cargos del docente.'), { cause: requestError })
    }
  }

  const agregarContacto = async (contacto) => {
    const contactoPayload = {
      persona: contacto.persona,
      relacion: contacto.relacion,
      responsable_legal: false,
    }
    try {
      const actualizado = await patchDocente(docente.docente_id, {
        vinculos_familiares: [...getContactsPayload(docente), contactoPayload],
      })
      setCarga((actual) => ({ ...actual, docente: actualizado }))
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError, 'No se pudo agregar el contacto.'), { cause: requestError })
    }
  }

  const editarContacto = async (contacto) => {
    try {
      const actualizado = await patchDocente(docente.docente_id, {
        vinculos_familiares: getContactsPayloadWith(docente, contacto),
      })
      setCarga((actual) => ({ ...actual, docente: actualizado }))
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError, 'No se pudo modificar el contacto.'), { cause: requestError })
    }
  }

  const eliminarContacto = async (contacto) => {
    try {
      const contactosRestantes = getContactsPayload(docente)
        .filter((item) => item.vinculo_familiar_id !== contacto.vinculo_familiar_id)
      const actualizado = await patchDocente(docente.docente_id, {
        vinculos_familiares: contactosRestantes,
      })
      setCarga((actual) => ({ ...actual, docente: actualizado }))
    } catch (requestError) {
      throw new Error(getErrorMessage(requestError, 'No se pudo eliminar el contacto.'), { cause: requestError })
    }
  }

  const nombreDocente = `${docente?.persona_detalle?.nombre ?? ''} ${docente?.persona_detalle?.apellido ?? ''}`.trim()

  const confirmarBaja = async () => {
    setDandoDeBaja(true)
    setErrorBaja('')
    try {
      await deactivateDocente(docente.docente_id)
      const actualizado = await getDocente(docente.docente_id)
      setCarga((actual) => ({ ...actual, docente: actualizado }))
      setModalBajaAbierto(false)
      showToast({ title: 'Docente dado de baja', description: `${nombreDocente} quedó de baja. La ficha pasa a solo lectura.` })
    } catch (requestError) {
      setErrorBaja(getErrorMessage(requestError, 'No se pudo dar de baja al docente.'))
    } finally {
      setDandoDeBaja(false)
    }
  }

  const confirmarAlta = async (asignaciones) => {
    setDandoDeAlta(true)
    setErrorAlta('')
    try {
      const actualizado = await activateDocente(docente.docente_id, asignaciones)
      setCarga((actual) => ({ ...actual, docente: actualizado }))
      setModalAltaAbierto(false)
      showToast({ title: 'Docente dado de alta', description: `${nombreDocente} vuelve a estar activo.` })
    } catch (requestError) {
      setErrorAlta(getErrorMessage(requestError, 'No se pudo dar de alta al docente.'))
    } finally {
      setDandoDeAlta(false)
    }
  }

  if (loading) return <LoadingFile text="Cargando detalle del docente..." />
  if (error || !docente) {
    return (
      <ErrorFile
        message={error || 'El docente solicitado no existe.'}
        backTo="/padron/docentes"
        backText="Volver a docentes"
      />
    )
  }

  const persona = docente.persona_detalle ?? {}
  const contactos = docente.vinculos_familiares ?? []
  const activo = isActiveStatus(docente.estado_nombre)

  const handleDownloadPhoto = async () => {
    if (!persona.foto_url) return
    try {
      await downloadImage(persona.foto_url, buildPhotoFilename(persona.foto_url, persona.nombre, persona.apellido))
    } catch (err) {
      console.error(err)
      showToast({ tone: 'error', title: 'No se pudo descargar la foto', description: 'Probá de nuevo en unos minutos.' })
    }
  }

  const handleUploadPhoto = async (file) => {
    const personaId = docente.persona?.persona_id || docente.persona
    if (!personaId) return
    const personaActualizada = await uploadPersonaFoto(personaId, file)
    setCarga((actual) => ({
      ...actual,
      docente: {
        ...actual.docente,
        persona_detalle: {
          ...actual.docente.persona_detalle,
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
          persona={persona}
          localidades={localidades}
          onEdit={activo ? () => navigate(`/padron/docentes/${docente.docente_id}/editar`) : undefined}
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
          domicilioTitular={persona}
          etiquetaTitular="docente"
          mostrarResponsableLegal={false}
        />
      ),
    },
    {
      id: 'documentacion',
      label: 'Documentación',
      icon: 'folder_shared',
      badge: badgeConfig,
      content: <DocumentationTab documentation={documentation} personaId={docente?.persona?.persona_id || docente?.persona} personaInfo={persona} personaType="docente" readOnly={!activo} />,
    },
    {
      id: 'categorias',
      label: 'Cargos y categorías',
      icon: 'groups',
      content: (
        <CategoriesTab
          asignaciones={docente.asignaciones ?? []}
          cargos={cargos}
          categorias={categorias}
          editable={activo}
          isActive={activo}
          onSave={guardarAsignaciones}
        />
      ),
    },
  ]

  return (
    <div className="flex flex-col w-full pb-8">
      <PersonHeader
        breadcrumb={[
          { label: 'Personas' },
          { label: 'Docentes', to: '/padron/docentes' },
          { label: `Legajo ${formatNumber(docente.legajo)}` },
        ]}
        name={persona.nombre}
        surname={persona.apellido}
        photoUrl={persona.foto_url}
        onDownloadPhoto={handleDownloadPhoto}
        onUploadPhoto={activo ? handleUploadPhoto : undefined}
        isActive={activo}
        statuses={teacherStatuses(activo)}
        metadata={[
          { label: 'DNI', value: formatDni(persona.dni) },
          { label: 'Legajo', value: formatNumber(docente.legajo), highlighted: true },
          { label: 'Alta', value: formatDate(docente.fecha_ingreso) },
          { label: 'Antigüedad', value: yearsText(yearsSince(docente.fecha_ingreso)) },
        ]}
        statusAction={activo && (
          <DeactivateButton
            onClick={() => {
              setErrorBaja('')
              setModalBajaAbierto(true)
            }}
          />
        )}
        footer={!activo && (
          <LockedProfileNotice
            actions={(
              <ActivateButton
                onClick={() => {
                  setErrorAlta('')
                  setModalAltaKey((key) => key + 1)
                  setModalAltaAbierto(true)
                }}
              />
            )}
          />
        )}
      />

      <PersonTabs key={`${id}-${requestedTab}`} tabs={tabs} defaultTab={requestedTab} />

      <ActivateDocenteModal
        key={modalAltaKey}
        opened={modalAltaAbierto}
        onClose={() => setModalAltaAbierto(false)}
        onConfirm={confirmarAlta}
        personName={nombreDocente}
        needsCargo={(docente.asignaciones ?? []).length === 0}
        cargos={cargos}
        categorias={categorias}
        loading={dandoDeAlta}
        error={errorAlta}
      />

      <PersonStatusModal
        opened={modalBajaAbierto}
        action="baja"
        title="Confirmar baja de docente"
        personName={nombreDocente}
        consequences={['Conserva sus cargos y categorías asignadas.', 'La ficha queda en solo lectura.']}
        onClose={() => setModalBajaAbierto(false)}
        onConfirm={confirmarBaja}
        loading={dandoDeBaja}
        error={errorBaja}
      />
    </div>
  )
}

export default DocenteDetail
