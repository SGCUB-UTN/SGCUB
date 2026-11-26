import { useMemo, useState } from 'react'
import { FILTER_CLASS } from '../shared/listFilters'
import { Link } from 'react-router-dom'
import { Menu } from '@mantine/core'
import DataTable from '../shared/DataTable'
import ExpandableRow from '../shared/ExpandableRow'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import StatusBadge from '../shared/StatusBadge'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import TableTabs from '../shared/TableTabs'
import { tabPanelId } from '../shared/tabIds'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'
import CategoryFilter from '../shared/CategoryFilter'
import ClearFiltersButton from '../shared/ClearFiltersButton'
import ExportMenu from '../shared/ExportMenu'
import SelectionBar from '../shared/SelectionBar'
import { PrimaryButton } from '../personas/tabs/parts'
import RowIconButton from '../shared/RowIconButton'
import { WhatsAppIcon } from '../finanzas/WhatsAppComprobanteButton'
import { openWhatsAppChat } from '../../utils/whatsapp'
import { NO_CATEGORY } from '../shared/categoryFilters'
import { TONOS_BADGE } from '../shared/statusTones'
import { formatCount } from '../cuota/cuotaPeriod'
import { formatDni } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import DocumentStatusBadge from './DocumentStatusBadge'
import { DOCUMENTAL_EXPORT_COLUMNS, PENDING_STATE_LABELS } from './documentalCsv'
import { FILE_MISSING_TOAST, openFile } from './documentFile'
import useToast from '../../hooks/useToast'
import { notifiablePersonas, whatsAppDocumentMessage } from './documentNotices'
import {
  ALL,
  DOCUMENT_STATES,
  INITIAL_FILTERS,
  PROFILES,
  PROFILE_LABELS,
  SITUATIONS,
  categoryLabel,
  categoryOptions,
  daysFromToday,
  documentTypeOptions,
  formatDate,
  matchesFilters,
  personaName,
  situationSortKey,
} from './padronDocumental'

const TABLE_ID = 'documental-padron'
const COLUMN_COUNT = 7
const PENDING_PREVIEW = 3
const HEADER_CLASS = 'py-3 px-4'
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer'

const TABS = [
  { value: ALL, label: 'Todas las personas', emptyText: 'No hay jugadores activos ni docentes con documentación obligatoria.' },
  { value: SITUATIONS.INHABILITADA, label: 'Inhabilitadas', emptyText: 'No hay personas inhabilitadas.', badgeClass: TONOS_BADGE.error },
  { value: SITUATIONS.POR_VENCER, label: 'Por vencer', emptyText: 'No hay personas con documentos por vencer.', badgeClass: TONOS_BADGE.alerta },
  { value: SITUATIONS.AL_DIA, label: 'Al día', emptyText: 'No hay personas con toda la documentación al día.' },
]

const SITUATION_BADGES = {
  [SITUATIONS.INHABILITADA]: { label: 'Inhabilitado', tono: 'error' },
  [SITUATIONS.POR_VENCER]: { label: 'Por vencer', tono: 'alerta' },
  [SITUATIONS.AL_DIA]: { label: 'Al día', tono: 'ok' },
}

const PROFILE_FILTERS = [
  { value: ALL, label: 'Perfil: Todos' },
  { value: PROFILES.DOCENTE, label: 'Docentes' },
  { value: PROFILES.JUGADOR, label: 'Jugadores activos' },
]

const SORT_VALUES = {
  person: (row) => personaName(row),
  category: (row) => row.categoriasLabel,
  situacion: situationSortKey,
}
const INITIAL_SORT = { columna: 'situacion', direccion: 'asc' }

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`

const stopPropagation = (event) => event.stopPropagation()

const PENDING_TONES = {
  [DOCUMENT_STATES.VENCIDO]: 'text-error',
  [DOCUMENT_STATES.FALTANTE]: 'text-error',
  [DOCUMENT_STATES.POR_VENCER]: 'text-amber-700',
}

const pendingDetail = (documento) => {
  if (documento.estado === DOCUMENT_STATES.FALTANTE) return { text: 'falta presentar', tone: 'text-error' }
  const days = documento.fecha_vencimiento ? daysFromToday(documento.fecha_vencimiento) : null
  if (documento.estado === DOCUMENT_STATES.VENCIDO) {
    return { text: days === null ? 'vencido' : `venció hace ${plural(-days, 'día', 'días')}`, tone: 'text-error' }
  }
  return { text: days === 0 ? 'vence hoy' : `vence en ${plural(days, 'día', 'días')}`, tone: 'text-amber-700' }
}

function PendingSummary({ row }) {
  if (row.pendientes.length === 0) {
    return <span className="text-on-surface-variant">{plural(row.documentos.length, 'documento vigente', 'documentos vigentes')}</span>
  }
  const hidden = row.pendientes.length - PENDING_PREVIEW
  return (
    <ul className="flex flex-col gap-0.5">
      {row.pendientes.slice(0, PENDING_PREVIEW).map((documento) => (
        <li key={documento.tipo_documento} className="text-base">
          <span className="font-medium text-on-surface">{documento.tipo_documento_nombre}</span>
          <span className={`font-semibold ${PENDING_TONES[documento.estado]}`}> · {PENDING_STATE_LABELS[documento.estado]}</span>
        </li>
      ))}
      {hidden > 0 && <li className="text-sm text-on-surface-variant">y {plural(hidden, 'documento más', 'documentos más')}</li>}
    </ul>
  )
}

function DueDate({ documento }) {
  if (documento.estado === DOCUMENT_STATES.FALTANTE) return <span className="text-on-surface-variant">Sin presentar</span>
  if (!documento.fecha_vencimiento) return <span className="text-on-surface-variant">Sin vencimiento</span>
  const detail = documento.estado === DOCUMENT_STATES.VIGENTE ? null : pendingDetail(documento)
  return (
    <span className="tabular-nums">
      <span className="text-on-surface">Vence el {formatDate(documento.fecha_vencimiento)}</span>
      {detail && <span className={`font-semibold ${detail.tone}`}> · {detail.text}</span>}
    </span>
  )
}

const uploadLabel = (documento) => {
  if (documento.estado === DOCUMENT_STATES.FALTANTE) return 'Cargar'
  if (documento.estado === DOCUMENT_STATES.VIGENTE) return 'Cargar nuevo'
  return 'Renovar'
}

function PersonDocuments({ row, onUpload }) {
  const { showToast } = useToast()
  const name = personaName(row)
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-outline-variant/30 rounded-lg border border-outline-variant/30 bg-surface-container-lowest">
        {row.documentos.map((documento) => (
          <li key={documento.tipo_documento} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3">
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-on-surface">
                {documento.tipo_documento_nombre}
                {!documento.obligatorio && <span className="font-normal text-on-surface-variant"> (opcional)</span>}
              </p>
              <p className="text-base"><DueDate documento={documento} /></p>
            </div>
            <DocumentStatusBadge status={documento.estado} />
            <div className="flex items-center gap-1 sm:justify-end sm:w-56">
              {documento.archivo_url && (
                <button
                  type="button"
                  onClick={() => openFile(documento.archivo_url, () => showToast(FILE_MISSING_TOAST))}
                  className={`${TEXT_BUTTON_CLASS} text-base`}
                  aria-label={`Ver ${documento.tipo_documento_nombre} de ${name}`}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
                  Ver
                </button>
              )}
              <button
                type="button"
                onClick={() => onUpload({ ...row, ...documento })}
                className={`${TEXT_BUTTON_CLASS} text-base`}
                aria-label={`${uploadLabel(documento)} ${documento.tipo_documento_nombre} de ${name}`}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">upload_file</span>
                {uploadLabel(documento)}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SelectAllCheckbox({ rows, selectedKeys, onChange }) {
  const selectedCount = rows.filter((row) => selectedKeys.has(row.key)).length
  const allSelected = rows.length > 0 && selectedCount === rows.length
  return (
    <input
      type="checkbox"
      className={CHECKBOX_CLASS}
      checked={allSelected}
      ref={(element) => {
        if (element) element.indeterminate = selectedCount > 0 && !allSelected
      }}
      disabled={rows.length === 0}
      onChange={() => onChange(!allSelected)}
      aria-label={allSelected ? 'Quitar la selección de todas las personas filtradas' : 'Seleccionar todas las personas filtradas'}
    />
  )
}

const hasPhone = (phone) => String(phone ?? '').replace(/\D/g, '').length >= 6

const contactLabel = (contacto) => `${contacto.nombre} ${contacto.apellido} (${contacto.relacion})`

function WhatsAppAction({ row }) {
  const name = personaName(row)
  const send = (phone, contacto) => openWhatsAppChat({ phone, message: whatsAppDocumentMessage(row, contacto) })

  if (!row.menor) {
    return (
      <RowIconButton
        tone="whatsapp"
        label={`Avisar a ${name} por WhatsApp`}
        disabledReason={hasPhone(row.telefono) ? '' : 'No tiene un teléfono cargado'}
        onClick={() => send(row.telefono)}
      >
        <WhatsAppIcon className="w-[18px] h-[18px]" />
      </RowIconButton>
    )
  }

  if (row.contactos.length === 0) {
    return (
      <RowIconButton tone="whatsapp" label={`Avisar por WhatsApp a un familiar de ${name}`} disabledReason="Es menor y no tiene familiares cargados">
        <WhatsAppIcon className="w-[18px] h-[18px]" />
      </RowIconButton>
    )
  }

  return (
    <div className="inline-flex" onClick={stopPropagation} onKeyDown={stopPropagation}>
      <Menu position="bottom-end" shadow="md" width={280} withinPortal>
        <Menu.Target>
          <button
            type="button"
            aria-label={`Avisar por WhatsApp a un familiar de ${name}`}
            title="Elegir a qué familiar avisarle"
            className="inline-flex items-center justify-center size-9 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <WhatsAppIcon className="w-[18px] h-[18px]" />
          </button>
        </Menu.Target>
        <Menu.Dropdown className="p-1">
          <Menu.Label>Es menor: elegí a quién avisarle</Menu.Label>
          {row.contactos.map((contacto) => (
            <Menu.Item
              key={`${contacto.nombre}-${contacto.apellido}-${contacto.relacion}`}
              disabled={!hasPhone(contacto.telefono)}
              onClick={() => send(contacto.telefono, contacto)}
            >
              <span className="block text-base text-on-surface">{contactLabel(contacto)}</span>
              <span className="block text-sm text-on-surface-variant">
                {hasPhone(contacto.telefono) ? contacto.telefono : 'Sin teléfono cargado'}
                {contacto.responsable_legal && ' · Responsable legal'}
              </span>
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
    </div>
  )
}

function RowActions({ row }) {
  if (row.pendientes.length === 0) return null
  return (
    <div className="flex justify-end">
      <WhatsAppAction row={row} />
    </div>
  )
}

export default function DocumentPadronTable({ rows, personas, filters, onFiltersChange, onUpload, onNotifyPersonas }) {
  const categories = useMemo(() => categoryOptions(personas), [personas])
  const hasUncategorized = personas.some((persona) => persona.categorias.length === 0)
  const documentTypes = useMemo(() => documentTypeOptions(rows), [rows])

  const matching = useMemo(() => rows.filter((row) => matchesFilters(row, filters)), [rows, filters])
  const tabs = TABS.map((tab) => ({
    ...tab,
    count: tab.value === ALL ? matching.length : matching.filter((row) => row.situacion === tab.value).length,
  }))
  const activeTab = tabs.find((tab) => tab.value === filters.situacion)
  const filtered = useMemo(
    () => (filters.situacion === ALL ? matching : matching.filter((row) => row.situacion === filters.situacion)),
    [matching, filters.situacion],
  )

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const [expandedKey, setExpandedKey] = useState(null)
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const [shownFilters, setShownFilters] = useState(filters)
  if (shownFilters !== filters) {
    setShownFilters(filters)
    setSelectedKeys(new Set())
    resetPage()
  }

  const selectedRows = useMemo(() => sorted.filter((row) => selectedKeys.has(row.key)), [sorted, selectedKeys])
  const notifiable = useMemo(() => notifiablePersonas(selectedRows), [selectedRows])
  const excludedFromEmail = selectedRows.length - notifiable.length

  const toggleRow = (key) => setSelectedKeys((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const toggleFiltered = (select) => setSelectedKeys((current) => {
    const next = new Set(current)
    filtered.forEach((row) => (select ? next.add(row.key) : next.delete(row.key)))
    return next
  })

  const change = (field) => (value) => onFiltersChange({ ...filters, [field]: value })
  const hasFilters = Object.keys(INITIAL_FILTERS).some((field) => (
    field === 'search' ? filters.search.trim() !== '' : filters[field] !== INITIAL_FILTERS[field]
  ))
  const clearFilters = () => onFiltersChange(INITIAL_FILTERS)

  const emptyText = matching.length === rows.length ? activeTab.emptyText : 'Ninguna persona coincide con la búsqueda o los filtros.'

  return (
    <div className="min-w-0">
      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={filters.search}
            onChange={change('search')}
            placeholder="Nombre o DNI"
            label="Buscar por nombre o DNI"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={filters.perfil}
            onChange={(event) => change('perfil')(event.target.value)}
            aria-label="Filtrar por perfil"
          >
            {PROFILE_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            value={filters.tipo}
            onChange={(event) => change('tipo')(event.target.value)}
            aria-label="Filtrar por documento requerido"
          >
            <option value={ALL}>Documento: Todos</option>
            {documentTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </FilterSelect>
          <CategoryFilter
            value={filters.categoria}
            categories={categories}
            hasUncategorized={hasUncategorized}
            onChange={change('categoria')}
          />
          <ClearFiltersButton onClick={clearFilters} visible={hasFilters} />
        </div>
      </div>

      <TableTabs id={TABLE_ID} label="Situación documental" options={tabs} value={filters.situacion} onChange={change('situacion')} />

      {selectedRows.length > 0 && (
        <SelectionBar
          count={selectedRows.length}
          singular="persona seleccionada"
          plural="personas seleccionadas"
          detail={excludedFromEmail > 0 && (excludedFromEmail === 1
            ? '1 queda afuera del email por ser docente o estar al día'
            : `${formatCount(excludedFromEmail)} quedan afuera del email por ser docentes o estar al día`)}
          onClear={() => setSelectedKeys(new Set())}
        >
          <PrimaryButton
            icon="mail"
            onClick={() => onNotifyPersonas(notifiable)}
            disabled={notifiable.length === 0}
            title={notifiable.length === 0
              ? 'Solo se avisa por email a jugadores activos con documentos vencidos, por vencer o faltantes'
              : 'Prepara un email para los jugadores de la selección. Los docentes y quienes están al día quedan afuera.'}
          >
            Avisar por email{notifiable.length > 0 && ` (${formatCount(notifiable.length)})`}
          </PrimaryButton>
          <ExportMenu
            title="Control documental: personas seleccionadas"
            filename="control-documental-seleccion"
            columns={DOCUMENTAL_EXPORT_COLUMNS}
            items={selectedRows}
            filters={[selectedRows.length === 1 ? '1 persona seleccionada' : `${formatCount(selectedRows.length)} personas seleccionadas`]}
          />
        </SelectionBar>
      )}

      <div id={tabPanelId(TABLE_ID)} role="tabpanel" aria-label={`Personas: ${activeTab.label}`}>
        <DataTable
          headers={(
            <>
              <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
              <th className="py-3 px-2 w-10" scope="col">
                <SelectAllCheckbox rows={filtered} selectedKeys={selectedKeys} onChange={toggleFiltered} />
              </th>
              <SortableHeader className={HEADER_CLASS} etiqueta="Persona" columna="person" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Categoría" columna="category" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Situación" columna="situacion" orden={sort} onOrdenar={sortAndReset} />
              <th className={HEADER_CLASS} scope="col">Documentación pendiente</th>
              <th className={`${HEADER_CLASS} sm:pr-5 text-right`} scope="col">Acciones</th>
            </>
          )}
        >
          <TableMessageRow
            colSpan={COLUMN_COUNT}
            isEmpty={visibleRows.length === 0}
            emptyText={emptyText}
            onClearFilters={hasFilters ? clearFilters : undefined}
          />

          {visibleRows.map((row) => (
            <ExpandableRow
              key={row.key}
              expanded={expandedKey === row.key}
              onToggle={() => setExpandedKey((current) => (current === row.key ? null : row.key))}
              label={`${personaName(row)}, ${SITUATION_BADGES[row.situacion].label}. Ver sus documentos`}
              colSpan={COLUMN_COUNT}
              detail={<PersonDocuments row={row} onUpload={onUpload} />}
            >
              <td className="py-3 px-2" onClick={stopPropagation} onKeyDown={stopPropagation}>
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={selectedKeys.has(row.key)}
                  onChange={() => toggleRow(row.key)}
                  aria-label={`Seleccionar a ${personaName(row)}`}
                />
              </td>
              <td className="py-3 px-4">
                <Link
                  to={`${row.url_perfil}?tab=documentacion`}
                  onClick={stopPropagation}
                  onKeyDown={stopPropagation}
                  className="font-medium text-on-surface hover:text-primary hover:underline"
                >
                  {personaName(row)}
                </Link>
                <div className="text-sm text-on-surface-variant">
                  {PROFILE_LABELS[row.perfil]} · DNI {formatDni(row.dni)}
                </div>
              </td>
              <td className="py-3 px-4">
                {row.categorias.length > 0
                  ? row.categorias.map((categoria) => <span key={categoria.categoria_id} className="block">{categoryLabel(categoria)}</span>)
                  : <span className="text-on-surface-variant">{NO_CATEGORY}</span>}
              </td>
              <td className="py-3 px-4 whitespace-nowrap"><StatusBadge size="md" badge={SITUATION_BADGES[row.situacion]} /></td>
              <td className="py-3 px-4"><PendingSummary row={row} /></td>
              <td className="py-3 px-4 sm:pr-5 text-right"><RowActions row={row} /></td>
            </ExpandableRow>
          ))}
        </DataTable>
      </div>

      <TablePagination id="documental-padron-rows-per-page" {...paginationProps} />
    </div>
  )
}
