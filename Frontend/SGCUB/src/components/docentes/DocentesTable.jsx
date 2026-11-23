import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import DocumentationStatus from '../documental/DocumentationStatus'
import { DOCUMENTATION_LABELS, documentationSeverity } from '../documental/documentationStates'
import ClearFiltersButton from '../shared/ClearFiltersButton'
import ExportMenu from '../shared/ExportMenu'
import InactiveTag from '../shared/InactiveTag'
import { ROW_LINK_CLASS, stopRowClick } from '../shared/rowLink'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import CategoryFilter from '../shared/CategoryFilter'
import { ALL_CATEGORIES, NO_CATEGORY_VALUE } from '../shared/categoryFilters'
import {
  ALL,
  DOCUMENTATION_FILTERS,
  FILTER_CLASS,
  FILTER_WIDTH,
  SEARCH_WIDTH,
  filterLabel,
  matchesDocumentationFilter,
} from '../shared/listFilters'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { formatDni } from '../personas/format'
import { cargosDe, esActivo } from './docentesUtils'
import { matchesSearch } from '../shared/search'

const COLUMN_COUNT = 5
const GENDER_PREFIX = 'gender:'
const DEFAULT_STATUS = 'activo'
const NO_ROLE = 'Sin cargo'
const GENDER_LABELS = { M: 'Masculino', F: 'Femenino' }

const STATUS_FILTERS = [
  { value: 'activo', label: 'Activos' },
  { value: ALL, label: 'Estado: Todos' },
  { value: 'baja', label: 'De Baja' },
]

const matchesDocenteCategory = (docenteCategorias, value) => {
  if (value === ALL_CATEGORIES) return true
  if (value === NO_CATEGORY_VALUE) return docenteCategorias.length === 0
  if (value.startsWith(GENDER_PREFIX)) {
    const gender = value.slice(GENDER_PREFIX.length)
    return docenteCategorias.some((item) => item.genero === gender)
  }
  return docenteCategorias.some((item) => String(item.categoria_id) === value)
}

const fullName = (docente) =>
  [docente.persona_detalle?.nombre, docente.persona_detalle?.apellido].filter(Boolean).join(' ')

const assignmentsText = (asignaciones = []) => asignaciones
  .map(({ cargo_nombre: cargoNombre, categorias = [] }) => {
    const names = categorias.map((categoria) => categoria.nombre).join(', ')
    return names ? `${cargoNombre ?? NO_ROLE}: ${names}` : cargoNombre ?? NO_ROLE
  })
  .join('; ')

function RoleAssignments({ asignaciones = [] }) {
  if (asignaciones.length === 0) return <span>—</span>
  return (
    <ul className="flex flex-col gap-0.5">
      {asignaciones.map(({ cargo, cargo_nombre: cargoNombre, categorias = [] }) => (
        <li key={cargo ?? NO_ROLE}>
          <span className="text-on-surface">{cargoNombre ?? NO_ROLE}</span>
          {categorias.length > 0 && (
            <span className="text-on-surface-variant"> · {categorias.map((categoria) => categoria.nombre).join(', ')}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

const EXPORT_COLUMNS = [
  { header: 'Legajo', value: (docente) => docente.legajo },
  { header: 'Nombre y apellido', value: fullName },
  { header: 'DNI', value: (docente) => formatDni(docente.persona_detalle?.dni) },
  { header: 'Teléfono', value: (docente) => docente.persona_detalle?.telefono },
  { header: 'Email', value: (docente) => docente.persona_detalle?.email },
  { header: 'Cargo y categorías', value: (docente) => assignmentsText(docente.asignaciones) },
  { header: 'Documentación', value: (docente) => DOCUMENTATION_LABELS[docente.documentacion?.estado] },
  { header: 'Estado', value: (docente) => (esActivo(docente) ? 'Activo' : 'De Baja') },
]

const SORT_VALUES = {
  legajo: (docente) => (docente.legajo ? Number(docente.legajo) : null),
  nombre: fullName,
  documentacion: (docente) => documentationSeverity(docente.documentacion),
}
const INITIAL_SORT = { columna: 'legajo', direccion: 'desc' }

const categoryDescription = (value, options) => {
  if (value === ALL_CATEGORIES) return null
  if (value === NO_CATEGORY_VALUE) return 'Categoría: Sin categoría'
  if (value.startsWith(GENDER_PREFIX)) return `Categoría: ${GENDER_LABELS[value.slice(GENDER_PREFIX.length)] ?? value}`
  const option = options.find((item) => item.value === value)
  return option ? `Categoría: ${option.name}` : null
}

function DocentesTable({ data, categorias = [], categoriasPorDocente = {}, isLoading, error, status, onStatusChange, onRetry, exportSlot }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [cargo, setCargo] = useState(ALL)
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [documentation, setDocumentation] = useState(ALL)

  const docentes = useMemo(() => data ?? [], [data])

  const categoryOptions = useMemo(
    () => categorias
      .filter((item) => item.categoria_id)
      .map((item) => ({
        value: String(item.categoria_id),
        name: item.nombre,
        gender: item.genero ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
    [categorias],
  )
  const hasUncategorized = useMemo(
    () => docentes.some((docente) => (categoriasPorDocente[docente.docente_id] ?? []).length === 0),
    [docentes, categoriasPorDocente],
  )

  const availableCargos = useMemo(
    () => cargosDe(Object.values(categoriasPorDocente).flat()).sort(),
    [categoriasPorDocente],
  )

  const filtered = useMemo(() => {
    const text = search.trim()
    return docentes.filter((docente) => {
      const docenteCategorias = categoriasPorDocente[docente.docente_id] ?? []
      if (cargo !== ALL && !cargosDe(docenteCategorias).includes(cargo)) return false
      if (!matchesDocenteCategory(docenteCategorias, category)) return false
      if (status === 'activo' && !esActivo(docente)) return false
      if (status === 'baja' && esActivo(docente)) return false
      if (!matchesDocumentationFilter(docente.documentacion, documentation)) return false
      if (!text) return true
      return matchesSearch(text, [docente.persona_detalle?.nombre, docente.persona_detalle?.apellido, docente.persona_detalle?.dni, docente.legajo])
    })
  }, [docentes, categoriasPorDocente, search, cargo, category, status, documentation])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const hasFilters = search.trim() !== ''
    || cargo !== ALL
    || category !== ALL_CATEGORIES
    || documentation !== ALL
    || status !== DEFAULT_STATUS
  const clearFilters = () => {
    setSearch('')
    setCargo(ALL)
    setCategory(ALL_CATEGORIES)
    setDocumentation(ALL)
    onStatusChange(DEFAULT_STATUS)
    resetPage()
  }
  const sortAndReset = withPageReset(sortBy)
  const [previousStatus, setPreviousStatus] = useState(status)
  if (status !== previousStatus) {
    setPreviousStatus(status)
    resetPage()
  }

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Buscar por nombre, DNI o legajo"
            label="Buscar docentes"
            className={SEARCH_WIDTH}
          />
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
            value={cargo}
            onChange={(event) => withPageReset(setCargo)(event.target.value)}
            aria-label="Filtrar por cargo"
          >
            <option value={ALL}>Cargo</option>
            {availableCargos.map((item) => <option key={item} value={item}>{item}</option>)}
          </FilterSelect>
          <CategoryFilter
            width={FILTER_WIDTH}
            value={category}
            categories={categoryOptions}
            hasUncategorized={hasUncategorized}
            onChange={withPageReset(setCategory)}
          />
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label="Filtrar por estado"
          >
            {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
            value={documentation}
            onChange={(event) => withPageReset(setDocumentation)(event.target.value)}
            aria-label="Filtrar por documentación"
          >
            {DOCUMENTATION_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </FilterSelect>
          <ClearFiltersButton onClick={clearFilters} visible={hasFilters} />
        </div>
      </div>

      {exportSlot && createPortal(
        <ExportMenu
          title="Docentes"
          filename="docentes"
          columns={EXPORT_COLUMNS}
          items={sorted}
          filters={[
            filterLabel(STATUS_FILTERS, status, 'Estado'),
            cargo !== ALL && `Cargo: ${cargo}`,
            categoryDescription(category, categoryOptions),
            filterLabel(DOCUMENTATION_FILTERS, documentation, 'Documentación'),
            search.trim() && `Búsqueda: «${search.trim()}»`,
          ]}
        />,
        exportSlot,
      )}

      <DataTable
        headers={(
          <>
            <SortableHeader className="max-sm:hidden py-3 px-4 w-28 whitespace-nowrap" etiqueta="N° Legajo" columna="legajo" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Nombre y Apellido" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">DNI</th>
            <th className="max-sm:hidden py-3 px-4" scope="col">Cargo y categorías</th>
            <SortableHeader className="max-sm:hidden py-3 px-4 whitespace-nowrap" etiqueta="Documentación" columna="documentacion" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando docentes..."
          errorText="No se pudieron cargar los docentes."
          emptyText={docentes.length === 0 ? 'Todavía no hay docentes cargados.' : 'Ningún docente coincide con la búsqueda o los filtros.'}
          onRetry={onRetry}
          onClearFilters={hasFilters ? clearFilters : undefined}
        />

        {!isLoading && visibleRows.map((docente) => (
          <tr
            key={docente.docente_id}
            onClick={() => navigate(`/padron/docentes/${docente.docente_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer group"
          >
            <td className="max-sm:hidden py-3 px-4 font-bold text-primary text-base pl-6">
              {docente.legajo ? `#${docente.legajo}` : '—'}
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/padron/docentes/${docente.docente_id}`}
                  onClick={stopRowClick}
                  className={`font-medium block text-base ${ROW_LINK_CLASS} ${esActivo(docente) ? 'text-on-surface' : 'text-on-surface-variant'}`}
                >
                  {fullName(docente) || '—'}
                </Link>
                {!esActivo(docente) && <InactiveTag>De Baja</InactiveTag>}
              </div>
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDni(docente.persona_detalle?.dni)}</td>
            <td className="max-sm:hidden py-3 px-4"><RoleAssignments asignaciones={docente.asignaciones} /></td>
            <td className="max-sm:hidden py-3 px-4"><DocumentationStatus documentacion={docente.documentacion} /></td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="docentes-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default DocentesTable
