import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import TableTabs from '../shared/TableTabs'
import { tabPanelId } from '../shared/tabIds'
import CategoryFilter from '../cuota/CategoryFilter'
import { NO_CATEGORY } from '../cuota/cuotaCategories'
import { formatCount } from '../cuota/cuotaPeriod'
import { formatDni } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import DocumentStatusBadge from './DocumentStatusBadge'
import { downloadDocumentalCsv } from './documentalCsv'
import { openFile } from './documentFile'
import { notifiablePersonas } from './documentNotices'
import {
  ALL,
  DOCUMENT_STATES,
  PROFILES,
  PROFILE_LABELS,
  STATE_ORDER,
  categoryOptions,
  daysFromToday,
  documentTypeOptions,
  formatDate,
  matchesFilters,
  personaName,
} from './padronDocumental'

const TABLE_ID = 'documental-padron'
const COLUMN_COUNT = 7
const HEADER_CLASS = 'py-3 px-4'
const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer'
const TOOL_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600/60 disabled:opacity-50 disabled:cursor-not-allowed'
const ICON_BUTTON_CLASS = 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant'

const TABS = [
  { value: ALL, label: 'Todos los documentos', emptyText: 'No hay documentos obligatorios para jugadores activos ni docentes.' },
  { value: DOCUMENT_STATES.VENCIDO, label: 'Vencidos', emptyText: 'No hay documentos vencidos.', badgeClass: 'bg-error-container text-on-error-container' },
  { value: DOCUMENT_STATES.POR_VENCER, label: 'Próximos a vencer', emptyText: 'No hay documentos próximos a vencer.', badgeClass: 'bg-amber-100 text-amber-800' },
  { value: DOCUMENT_STATES.FALTANTE, label: 'Faltantes', emptyText: 'No hay documentos faltantes.' },
  { value: DOCUMENT_STATES.VIGENTE, label: 'Vigentes', emptyText: 'No hay documentos vigentes.' },
]

const PROFILE_FILTERS = [
  { value: ALL, label: 'Perfil: Todos' },
  { value: PROFILES.DOCENTE, label: 'Docentes' },
  { value: PROFILES.JUGADOR, label: 'Jugadores activos' },
]

const SORT_VALUES = {
  person: (row) => personaName(row),
  category: (row) => row.categoriasLabel,
  document: (row) => row.tipo_documento_nombre,
  estado: (row) => STATE_ORDER.indexOf(row.estado),
  dueDate: (row) => row.fecha_vencimiento,
}
const INITIAL_SORT = { columna: 'estado', direccion: 'asc' }

const plural = (count, singular, pluralForm) => `${count} ${count === 1 ? singular : pluralForm}`

function DueDateCell({ row }) {
  if (row.estado === DOCUMENT_STATES.FALTANTE) return <span className="text-on-surface-variant">—</span>
  if (!row.fecha_vencimiento) return <span className="text-on-surface-variant">Sin vencimiento</span>
  const days = daysFromToday(row.fecha_vencimiento)
  return (
    <>
      <span className="block font-medium text-on-surface tabular-nums">{formatDate(row.fecha_vencimiento)}</span>
      {row.estado === DOCUMENT_STATES.VENCIDO && (
        <span className="block text-xs font-semibold text-error">Venció hace {plural(-days, 'día', 'días')}</span>
      )}
      {row.estado === DOCUMENT_STATES.POR_VENCER && (
        <span className="block text-xs font-semibold text-amber-700">{days === 0 ? 'Vence hoy' : `Vence en ${plural(days, 'día', 'días')}`}</span>
      )}
    </>
  )
}

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size }} aria-hidden="true">{name}</span>
)

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
      aria-label={allSelected ? 'Quitar la selección de todos los documentos filtrados' : 'Seleccionar todos los documentos filtrados'}
    />
  )
}

function BulkActionsBar({ rows, notifiable, onNotify, onExport, onClear }) {
  const personCount = new Set(rows.map((row) => row.clave)).size
  const notifyTitle = notifiable.length === 0
    ? 'Solo se notifica a jugadores activos con documentos vencidos, próximos a vencer o faltantes'
    : 'Prepara un aviso para los jugadores de la selección. Los docentes y los documentos vigentes quedan afuera.'
  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 bg-sky-100 border-b border-sky-300 border-l-4 border-l-sky-600"
    >
      <p className="flex items-center gap-2 text-sm text-sky-900">
        <span className="material-symbols-outlined text-sky-700" style={{ fontSize: 20 }} aria-hidden="true">check_box</span>
        <span>
          <strong className="font-bold">{formatCount(rows.length)}</strong> {rows.length === 1 ? 'documento seleccionado' : 'documentos seleccionados'}
          <span className="text-sky-800"> · {plural(personCount, 'persona', 'personas')}</span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <button type="button" onClick={onNotify} disabled={notifiable.length === 0} title={notifyTitle} className={`${TOOL_BUTTON_CLASS} bg-sky-600 border-sky-600 text-white hover:bg-sky-700`}>
          <Icon name="notifications" />
          Notificar{notifiable.length > 0 && ` (${formatCount(notifiable.length)})`}
        </button>
        <button type="button" onClick={onExport} className={`${TOOL_BUTTON_CLASS} bg-surface-container-lowest border-sky-300 text-sky-900 hover:bg-sky-50`}>
          <Icon name="download" />
          Exportar CSV
        </button>
        <button type="button" onClick={onClear} className={`${TOOL_BUTTON_CLASS} border-transparent text-sky-800 hover:bg-sky-200/60`}>
          <Icon name="close" />
          Quitar selección
        </button>
      </div>
    </div>
  )
}

const notifyBlockReason = (row) => {
  if (row.perfil === PROFILES.DOCENTE) return 'Los docentes no se pueden notificar'
  if (row.estado === DOCUMENT_STATES.VIGENTE) return 'El documento está vigente'
  return null
}

function RowActions({ row, onNotify, onUpload }) {
  const name = personaName(row)
  const notifyBlocker = notifyBlockReason(row)
  const notifyLabel = notifyBlocker ?? `Notificar a ${name}`
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        onClick={() => openFile(row.archivo_url)}
        disabled={!row.archivo_url}
        className={ICON_BUTTON_CLASS}
        aria-label={row.archivo_url ? `Ver ${row.tipo_documento_nombre} de ${name}` : 'Sin archivo cargado'}
        title={row.archivo_url ? 'Ver documento' : 'Sin archivo cargado'}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">visibility</span>
      </button>
      <button type="button" onClick={() => onNotify(row)} disabled={Boolean(notifyBlocker)} className={ICON_BUTTON_CLASS} aria-label={notifyLabel} title={notifyLabel}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">notifications</span>
      </button>
      <button type="button" onClick={() => onUpload(row)} className={ICON_BUTTON_CLASS} aria-label={`Cargar ${row.tipo_documento_nombre} de ${name}`} title="Cargar documento">
        <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">upload_file</span>
      </button>
    </div>
  )
}

export default function DocumentPadronTable({ rows, personas, filters, onFiltersChange, onUpload, onNotify, onNotifyPersonas }) {
  const categories = useMemo(() => categoryOptions(personas), [personas])
  const hasUncategorized = personas.some((persona) => persona.categorias.length === 0)
  const documentTypes = useMemo(() => documentTypeOptions(rows), [rows])

  const matching = useMemo(() => rows.filter((row) => matchesFilters(row, filters)), [rows, filters])
  const tabs = TABS.map((tab) => ({
    ...tab,
    count: tab.value === ALL ? matching.length : matching.filter((row) => row.estado === tab.value).length,
  }))
  const activeTab = tabs.find((tab) => tab.value === filters.estado)
  const filtered = useMemo(
    () => (filters.estado === ALL ? matching : matching.filter((row) => row.estado === filters.estado)),
    [matching, filters.estado],
  )

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const [shownFilters, setShownFilters] = useState(filters)
  if (shownFilters !== filters) {
    setShownFilters(filters)
    resetPage()
  }

  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const selectedRows = useMemo(() => rows.filter((row) => selectedKeys.has(row.key)), [rows, selectedKeys])
  const notifiable = useMemo(() => notifiablePersonas(selectedRows, personas), [selectedRows, personas])

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

  const emptyText = matching.length === rows.length ? activeTab.emptyText : 'Ningún documento coincide con la búsqueda o los filtros.'

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
            aria-label="Filtrar por tipo de documento"
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
        </div>
      </div>

      <TableTabs id={TABLE_ID} label="Estado del documento" options={tabs} value={filters.estado} onChange={change('estado')} />

      {selectedRows.length > 0 && (
        <BulkActionsBar
          rows={selectedRows}
          notifiable={notifiable}
          onNotify={() => onNotifyPersonas(notifiable)}
          onExport={() => downloadDocumentalCsv(selectedRows, filters.estado)}
          onClear={() => setSelectedKeys(new Set())}
        />
      )}

      <div id={tabPanelId(TABLE_ID)} role="tabpanel" aria-label={`Documentos: ${activeTab.label}`}>
        <DataTable
          headers={(
            <>
              <th className="py-3 pl-4 sm:pl-5 pr-2 w-10" scope="col">
                <SelectAllCheckbox rows={filtered} selectedKeys={selectedKeys} onChange={toggleFiltered} />
              </th>
              <SortableHeader className={HEADER_CLASS} etiqueta="Jugador activo / Docente" columna="person" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Categoría" columna="category" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Documento requerido" columna="document" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Estado" columna="estado" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Vencimiento" columna="dueDate" orden={sort} onOrdenar={sortAndReset} />
              <th className={`${HEADER_CLASS} sm:pr-5 text-right`} scope="col">Acciones</th>
            </>
          )}
        >
          <TableMessageRow colSpan={COLUMN_COUNT} isEmpty={visibleRows.length === 0} emptyText={emptyText} />

          {visibleRows.map((row) => (
            <tr key={row.key} className={`transition-colors ${selectedKeys.has(row.key) ? 'bg-primary/5' : 'hover:bg-surface-container-low/80'}`}>
              <td className="py-3 pl-4 sm:pl-5 pr-2">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={selectedKeys.has(row.key)}
                  onChange={() => toggleRow(row.key)}
                  aria-label={`Seleccionar ${row.tipo_documento_nombre} de ${personaName(row)}`}
                />
              </td>
              <td className="py-3 px-4">
                <Link to={`${row.url_perfil}?tab=documentacion`} className="font-medium text-on-surface hover:text-primary hover:underline">
                  {personaName(row)}
                </Link>
                <div className="text-xs text-on-surface-variant">
                  {PROFILE_LABELS[row.perfil]} · DNI {formatDni(row.dni)}
                </div>
              </td>
              <td className="py-3 px-4 text-sm">
                {row.categoriasLabel || <span className="text-on-surface-variant">{NO_CATEGORY}</span>}
              </td>
              <td className="py-3 px-4">
                <span className="block font-medium">{row.tipo_documento_nombre}</span>
                {!row.obligatorio && <span className="block text-xs text-on-surface-variant">Opcional</span>}
              </td>
              <td className="py-3 px-4 whitespace-nowrap"><DocumentStatusBadge status={row.estado} /></td>
              <td className="py-3 px-4 whitespace-nowrap"><DueDateCell row={row} /></td>
              <td className="py-3 px-4 sm:pr-5"><RowActions row={row} onNotify={onNotify} onUpload={onUpload} /></td>
            </tr>
          ))}
        </DataTable>
      </div>

      <TablePagination id="documental-padron-rows-per-page" {...paginationProps} />
    </div>
  )
}
