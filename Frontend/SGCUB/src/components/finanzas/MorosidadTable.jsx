import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import CategoryFilter from '../shared/CategoryFilter'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { matchesSearch } from '../shared/search'
import { ALL_CATEGORIES, categoryMatches, categoryOptions } from '../shared/categoryFilters'
import { formatAmount, formatDni } from '../personas/format'
import { formatCount } from '../cuota/cuotaPeriod'
import { profilePath } from './delinquencyFilters'
import { downloadMorosidadCsv } from './morosidadCsv'

const HEADER_CLASS = 'px-4 py-3 normal-case tracking-normal font-semibold'
const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const EXPORT_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const TOOL_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600/60'
const NOTIFY_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-primary text-on-primary hover:bg-primary/90 rounded text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed'
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer'

const ALL = 'all'

const TYPE_FILTERS = [
  { value: ALL, label: 'Tipo: Todos' },
  { value: 'Socio', label: 'Socios' },
  { value: 'Jugador', label: 'Jugadores' },
]

const SORT_VALUES = {
  name: (fila) => `${fila.apellido}, ${fila.nombre}`,
  category: (fila) => (fila.tipo === 'Jugador' ? fila.categoria_deportiva : ''),
  cuotas: (fila) => fila.cuotas_vencidas,
  debt: (fila) => Number(fila.monto_adeudado),
}

const TYPE_BADGES = {
  Jugador: 'bg-primary/10 text-primary border-primary/20',
  Socio: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40',
}

const sumDebt = (rows) => rows.reduce((total, row) => total + Number(row.monto_adeudado ?? 0), 0)
const countBy = (rows, key) => rows.reduce((acc, row) => {
  const value = row[key]
  if (value) acc[value] = (acc[value] ?? 0) + 1
  return acc
}, {})

function SelectAllCheckbox({ rows, selectedIds, onChange }) {
  const selectedCount = rows.filter((row) => selectedIds.has(row.socio_id)).length
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
      onChange={() => onChange(!allSelected, rows)}
      aria-label={allSelected ? 'Quitar la selección de todos los socios' : 'Seleccionar todos los socios'}
    />
  )
}

function BulkActionsBar({ rows, onExport, onClear }) {
  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 bg-sky-100 border-b border-sky-300 border-l-4 border-l-sky-600"
    >
      <p className="flex items-center gap-2 text-sm text-sky-900 pl-1">
        <span>
          <strong className="font-bold">{formatCount(rows.length)}</strong> {rows.length === 1 ? 'socio seleccionado' : 'socios seleccionados'}
          <span className="text-sky-800"> · Deuda total <strong className="font-semibold">{formatAmount(sumDebt(rows))}</strong></span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <button
          type="button"
          onClick={onExport}
          className={`${TOOL_BUTTON_CLASS} bg-surface-container-lowest border-sky-300 text-sky-900 hover:bg-sky-50`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">download</span>
          Exportar CSV
        </button>
        <button
          type="button"
          onClick={onClear}
          className={`${TOOL_BUTTON_CLASS} border-transparent text-sky-800 hover:bg-sky-200/60`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">close</span>
          Quitar selección
        </button>
      </div>
    </div>
  )
}

function MorosidadTable({
  filas = [],
  selectedIds = new Set(),
  onToggleRow,
  onToggleAll,
  onNotify,
  onClearSelection,
}) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [type, setType] = useState(ALL)
  const [category, setCategory] = useState(ALL_CATEGORIES)

  const typeCounts = useMemo(() => ({ ...countBy(filas, 'tipo'), [ALL]: filas.length }), [filas])
  const categories = useMemo(() => categoryOptions(filas), [filas])
  const hasUncategorized = filas.some((row) => row.tipo === 'Jugador' && !row.categoria_id)
  const categoryLocked = type === 'Socio'

  const changeType = (nextType) => {
    setType(nextType)
    if (nextType === 'Socio') setCategory(ALL_CATEGORIES)
  }

  const matching = useMemo(() => {
    const text = search.trim()
    return filas.filter((row) => {
      if (type !== ALL && row.tipo !== type) return false
      if (!categoryMatches(row, category)) return false
      return !text || matchesSearch(text, [row.apellido, row.nombre, row.dni, row.numero_socio])
    })
  }, [filas, search, type, category])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(matching, SORT_VALUES)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const selectedRows = useMemo(() => filas.filter((fila) => selectedIds.has(fila.socio_id)), [filas, selectedIds])

  return (
    <div className="min-w-0">
      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Nombre, DNI o N° de socio"
            label="Buscar morosos"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={type}
            onChange={(event) => withPageReset(changeType)(event.target.value)}
            aria-label="Filtrar por tipo"
          >
            {TYPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {`${filter.label} (${formatCount(typeCounts[filter.value] ?? 0)})`}
              </option>
            ))}
          </FilterSelect>
          <CategoryFilter
            value={category}
            categories={categories}
            hasUncategorized={hasUncategorized}
            onChange={withPageReset(setCategory)}
            disabled={categoryLocked}
            disabledReason="Los socios no tienen categoría"
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 xl:shrink-0">
          <button
            type="button"
            onClick={onNotify}
            disabled={selectedRows.length === 0}
            className={NOTIFY_BUTTON_CLASS}
            title={selectedRows.length === 0 ? 'Seleccioná los socios a notificar' : 'Notifica por email a los socios seleccionados'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">notifications</span>
            Notificar
            {selectedRows.length > 0 && <span className="tabular-nums">({formatCount(selectedRows.length)})</span>}
          </button>
          <button
            type="button"
            onClick={() => downloadMorosidadCsv(sorted)}
            disabled={sorted.length === 0}
            className={EXPORT_BUTTON_CLASS}
            title="Exporta los socios morosos que se ven con la búsqueda y el filtro actuales"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">file_download</span>
            Exportar listado
          </button>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <BulkActionsBar
          rows={selectedRows}
          onExport={() => downloadMorosidadCsv(selectedRows, 'morosos-seleccionados.csv')}
          onClear={onClearSelection}
        />
      )}

      <DataTable
        tableClassName="min-w-[720px]"
        headers={(
          <>
            <th className="py-3 pl-4 sm:pl-5 pr-2 w-10" scope="col">
              <SelectAllCheckbox rows={matching} selectedIds={selectedIds} onChange={onToggleAll} />
            </th>
            <SortableHeader className={HEADER_CLASS} etiqueta="Socio / Jugador" columna="name" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Categoría" columna="category" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Cuotas adeudadas" columna="cuotas" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={`${HEADER_CLASS} text-right`} etiqueta="Monto deuda" columna="debt" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={5}
          isLoading={false}
          isEmpty={visibleRows.length === 0}
          emptyText={matching.length === 0 ? 'Ningún socio moroso coincide con la búsqueda o los filtros.' : 'No hay socios con deuda vencida.'}
        />

        {visibleRows.map((fila) => {
          const selected = selectedIds.has(fila.socio_id)
          return (
            <tr
              key={fila.socio_id}
              onClick={() => navigate(profilePath(fila))}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  navigate(profilePath(fila))
                }
              }}
              tabIndex={0}
              role="button"
              title={`Ver estado financiero de ${fila.apellido}, ${fila.nombre}`}
              className={`cursor-pointer transition-colors focus:outline-none focus-visible:bg-surface-container-low ${
                selected ? 'bg-primary/5' : 'hover:bg-surface-container-low/70'
              }`}
            >
              <td
                className="py-3 pl-4 sm:pl-5 pr-2 w-10"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={selected}
                  onChange={() => onToggleRow?.(fila.socio_id)}
                  aria-label={`Seleccionar a ${fila.apellido}, ${fila.nombre}`}
                />
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <span className="font-semibold text-on-surface">{fila.apellido}, {fila.nombre}</span>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${TYPE_BADGES[fila.tipo] ?? TYPE_BADGES.Socio}`}>
                    {fila.tipo}
                  </span>
                </span>
                <span className="block text-sm text-on-surface-variant">DNI {formatDni(fila.dni)}</span>
              </td>
              <td className="px-4 py-3 text-on-surface-variant">{fila.tipo === 'Jugador' ? fila.categoria_deportiva : '—'}</td>
              <td className="px-4 py-3 text-on-surface">{fila.cuotas_vencidas}</td>
              <td className="px-4 py-3 text-right whitespace-nowrap font-semibold text-error">{formatAmount(fila.monto_adeudado)}</td>
            </tr>
          )
        })}
      </DataTable>

      <TablePagination id="morosidad-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default MorosidadTable
