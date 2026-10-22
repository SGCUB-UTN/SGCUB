import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { formatDni } from '../personas/format'
import { cargosDe, esActivo, exportarNominaCSV } from './docentesUtils'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const COLUMN_COUNT = 6

const fullName = (docente) =>
  [docente.persona_detalle?.nombre, docente.persona_detalle?.apellido].filter(Boolean).join(' ')

const categoryNames = (categorias) =>
  categorias.length > 0 ? categorias.map((categoria) => categoria.nombre).join(', ') : '—'

const SORT_VALUES = {
  legajo: (docente) => (docente.legajo ? Number(docente.legajo) : null),
  nombre: (docente) => fullName(docente),
  estado: (docente) => (esActivo(docente) ? 0 : 1),
}
const INITIAL_SORT = { columna: 'legajo', direccion: 'desc' }

function DocentesTable({ data, categorias = [], categoriasPorDocente = {}, isLoading, error, status, onStatusChange }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [cargo, setCargo] = useState('todos')
  const [category, setCategory] = useState('todas')

  const docentes = useMemo(() => data ?? [], [data])

  const availableCargos = useMemo(
    () => cargosDe(Object.values(categoriasPorDocente).flat()).sort(),
    [categoriasPorDocente],
  )

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    return docentes.filter((docente) => {
      const docenteCategorias = categoriasPorDocente[docente.docente_id] ?? []
      if (cargo !== 'todos' && !cargosDe(docenteCategorias).includes(cargo)) return false
      if (category !== 'todas' && !docenteCategorias.some((item) => String(item.categoria_id) === category)) return false
      if (status === 'activo' && !esActivo(docente)) return false
      if (status === 'baja' && esActivo(docente)) return false
      if (!text) return true
      return [docente.persona_detalle?.nombre, docente.persona_detalle?.apellido, docente.persona_detalle?.dni, docente.legajo]
        .some((field) => String(field ?? '').toLowerCase().includes(text))
    })
  }, [docentes, categoriasPorDocente, search, cargo, category, status])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)
  const [previousStatus, setPreviousStatus] = useState(status)
  if (status !== previousStatus) {
    setPreviousStatus(status)
    resetPage()
  }

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Filtrar por DNI, Nombre, Apellido o Legajo..."
            label="Filtrar docentes"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={cargo}
            onChange={(event) => withPageReset(setCargo)(event.target.value)}
            aria-label="Filtrar por cargo"
          >
            <option value="todos">Cargo: Todos</option>
            {availableCargos.map((item) => <option key={item} value={item}>{item}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            value={category}
            onChange={(event) => withPageReset(setCategory)(event.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="todas">Categoría: Todas</option>
            {categorias.map((item) => <option key={item.categoria_id} value={item.categoria_id}>{item.nombre}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="activo">Estado: Activo</option>
            <option value="todos">Estado: Todos</option>
            <option value="baja">De baja / Inactivo</option>
          </FilterSelect>
        </div>
        <div className="flex items-center justify-end xl:shrink-0">
          <button
            type="button"
            onClick={() => exportarNominaCSV(filtered, categoriasPorDocente)}
            disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-lg font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">file_download</span>
            <span>Exportar nómina</span>
          </button>
        </div>
      </div>

      <DataTable
        headers={(
          <>
            <SortableHeader className="py-3 px-4 w-28 whitespace-nowrap" etiqueta="N° Legajo" columna="legajo" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Nombre y Apellido" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">DNI</th>
            <th className="py-3 px-4" scope="col">Cargo</th>
            <th className="py-3 px-4" scope="col">Categorías</th>
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="estado" orden={sort} onOrdenar={sortAndReset} />
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
          emptyText="No hay docentes que coincidan con el filtro."
        />

        {!isLoading && visibleRows.map((docente) => {
          const docenteCategorias = categoriasPorDocente[docente.docente_id] ?? []
          return (
            <tr
              key={docente.docente_id}
              onClick={() => navigate(`/padron/docentes/${docente.docente_id}`)}
              className="hover:bg-surface-container-low/80 transition-colors cursor-pointer group"
            >
              <td className="py-3 px-4 font-bold text-primary text-base pl-6">
                {docente.legajo ? `#${docente.legajo}` : '—'}
              </td>
              <td className="py-3 px-4">
                <span className="font-medium text-on-surface block text-base">{fullName(docente) || '—'}</span>
              </td>
              <td className="py-3 px-4 text-on-surface-variant">{formatDni(docente.persona_detalle?.dni)}</td>
              <td className="py-3 px-4 text-on-surface-variant">{cargosDe(docenteCategorias).join(', ') || '—'}</td>
              <td className="py-3 px-4 text-on-surface-variant">{categoryNames(docenteCategorias)}</td>
              <td className="py-3 px-4">
                <ActiveStatusBadge isActive={esActivo(docente)} label={esActivo(docente) ? 'Activo' : 'De baja'} />
              </td>
            </tr>
          )
        })}
      </DataTable>

      <TablePagination id="docentes-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default DocentesTable
