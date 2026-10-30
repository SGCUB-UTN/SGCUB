import React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { activateDocente, deactivateDocente, getCargosDocente, getDocente, patchDocente } from '../api/docentes'
import ActivateDocenteModal from '../components/docentes/ActivateDocenteModal'
import DeactivateDocenteModal from '../components/docentes/DeactivateDocenteModal'
import PersonHeader, { DeactivateButton, ActivateButton } from '../components/personas/HeaderPersona'
import PersonTabs from '../components/personas/TabsNavPersonas'
import PersonalDataTab from '../components/personas/tabs/PersonalDataTab'
import FamilyTab from '../components/personas/tabs/FamilyTab'
import CategoriesTab from '../components/personas/tabs/CategoriesTab'
import DocumentationTab from '../components/personas/tabs/DocumentationTab'
import { getContactsPayload, getContactsPayloadWith } from '../components/jugadores/contacts'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { teacherStatuses } from '../components/personas/profileStatus'
import { yearsSince, formatDni, formatDate, yearsText, isActiveStatus, getErrorMessage } from '../components/personas/format'
import useCategorias from '../hooks/useCategorias'
import useLocalidades from '../hooks/useLocalidades'

import useDocumentacion from "../hooks/useDocumentacion"
import { buildDocumentBadges } from '../components/documental/documentBadges'
import { findMissingDocumentTypes } from '../components/documental/missingDocuments'
function DocenteDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get("tab") ?? undefined
  const { localidades } = useLocalidades()
  const { categorias } = useCategorias()
  const [cargos, setCargos] = useState([])

  const [carga, setCarga] = useState({ id: null, docente: null, error: null })
  const loading = carga.id !== id
  const { docente, error } = carga

  const { documentosActivos: activos, tipos: tiposDocumento } = useDocumentacion(docente?.persona)
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

  const confirmarBaja = async () => {
    setDandoDeBaja(true)
    setErrorBaja('')
    try {
      await deactivateDocente(docente.docente_id)
      setModalBajaAbierto(false)
      navigate('/padron/docentes')
    } catch (requestError) {
      setErrorBaja(requestError.response?.data?.detail || 'No se pudo dar de baja el docente.')
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
    } catch (requestError) {
      setErrorAlta(getErrorMessage(requestError, 'No se pudo dar de alta el docente.'))
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
  const nombresCargos = (docente.asignaciones ?? []).map((asignacion) => asignacion.cargo_nombre).filter(Boolean).join(', ')
  const activo = isActiveStatus(docente.estado_nombre)

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
      label: 'Familiar / Contactos',
      icon: 'family_restroom',
      content: (
        <FamilyTab
          contacts={contactos}
          onAdd={agregarContacto}
          onEdit={editarContacto}
          onDelete={eliminarContacto}
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
      content: <DocumentationTab personaId={docente?.persona?.persona_id || docente?.persona} personaInfo={persona} personaType="docente" />,
    },
    {
      id: 'categorias',
      label: 'Categorías',
      icon: 'groups',
      content: (
        <CategoriesTab
          asignaciones={docente.asignaciones ?? []}
          cargos={cargos}
          categorias={categorias}
          editable
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
          { label: `Legajo #${docente.legajo}` },
        ]}
        name={persona.nombre}
        surname={persona.apellido}
        isActive={activo}
        statuses={teacherStatuses(activo)}
        metadata={[
          { label: 'DNI', value: formatDni(persona.dni) },
          { label: 'Legajo', value: `#${docente.legajo}`, highlighted: true },
          { label: 'Fecha de ingreso', value: formatDate(docente.fecha_ingreso) },
          { label: 'Antigüedad', value: yearsText(yearsSince(docente.fecha_ingreso)) },
          ...(nombresCargos ? [{ label: 'Cargos', value: nombresCargos }] : []),
        ]}
        statusAction={activo ? (
          <DeactivateButton
            onClick={() => {
              setErrorBaja('')
              setModalBajaAbierto(true)
            }}
          />
        ) : (
          <ActivateButton
            onClick={() => {
              setErrorAlta('')
              setModalAltaKey((key) => key + 1)
              setModalAltaAbierto(true)
            }}
          />
        )}
      />

      <PersonTabs key={`${id}-${requestedTab}`} tabs={tabs} defaultTab={requestedTab} />

      <ActivateDocenteModal
        key={modalAltaKey}
        opened={modalAltaAbierto}
        onClose={() => !dandoDeAlta && setModalAltaAbierto(false)}
        onConfirm={confirmarAlta}
        docente={docente}
        cargos={cargos}
        categorias={categorias}
        loading={dandoDeAlta}
        error={errorAlta}
      />

      <DeactivateDocenteModal
        opened={modalBajaAbierto}
        onClose={() => !dandoDeBaja && setModalBajaAbierto(false)}
        onConfirm={confirmarBaja}
        docente={docente}
        loading={dandoDeBaja}
        error={errorBaja}
      />
    </div>
  )
}

export default DocenteDetail
