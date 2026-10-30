import { useState } from 'react'
import { SecondaryButton, SegmentedTabs, TAB_PANEL_CLASS, TableFooter, TabHeader } from './parts'
import useDocumentacion from '../../../hooks/useDocumentacion'
import { collectErrorMessages } from '../format'
import DocumentacionUploadModal from '../../documental/DocumentacionUploadModal'
import DocumentacionDeleteModal from '../../documental/DocumentacionDeleteModal'
import PersonaDocumentsTable from '../../documental/PersonaDocumentsTable'
import { SectionEmpty } from '../../shared/FlushSection'
import { INSET_PADDING_X_CLASS } from '../../shared/flushTable'
import { KpiColumn, KpiGrid } from '../../shared/Kpi'

const getEmptyUploadForm = () => ({
  tipo_documento: '',
  archivo: null,
  archivoUrl_existing: null,
  borrar_archivo: false,
  fecha_emision: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '',
})

const PROFILE_FIELDS = { jugador: 'aplica_jugador', socio: 'aplica_socio', docente: 'aplica_docente' }

const addMonths = (date, months) => {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCMonth(shifted.getUTCMonth() + months)
  return shifted.toISOString().split('T')[0]
}

const ACTIVE = 'vigentes'
const HISTORY = 'historial'
const PANEL_ID = 'documentation-section-panel'

const countByStatus = (documents, status) => documents.filter((doc) => doc.status === status).length

const SAVE_ERROR_MESSAGE = 'No se pudo guardar el documento.'

const getSaveErrorMessage = (requestError) => {
  const data = requestError.response?.data
  if (!data) return requestError.response ? SAVE_ERROR_MESSAGE : 'No se pudo conectar con el servidor.'
  if (typeof data === 'string') return SAVE_ERROR_MESSAGE
  if (data.detail) return data.detail
  return collectErrorMessages(data).join(' ') || SAVE_ERROR_MESSAGE
}

export default function DocumentationTab({ personaId, personaType, personaInfo }) {
  const {
    tipos,
    isLoading: loading,
    subirDocumento,
    actualizarDocumento,
    borrarDocumento,
    getNombreTipo,
    documentosActivos,
    documentosHistoricos
  } = useDocumentacion(personaId)


  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [docToEdit, setDocToEdit] = useState(null)

  const [uploadForm, setUploadForm] = useState(getEmptyUploadForm())
  const [saveError, setSaveError] = useState(null)
  const [activeSection, setActiveSection] = useState(ACTIVE)

  // Enabled types that apply to this profile; when editing, the document's own type is always offered
  const tiposFiltrados = tipos.filter(t => (
    String(t.id_tipo_documento) === String(uploadForm.tipo_documento)
    || (t.activo && t[PROFILE_FIELDS[personaType] ?? 'aplica_jugador'])
  ))

  const suggestedDueDate = (form) => {
    const tipo = tipos.find(t => String(t.id_tipo_documento) === String(form.tipo_documento))
    return tipo?.vigencia_meses && form.fecha_emision ? addMonths(form.fecha_emision, tipo.vigencia_meses) : ''
  }

  const handleDeleteClick = (doc) => {
    setDocToDelete(doc)
    setDeleteModalOpen(true)
  }

  const handleEditClick = (doc) => {
    setIsEditing(true)
    setDocToEdit(doc)
    setUploadForm({
      tipo_documento: doc.tipo_documento || '',
      archivo: null,
      archivoUrl_existing: doc.archivoUrl || null,
      borrar_archivo: false,
      fecha_emision: doc.fecha_emision ? doc.fecha_emision.split('T')[0] : '',
      fecha_vencimiento: doc.fecha_vencimiento ? doc.fecha_vencimiento.split('T')[0] : '',
    })
    setSaveError(null)
    setUploadModalOpen(true)
  }

  const handleNewClick = () => {
    setIsEditing(false)
    setDocToEdit(null)
    setUploadForm(getEmptyUploadForm())
    setSaveError(null)
    setUploadModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!docToDelete) return
    try {
      await borrarDocumento(docToDelete.id_documento)
      setDeleteModalOpen(false)
      setDocToDelete(null)
    } catch (error) {
      console.error('Error deleting document:', error)
    }
  }

  const handleUploadChange = (e) => {
    const { name, value, type, files, checked } = e.target
    if (type === 'file') {
      setUploadForm(prev => ({ ...prev, archivo: files.length > 0 ? files[0] : null }))
    } else if (type === 'checkbox') {
      setUploadForm(prev => ({ ...prev, [name]: checked }))
    } else {
      setUploadForm(prev => {
        const next = { ...prev, [name]: value }
        // The due date follows the type's default validity until the user types a different one
        const followsSuggestion = !prev.fecha_vencimiento || prev.fecha_vencimiento === suggestedDueDate(prev)
        if ((name === 'tipo_documento' || name === 'fecha_emision') && followsSuggestion) {
          next.fecha_vencimiento = suggestedDueDate(next)
        }
        return next
      })
    }
  }

  const handleUploadSubmit = async (e) => {
    e.preventDefault()
    setSaveError(null)
    try {
      const formData = new FormData();
      formData.append('persona', personaId);
      formData.append('tipo_documento', uploadForm.tipo_documento);
      
      const appendDate = (field) => {
        if (uploadForm[field]) formData.append(field, `${uploadForm[field]}T00:00:00`);
        else if (isEditing) formData.append(field, '');
      }
      appendDate('fecha_emision');
      appendDate('fecha_vencimiento');
      if (uploadForm.archivo) {
        formData.append('archivoUrl', uploadForm.archivo);
      } else if (isEditing && uploadForm.borrar_archivo) {
        formData.append('archivoUrl', '');
      }
      
      if (isEditing) {
        await actualizarDocumento(docToEdit.id_documento, formData)
      } else {
        await subirDocumento(formData)
      }
      setUploadModalOpen(false)
      setUploadForm(getEmptyUploadForm())
      setIsEditing(false)
      setDocToEdit(null)
    } catch (error) {
      console.error('Error uploading document:', error)
      setSaveError(getSaveErrorMessage(error))
    }
  }

  const handleDownloadZip = async (scope) => {
    try {
      const { downloadZip } = await import('../../../api/documentacion');
      const blob = await downloadZip(personaId, scope);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = personaInfo?.dni ? `${personaInfo.dni}-${personaInfo.nombre}_${personaInfo.apellido}_${scope}.zip`.replace(/\s+/g, '_') : `documentos_${personaId}_${scope}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error descargando ZIP:", err);
      alert("Error al descargar el ZIP. Verifica que el usuario tenga documentos.");
    }
  }

  if (loading) return <div className="text-base text-on-surface-variant">Cargando documentación...</div>

  const sections = [
    { value: ACTIVE, id: 'documentos-vigentes-title', icon: 'description', title: 'Vigentes', count: documentosActivos.length },
    { value: HISTORY, id: 'documentos-historial-title', icon: 'history', title: 'Historial', count: documentosHistoricos.length },
  ]
  const expiringCount = countByStatus(documentosActivos, 'por_vencer')
  const expiredCount = countByStatus(documentosActivos, 'vencido')

  return (
    <div className="flex flex-col">
      <TabHeader
        title="Documentación requerida"
        description="Habilitaciones, certificados y títulos de la persona."
      />

      <KpiGrid columns={3} className={`py-5 border-b border-surface-container ${INSET_PADDING_X_CLASS}`}>
        <KpiColumn label="Vigentes" value={countByStatus(documentosActivos, 'vigente')} />
        <KpiColumn label="Por vencer" value={expiringCount} tone={expiringCount ? 'text-amber-700' : 'text-on-surface'} />
        <KpiColumn label="Vencidos" value={expiredCount} tone={expiredCount ? 'text-error' : 'text-on-surface'} />
      </KpiGrid>

      <SegmentedTabs
        label="Documentación de la persona"
        sections={sections}
        value={activeSection}
        onChange={setActiveSection}
        panelId={PANEL_ID}
        className="mt-6"
      />

      <div className={TAB_PANEL_CLASS}>
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={sections.find((section) => section.value === activeSection).id}>
          {activeSection === ACTIVE && (
            <>
              {documentosActivos.length === 0 ? (
                <SectionEmpty>Todavía no hay documentación cargada para esta persona.</SectionEmpty>
              ) : (
                <PersonaDocumentsTable
                  documents={documentosActivos}
                  getTypeName={getNombreTipo}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteClick}
                />
              )}
              <TableFooter>
                <SecondaryButton icon="folder_zip" onClick={() => handleDownloadZip(ACTIVE)} disabled={documentosActivos.length === 0}>Descargar ZIP</SecondaryButton>
                <SecondaryButton icon="upload_file" onClick={handleNewClick}>Agregar documento</SecondaryButton>
              </TableFooter>
            </>
          )}
          {activeSection === HISTORY && (
            <>
              {documentosHistoricos.length === 0 ? (
                <SectionEmpty>No hay versiones anteriores de los documentos.</SectionEmpty>
              ) : (
                <PersonaDocumentsTable
                  documents={documentosHistoricos}
                  getTypeName={getNombreTipo}
                  onDelete={handleDeleteClick}
                  isHistory
                />
              )}
              <TableFooter>
                <SecondaryButton icon="folder_zip" onClick={() => handleDownloadZip(HISTORY)} disabled={documentosHistoricos.length === 0}>Descargar ZIP</SecondaryButton>
              </TableFooter>
            </>
          )}
        </div>
      </div>

      <DocumentacionUploadModal 
        isOpen={uploadModalOpen} 
        onClose={() => setUploadModalOpen(false)} 
        onSubmit={handleUploadSubmit} 
        form={uploadForm} 
        onChange={handleUploadChange} 
        tipos={tiposFiltrados} 
        isEditing={isEditing}
        error={saveError}
      />

      <DocumentacionDeleteModal 
        isOpen={deleteModalOpen} 
        onClose={() => setDeleteModalOpen(false)} 
        onConfirm={confirmDelete} 
        document={docToDelete} 
        typeName={docToDelete ? getNombreTipo(docToDelete.tipo_documento) : ''}
      />
    </div>
  )
}
