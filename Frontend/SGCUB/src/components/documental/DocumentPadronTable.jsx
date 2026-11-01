import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import CategoryFilter from '../cuota/CategoryFilter'
import { NO_CATEGORY } from '../cuota/cuotaCategories'
import { formatCount } from '../cuota/cuotaPeriod'
import { formatDni } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import DocumentStatusBadge from './DocumentStatusBadge'
import {
  ALL,
  DOCUMENT_STATES,
  PROFILES,
  PROFILE_LABELS,
  STATE_ORDER,
  categoryOptions,
  daysFromToday,
  formatDate,
  matchesFilters,
  personaName,
} from './padronDocumental'

const TABLE_PANEL_ID = 'documental-padron-panel'
const COLUMN_COUNT = 6
const HEADER_CLASS = 'py-3 px-4'
const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const TAB_CLASS = 'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-surface-container-low'
const ICON_BUTTON_CLASS = 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-on-surface-variant'

const TABS = [
  { value: ALL, label: 'Todos los documentos', emptyText: 'No hay documentos obligatorios para jugadores activos ni docentes.' },
  { value: DOCUMENT_STATES.VENCIDO, label: 'Vencidos', emptyText: 'No hay documentos vencidos.', badgeClass: 'bg-error-container text-on-error-container' },
  { value: DOCUMENT_STATES.POR_VENCER, label: 'Próximos a vencer', emptyText: 'No hay documentos próximos a vencer.', badgeClass: 'bg-amber-100 text-amber-800' },
  { value: DOCUMENT_STATES.FALTANTE, label: 'Faltantes', emptyText: 'No hay documentos faltantes.' },
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

function DocumentTabs({ tabs, value, onChange }) {
  return (
    <div role="tablist" aria-label="Estado del documento" className="flex gap-1 overflow-x-auto px-4 sm:px-5 border-b border-outline-variant/30">
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={TABLE_PANEL_ID}
            onClick={() => onChange(tab.value)}
            className={`${TAB_CLASS} -mb-px ${active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
          >
            {tab.label}
            <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${tab.badgeClass ?? (active ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant')}`}>
              {formatCount(tab.count)}
            </span>
          </button>
        )
      })}
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
      <button type="button" onClick={() => onNotify(row)} disabled={Boolean(notifyBlocker)} className={ICON_BUTTON_CLASS} aria-label={notifyLabel} title={notifyLabel}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">notifications</span>
      </button>
      <button type="button" onClick={() => onUpload(row)} className={ICON_BUTTON_CLASS} aria-label={`Cargar ${row.tipo_documento_nombre} de ${name}`} title="Cargar documento">
        <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">upload_file</span>
      </button>
    </div>
  )
}

export default function DocumentPadronTable({ rows, personas, filters, onFiltersChange, onUpload, onNotify }) {
  const categories = useMemo(() => categoryOptions(personas), [personas])
  const hasUncategorized = personas.some((persona) => persona.categorias.length === 0)

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
          <CategoryFilter
            value={filters.categoria}
            categories={categories}
            hasUncategorized={hasUncategorized}
            onChange={change('categoria')}
          />
        </div>
      </div>

      <DocumentTabs tabs={tabs} value={filters.estado} onChange={change('estado')} />

      <div id={TABLE_PANEL_ID} role="tabpanel" aria-label={`Documentos: ${activeTab.label}`}>
        <DataTable
          headers={(
            <>
              <SortableHeader className={`${HEADER_CLASS} sm:pl-5`} etiqueta="Jugador activo / Docente" columna="person" orden={sort} onOrdenar={sortAndReset} />
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
            <tr key={row.key} className="hover:bg-surface-container-low/80 transition-colors">
              <td className="py-3 px-4 sm:pl-5">
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
              <td className="py-3 px-4 font-medium">{row.tipo_documento_nombre}</td>
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
