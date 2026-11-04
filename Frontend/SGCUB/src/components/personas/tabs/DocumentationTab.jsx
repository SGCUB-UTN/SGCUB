import { useState } from 'react'
import { SecondaryButton, SegmentedTabs, TAB_PANEL_CLASS, TableFooter, TabHeader } from './parts'
import useDocumentacion from '../../../hooks/useDocumentacion'
import useDocumentUploadForm from '../../../hooks/useDocumentUploadForm'
import DocumentacionUploadModal from '../../documental/DocumentacionUploadModal'
import DocumentacionDeleteModal from '../../documental/DocumentacionDeleteModal'
import PersonaDocumentsTable from '../../documental/PersonaDocumentsTable'
import MissingDocumentsTable from '../../documental/MissingDocumentsTable'
import { appliesToProfile, findMissingDocumentTypes } from '../../documental/missingDocuments'
import { SectionEmpty } from '../../shared/FlushSection'
import { INSET_PADDING_X_CLASS } from '../../shared/flushTable'
import { KpiColumn, KpiGrid } from '../../shared/Kpi'
import { ListSkeleton } from '../../shared/Skeleton'

const ACTIVE = 'vigentes'
const HISTORY = 'historial'
const PANEL_ID = 'documentation-section-panel'

const countByStatus = (documents, status) => documents.filter((doc) => doc.status === status).length

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
  const upload = useDocumentUploadForm({ tipos, create: subirDocumento, update: actualizarDocumento })

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState(null)
  const [activeSection, setActiveSection] = useState(ACTIVE)

  // Enabled types that apply to this profile; when editing, the document's own type is always offered
  const tiposFiltrados = tipos.filter(t => (
    String(t.id_tipo_documento) === String(upload.form.tipo_documento)
    || (t.activo && appliesToProfile(t, personaType))
  ))
  const missingTipos = findMissingDocumentTypes(tipos, documentosActivos, personaType)

  const handleDeleteClick = (doc) => {
    setDocToDelete(doc)
    setDeleteModalOpen(true)
  }

  const handleNewClick = (tipo = null) => upload.openNew(personaId, tipo ? tipo.id_tipo_documento : '')

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

  if (loading) return <ListSkeleton label="Cargando documentación..." rows={4} />

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

      <KpiGrid columns={4} className={`py-5 border-b border-surface-container ${INSET_PADDING_X_CLASS}`}>
        <KpiColumn label="Vigentes" value={countByStatus(documentosActivos, 'vigente')} />
        <KpiColumn label="Por vencer" value={expiringCount} tone={expiringCount ? 'text-amber-700' : 'text-on-surface'} />
        <KpiColumn label="Vencidos" value={expiredCount} tone={expiredCount ? 'text-error' : 'text-on-surface'} />
        <KpiColumn label="Faltantes" value={missingTipos.length} tone={missingTipos.length ? 'text-error' : 'text-on-surface'} />
      </KpiGrid>

      {missingTipos.length > 0 && (
        <MissingDocumentsTable tipos={missingTipos} onUpload={handleNewClick} className="mt-6" />
      )}

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
                  onEdit={upload.openEdit}
                  onDelete={handleDeleteClick}
                />
              )}
              <TableFooter>
                <SecondaryButton icon="folder_zip" onClick={() => handleDownloadZip(ACTIVE)} disabled={documentosActivos.length === 0 && !personaInfo?.foto_url}>Descargar ZIP</SecondaryButton>
                <SecondaryButton icon="upload_file" onClick={() => handleNewClick()}>Agregar documento</SecondaryButton>
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
        isOpen={upload.isOpen} 
        onClose={upload.close} 
        onSubmit={upload.handleSubmit} 
        form={upload.form} 
        onChange={upload.handleChange} 
        tipos={tiposFiltrados} 
        isEditing={upload.isEditing}
        error={upload.error}
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
