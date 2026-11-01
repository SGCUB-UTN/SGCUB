import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from '@mantine/core'
import { createDocumento, downloadPadronDocumentalPdf, updateDocumento } from '../api/documentacion'
import useDocumentacionPadron from '../hooks/useDocumentacionPadron'
import useDocumentUploadForm from '../hooks/useDocumentUploadForm'
import DocumentAffectedCategories from '../components/documental/DocumentAffectedCategories'
import DocumentPadronTable from '../components/documental/DocumentPadronTable'
import DocumentStatusChart from '../components/documental/DocumentStatusChart'
import DocumentacionUploadModal from '../components/documental/DocumentacionUploadModal'
import PadronComplianceChart from '../components/documental/PadronComplianceChart'
import { appliesToProfile } from '../components/documental/missingDocuments'
import { downloadDocumentalCsv } from '../components/documental/documentalCsv'
import { bulkDocumentNotice, selectionNotice } from '../components/documental/documentNotices'
import { INITIAL_FILTERS, PROFILES, filterRows, personaName, reportParams } from '../components/documental/padronDocumental'
import { PrimaryButton, SecondaryButton } from '../components/personas/tabs/parts'
import PageHeader from '../components/shared/PageHeader'
import SectionHeading from '../components/shared/SectionHeading'
import { KpiGrid } from '../components/shared/Kpi'
import { HeadingSkeleton, LineSkeletons, RingSkeleton, SkeletonBlock, SkeletonStatus, TableSkeletonRows } from '../components/shared/Skeleton'

const PANEL_CLASS = 'min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm overflow-hidden'
const HEADING_CLASS = 'px-4 sm:px-5 border-b'
const SECTION_CLASS = 'p-4 sm:p-5'
const TABLE_TITLE_ID = 'documental-table-title'

const withChangeNotice = (request) => async (...args) => {
  const result = await request(...args)
  window.dispatchEvent(new CustomEvent('documentacionCambiada'))
  return result
}

const saveNew = withChangeNotice(createDocumento)
const saveEdit = withChangeNotice(updateDocumento)

const MenuIcon = ({ name }) => <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">{name}</span>

function ExportMenu({ disabled, isExporting, onCsv, onPdf }) {
  return (
    <Menu position="bottom-end" shadow="md" width={260} disabled={disabled || isExporting}>
      <Menu.Target>
        <SecondaryButton icon={isExporting ? 'progress_activity' : 'file_download'} disabled={disabled || isExporting}>
          {isExporting ? 'Generando PDF...' : 'Exportar reporte'}
        </SecondaryButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Con los filtros de la tabla</Menu.Label>
        <Menu.Item icon={<MenuIcon name="table_view" />} onClick={onCsv}>Listado en CSV</Menu.Item>
        <Menu.Item icon={<MenuIcon name="picture_as_pdf" />} onClick={onPdf}>Reporte en PDF con resumen</Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}

function DashboardSkeleton() {
  return (
    <SkeletonStatus label="Cargando control documental..." className="flex flex-col gap-5">
      <div className={PANEL_CLASS}>
        <HeadingSkeleton />
        <div className={`${SECTION_CLASS} grid grid-cols-1 sm:grid-cols-3 gap-6`}>
          {[0, 1].map((index) => (
            <div key={index} className="flex items-center gap-4">
              <RingSkeleton size={120} stroke={16} />
              <LineSkeletons count={3} className="flex-1 flex flex-col gap-3" />
            </div>
          ))}
          <div className="flex flex-col gap-4">
            <SkeletonBlock soft className="h-3.5 w-40" />
            <LineSkeletons count={3} className="flex flex-col gap-4" />
          </div>
        </div>
      </div>
      <div className={PANEL_CLASS}>
        <HeadingSkeleton />
        <table className="w-full">
          <tbody>
            <TableSkeletonRows colSpan={6} animated={false} />
          </tbody>
        </table>
      </div>
    </SkeletonStatus>
  )
}

export default function DocumentacionDashboard() {
  const navigate = useNavigate()
  const { isLoading, error, personas, rows, tipos, resumen } = useDocumentacionPadron()
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [uploadRow, setUploadRow] = useState(null)
  const upload = useDocumentUploadForm({ tipos, create: saveNew, update: saveEdit })

  const uploadTipos = tipos.filter((tipo) => (
    String(tipo.id_tipo_documento) === String(upload.form.tipo_documento)
    || (uploadRow && tipo.activo && appliesToProfile(tipo, uploadRow.perfil))
  ))

  const openUpload = (row) => {
    setUploadRow(row)
    upload.openNew(row.persona_id, row.tipo_documento)
  }

  const disabledPlayers = personas.filter((persona) => !persona.habilitado && persona.perfil === PROFILES.JUGADOR)

  const notifyPersonas = (selected) => navigate('/comunicaciones', { state: { debtNotice: selectionNotice(selected) } })

  const notifyRow = (row) => notifyPersonas(personas.filter((persona) => persona.clave === row.clave))

  const notifyDisabled = () => navigate('/comunicaciones', { state: { debtNotice: bulkDocumentNotice(disabledPlayers) } })

  const exportPdf = async () => {
    setExportError('')
    setIsExporting(true)
    try {
      await downloadPadronDocumentalPdf(reportParams(filters))
    } catch {
      setExportError('No se pudo generar el PDF del reporte.')
    } finally {
      setIsExporting(false)
    }
  }

  const showTable = (nextFilters) => {
    setFilters(nextFilters)
    document.getElementById(TABLE_TITLE_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const selectCategory = (categoriaId) => showTable({ ...INITIAL_FILTERS, categoria: String(categoriaId) })

  const selectState = (estado) => showTable({ ...filters, estado })

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <div className="flex flex-col gap-1">
        <PageHeader
          breadcrumb={[{ label: 'Documental' }]}
          title="Control Documental"
          actions={(
            <div className="flex flex-wrap items-center gap-2.5">
              <PrimaryButton
                icon="notifications"
                onClick={notifyDisabled}
                disabled={disabledPlayers.length === 0}
                title="Prepara un aviso para los jugadores activos inhabilitados. Los docentes no se pueden notificar."
              >
                Notificar a inhabilitados{disabledPlayers.length > 0 && ` (${disabledPlayers.length})`}
              </PrimaryButton>
              <ExportMenu
                disabled={!resumen}
                isExporting={isExporting}
                onCsv={() => downloadDocumentalCsv(filterRows(rows, filters))}
                onPdf={exportPdf}
              />
            </div>
          )}
        />
        <p className="max-w-3xl font-body-md text-body-md text-on-surface-variant">
          Seguimiento de la documentación obligatoria de jugadores activos y docentes del club.
        </p>
      </div>

      {exportError && <p className="text-sm text-error" role="alert">{exportError}</p>}

      {error && !resumen && (
        <p className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container" role="alert">
          No se pudo cargar el control documental.
        </p>
      )}

      {isLoading && <DashboardSkeleton />}

      {resumen && (
        <>
          <section className={PANEL_CLASS} aria-labelledby="documental-summary-title">
            <SectionHeading id="documental-summary-title" icon="monitoring" title="Estado documental" className={HEADING_CLASS} />
            <div className={SECTION_CLASS}>
              <KpiGrid columns={3}>
                <PadronComplianceChart resumen={resumen} />
                <DocumentStatusChart counts={resumen.documentos} onSelect={selectState} />
                <DocumentAffectedCategories categories={resumen.categorias_afectadas} onSelect={selectCategory} />
              </KpiGrid>
            </div>
          </section>

          <section className={PANEL_CLASS} aria-labelledby={TABLE_TITLE_ID}>
            <SectionHeading id={TABLE_TITLE_ID} icon="fact_check" title="Documentación requerida" className={`${HEADING_CLASS} scroll-mt-4`} />
            <DocumentPadronTable
              rows={rows}
              personas={personas}
              filters={filters}
              onFiltersChange={setFilters}
              onUpload={openUpload}
              onNotify={notifyRow}
              onNotifyPersonas={notifyPersonas}
            />
          </section>
        </>
      )}

      <DocumentacionUploadModal
        isOpen={upload.isOpen}
        onClose={upload.close}
        onSubmit={upload.handleSubmit}
        form={upload.form}
        onChange={upload.handleChange}
        tipos={uploadTipos}
        isEditing={upload.isEditing}
        error={upload.error}
        subtitle={uploadRow ? `${personaName(uploadRow)} · DNI ${uploadRow.dni}` : undefined}
      />
    </div>
  )
}
