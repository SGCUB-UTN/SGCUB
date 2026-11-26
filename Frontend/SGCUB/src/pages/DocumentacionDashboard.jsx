import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu } from '@mantine/core'
import { createDocumento, downloadPadronDocumentalPdf, updateDocumento } from '../api/documentacion'
import useDocumentacionPadron from '../hooks/useDocumentacionPadron'
import useDocumentUploadForm from '../hooks/useDocumentUploadForm'
import DocumentAffectedCategories from '../components/documental/DocumentAffectedCategories'
import DocumentPadronTable from '../components/documental/DocumentPadronTable'
import DocumentacionUploadModal from '../components/documental/DocumentacionUploadModal'
import PadronComplianceChart from '../components/documental/PadronComplianceChart'
import { appliesToProfile } from '../components/documental/missingDocuments'
import { downloadDocumentalCsv } from '../components/documental/documentalCsv'
import { bulkDocumentNotice, selectionNotice } from '../components/documental/documentNotices'
import { INITIAL_FILTERS, PROFILES, affectedCategories, filterRows, personaName, reportParams } from '../components/documental/padronDocumental'
import { PrimaryButton, SecondaryButton } from '../components/personas/tabs/parts'
import PageHeader from '../components/shared/PageHeader'
import SectionHeading from '../components/shared/SectionHeading'
import { HeadingSkeleton, LineSkeletons, RingSkeleton, SkeletonBlock, SkeletonStatus, TableSkeletonRows } from '../components/shared/Skeleton'

const PANEL_CLASS = 'min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm overflow-hidden'
const HEADING_CLASS = 'px-4 sm:px-5 border-b'
const SECTION_CLASS = 'p-4 sm:p-5'
const TABLE_TITLE_ID = 'documental-table-title'
const SUMMARY_GRID_CLASS = 'grid grid-cols-1 gap-6 divide-outline-variant/40 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-0 lg:divide-x lg:[&>*]:px-8 lg:[&>*:first-child]:pl-0 lg:[&>*:last-child]:pr-0'

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
        <div className={`${SECTION_CLASS} grid grid-cols-1 lg:grid-cols-2 gap-6`}>
          <div className="flex items-center gap-4">
            <RingSkeleton size={112} stroke={14} />
            <LineSkeletons count={3} className="flex-1 flex flex-col gap-3" />
          </div>
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
            <TableSkeletonRows colSpan={7} animated={false} />
          </tbody>
        </table>
      </div>
    </SkeletonStatus>
  )
}

export default function DocumentacionDashboard() {
  const navigate = useNavigate()
  const { isLoading, error, personas, rows, tipos, resumen, reload } = useDocumentacionPadron()
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

  const exportableRows = filterRows(rows, filters)
  const categories = useMemo(() => affectedCategories(rows), [rows])
  const withoutDocuments = rows.length > 0 && rows.every((row) => row.documentos.length === 0)
  const disabledPlayers = personas.filter((persona) => !persona.habilitado && persona.perfil === PROFILES.JUGADOR)

  const notifyPersonas = (selected) => navigate('/comunicaciones', { state: { debtNotice: selectionNotice(selected) } })


  const notifyDisabled = () => navigate('/comunicaciones', { state: { debtNotice: bulkDocumentNotice(disabledPlayers) } })

  const exportPdf = async () => {
    setExportError('')
    setIsExporting(true)
    try {
      await downloadPadronDocumentalPdf(reportParams(filters))
    } catch {
      setExportError('No se pudo generar el PDF del reporte. Probá de nuevo.')
    } finally {
      setIsExporting(false)
    }
  }

  const showTable = (nextFilters) => {
    setFilters(nextFilters)
    document.getElementById(TABLE_TITLE_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const selectCategory = (categoriaId) => showTable({ ...filters, categoria: String(categoriaId) })

  const selectSituation = (situacion) => showTable({ ...filters, situacion })

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
                title={disabledPlayers.length === 0
                  ? 'No hay jugadores activos inhabilitados para avisar'
                  : 'Prepara un email para los jugadores activos inhabilitados en Comunicaciones'}
              >
                Avisar por email a inhabilitados{disabledPlayers.length > 0 && ` (${disabledPlayers.length})`}
              </PrimaryButton>
              <ExportMenu
                disabled={!resumen || exportableRows.length === 0}
                isExporting={isExporting}
                onCsv={() => downloadDocumentalCsv(exportableRows, filters.situacion)}
                onPdf={exportPdf}
              />
            </div>
          )}
        />
      </div>

      {exportError && <p className="text-base text-error" role="alert">{exportError}</p>}

      {error && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-error-container/40 border border-error/20 rounded-md text-on-error-container" role="alert">
          <span className="material-symbols-outlined text-[20px] shrink-0" aria-hidden="true">cloud_off</span>
          <p className="flex-1 text-base">
            {resumen
              ? 'No pudimos actualizar el control documental. Estás viendo los últimos datos que se cargaron.'
              : 'No pudimos traer el control documental. Revisá la conexión y probá de nuevo.'}
          </p>
          <SecondaryButton icon="refresh" onClick={reload}>Reintentar</SecondaryButton>
        </div>
      )}

      {isLoading && <DashboardSkeleton />}

      {resumen && (
        <>
          <section className={PANEL_CLASS} aria-labelledby="documental-summary-title">
            <SectionHeading id="documental-summary-title" icon="monitoring" title="Estado documental" className={HEADING_CLASS} />
            <div className={SECTION_CLASS}>
              {withoutDocuments ? (
                <div className="flex flex-col items-start gap-2 text-base text-on-surface-variant">
                  <p>No hay documentación obligatoria configurada para jugadores activos ni docentes, así que todavía no hay nada que controlar.</p>
                  <Link to="/configuracion?tab=documentacion" className="font-semibold text-primary hover:underline">
                    Configurar documentos obligatorios
                  </Link>
                </div>
              ) : (
                <div className={SUMMARY_GRID_CLASS}>
                  <PadronComplianceChart rows={rows} onSelect={selectSituation} />
                  <DocumentAffectedCategories categories={categories} onSelect={selectCategory} />
                </div>
              )}
            </div>
          </section>

          <section className={PANEL_CLASS} aria-labelledby={TABLE_TITLE_ID}>
            <SectionHeading id={TABLE_TITLE_ID} icon="fact_check" title="Personas y documentación" className={`${HEADING_CLASS} scroll-mt-4`} />
            <DocumentPadronTable
              rows={rows}
              personas={personas}
              filters={filters}
              onFiltersChange={setFilters}
              onUpload={openUpload}
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
        saving={upload.saving}
        subtitle={uploadRow ? `${personaName(uploadRow)} · DNI ${uploadRow.dni}` : undefined}
      />
    </div>
  )
}
