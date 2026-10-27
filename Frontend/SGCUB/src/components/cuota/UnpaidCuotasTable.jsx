import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCuota } from '../../api/cuotas'
import CuotaDetailPanel from '../finanzas/CuotaDetailPanel'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { matchesSearch } from '../shared/search'
import { formatDni } from '../personas/format'
import { CUOTA_STATE_ORDER, cuotaStateBadgeClass, cuotaStateLabel } from '../finanzas/cuotaStates'
import { SecondaryButton } from '../personas/tabs/parts'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import {
  CUOTA_TYPES,
  cuotaTypeBadgeClass,
  cuotaTypeLabel,
  downloadUnpaidCsv,
  formatCount,
  formatMoney,
  memberName,
} from './cuotaPeriod'

const ALL = 'all'
const COLUMN_COUNT = 4
const HEADER_CLASS = 'py-3 px-4'

const TYPE_FILTERS = [
  { value: ALL, label: 'Tipo: Todos' },
  { value: CUOTA_TYPES.MEMBER, label: 'Socios' },
  { value: CUOTA_TYPES.PLAYER, label: 'Jugadores' },
  { value: CUOTA_TYPES.PARTIAL_LEAVE, label: 'Baja parcial' },
]

const SORT_VALUES = {
  name: (row) => memberName(row),
  pending: (row) => Number(row.pending),
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const BADGE_CLASS = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap'
const EXPORT_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const TOOL_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border border-outline-variant/50 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const UPCOMING_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border border-outline-variant/50 text-sm font-semibold text-on-surface-variant opacity-60 cursor-not-allowed'
const DELETE_BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-base font-semibold text-error hover:bg-error-container/60 transition-colors cursor-pointer'
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer'

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size }} aria-hidden="true">{name}</span>
)

const detailPath = (row) => (row.jugador_id ? `/padron/jugadores/${row.jugador_id}` : `/padron/socios/${row.socio_id}`)

const sumBy = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

const stopRowToggle = (event) => event.stopPropagation()

function countBy(rows, key) {
  return rows.reduce((counts, row) => ({ ...counts, [row[key]]: (counts[row[key]] ?? 0) + 1 }), {})
}

function StateSummary({ rows }) {
  const states = Object.entries(countBy(rows, 'estado_cuota'))
    .sort(([a], [b]) => (CUOTA_STATE_ORDER[a] ?? 9) - (CUOTA_STATE_ORDER[b] ?? 9))
  if (states.length === 0) return null
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
      <span className="font-medium">Estado de las cuotas:</span>
      {states.map(([state, count]) => (
        <span key={state} className={`${BADGE_CLASS} ${cuotaStateBadgeClass(state)}`}>
          {cuotaStateLabel(state)}
          {states.length > 1 && <span className="ml-1 tabular-nums">({formatCount(count)})</span>}
        </span>
      ))}
    </p>
  )
}

function SelectAllCheckbox({ rows, selectedIds, onChange }) {
  const selectedCount = rows.filter((row) => selectedIds.has(row.cuota_id)).length
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
      aria-label={allSelected ? 'Quitar la selección de todas las cuotas filtradas' : 'Seleccionar todas las cuotas filtradas'}
    />
  )
}

function BulkActionsBar({ rows, onExport, onClear }) {
  return (
    <div
      role="region"
      aria-label="Acciones sobre la selección"
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 bg-primary/5 border-b border-primary/20"
    >
      <p className="text-sm text-on-surface">
        <strong className="font-semibold">{formatCount(rows.length)}</strong> {rows.length === 1 ? 'cuota seleccionada' : 'cuotas seleccionadas'}
        <span className="text-on-surface-variant"> · Saldo {formatMoney(sumBy(rows, 'pending'))}</span>
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        <button type="button" aria-disabled="true" title="Disponible próximamente" className={UPCOMING_BUTTON_CLASS}>
          <Icon name="mail" />
          Enviar recordatorio
        </button>
        <button type="button" onClick={onExport} className={TOOL_BUTTON_CLASS}>
          <Icon name="download" />
          Exportar CSV
        </button>
        <button type="button" onClick={onClear} className={`${TOOL_BUTTON_CLASS} border-transparent text-on-surface-variant`}>
          <Icon name="close" />
          Quitar selección
        </button>
      </div>
    </div>
  )
}

function CuotaDetailRow({ row, onPay, onAssignBenefit, onEdit, onDelete, onChanged }) {
  const [detail, setDetail] = useState({ loading: true, error: false, cuota: null })

  useEffect(() => {
    let active = true
    getCuota(row.cuota_id)
      .then((cuota) => active && setDetail({ loading: false, error: false, cuota }))
      .catch(() => active && setDetail({ loading: false, error: true, cuota: null }))
    return () => { active = false }
  }, [row.cuota_id])

  if (!detail.cuota) {
    return (
      <tr className="bg-surface-container-low/60">
        <td colSpan={COLUMN_COUNT} className={`py-4 px-4 sm:px-5 text-sm ${detail.error ? 'text-error' : 'text-on-surface-variant'}`} role={detail.error ? 'alert' : 'status'}>
          {detail.error ? 'No se pudo cargar el detalle de la cuota.' : 'Cargando detalle...'}
        </td>
      </tr>
    )
  }

  return (
    <CuotaDetailPanel
      cuota={detail.cuota}
      colSpan={COLUMN_COUNT}
      onPay={() => onPay(row)}
      onAssignBenefit={() => onAssignBenefit(row)}
      onChanged={onChanged}
      extraActions={(
        <>
          <SecondaryButton icon="edit_calendar" onClick={() => onEdit(row)}>Editar vencimientos</SecondaryButton>
          <button type="button" onClick={() => onDelete(row)} className={DELETE_BUTTON_CLASS}>
            <Icon name="delete" size={20} />
            Eliminar cuota
          </button>
        </>
      )}
      flat
    />
  )
}

export default function UnpaidCuotasTable({
  rows = [],
  isLoading = false,
  error = null,
  period,
  onPay,
  onAssignBenefit,
  onEdit,
  onDelete,
  onChanged,
}) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState(ALL)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [expandedId, setExpandedId] = useState(null)

  const typeCounts = useMemo(() => ({ ...countBy(rows, 'type'), [ALL]: rows.length }), [rows])

  const filtered = useMemo(() => {
    const text = search.trim()
    return rows.filter((row) => {
      if (type !== ALL && row.type !== type) return false
      return !text || matchesSearch(text, [row.apellido, row.nombre, row.dni, row.numero_socio, row.email])
    })
  }, [rows, search, type])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const selectedRows = useMemo(() => rows.filter((row) => selectedIds.has(row.cuota_id)), [rows, selectedIds])

  const toggleRow = (cuotaId) => setSelectedIds((current) => {
    const next = new Set(current)
    if (next.has(cuotaId)) next.delete(cuotaId)
    else next.add(cuotaId)
    return next
  })

  const toggleFiltered = (select) => setSelectedIds((current) => {
    const next = new Set(current)
    filtered.forEach((row) => (select ? next.add(row.cuota_id) : next.delete(row.cuota_id)))
    return next
  })

  const toggleExpanded = (cuotaId) => setExpandedId((current) => (current === cuotaId ? null : cuotaId))

  const handleRowKeyDown = (event, cuotaId) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleExpanded(cuotaId)
    }
  }

  const emptyText = rows.length === 0
    ? 'No hay cuotas impagas en este período.'
    : 'Ninguna cuota impaga coincide con la búsqueda o el filtro.'

  return (
    <div className="min-w-0">
      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Nombre, DNI o N° de socio"
            label="Buscar cuotas impagas"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={type}
            onChange={(event) => withPageReset(setType)(event.target.value)}
            aria-label="Filtrar por tipo"
          >
            {TYPE_FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {`${filter.label} (${formatCount(typeCounts[filter.value] ?? 0)})`}
              </option>
            ))}
          </FilterSelect>
          <StateSummary rows={rows} />
        </div>
        <div className="flex items-center justify-end xl:shrink-0">
          <button
            type="button"
            onClick={() => downloadUnpaidCsv(sorted, period)}
            disabled={sorted.length === 0}
            className={EXPORT_BUTTON_CLASS}
            title="Exporta las cuotas que se ven con la búsqueda y el filtro actuales"
          >
            <Icon name="file_download" />
            Exportar listado
          </button>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <BulkActionsBar
          rows={selectedRows}
          onExport={() => downloadUnpaidCsv(selectedRows, period)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <DataTable
        headers={(
          <>
            <th className="py-3 pl-4 sm:pl-5 pr-2 w-10" scope="col">
              <SelectAllCheckbox rows={filtered} selectedIds={selectedIds} onChange={toggleFiltered} />
            </th>
            <th className="py-3 px-0 w-8" scope="col"><span className="sr-only">Detalle</span></th>
            <SortableHeader className={HEADER_CLASS} etiqueta="Socio / Jugador" columna="name" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={`${HEADER_CLASS} sm:pr-5 text-right`} etiqueta="Saldo" columna="pending" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading && rows.length === 0}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando cuotas impagas..."
          errorText="No se pudieron cargar las cuotas impagas."
          emptyText={emptyText}
        />

        {visibleRows.map((row) => {
          const name = memberName(row)
          const selected = selectedIds.has(row.cuota_id)
          const expanded = expandedId === row.cuota_id
          return (
            <Fragment key={row.cuota_id}>
              <tr
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => toggleExpanded(row.cuota_id)}
                onKeyDown={(event) => handleRowKeyDown(event, row.cuota_id)}
                className={`cursor-pointer transition-colors focus:outline-none focus-visible:bg-surface-container-low ${selected || expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low/80'}`}
              >
                <td className="py-3 pl-4 sm:pl-5 pr-2" onClick={stopRowToggle}>
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={selected}
                    onChange={() => toggleRow(row.cuota_id)}
                    aria-label={`Seleccionar la cuota de ${name}`}
                  />
                </td>
                <td className="py-3 px-0 text-outline">
                  <span className={`material-symbols-outlined block transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} style={{ fontSize: 22 }} aria-hidden="true">
                    expand_more
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to={detailPath(row)} onClick={stopRowToggle} className="font-medium text-on-surface hover:text-primary hover:underline">
                      {name}
                    </Link>
                    <span className={`${BADGE_CLASS} ${cuotaTypeBadgeClass(row.type)}`}>{cuotaTypeLabel(row.type)}</span>
                  </div>
                  <div className="text-xs text-on-surface-variant">
                    N° {row.numero_socio ?? '—'} · DNI {formatDni(row.dni)}
                  </div>
                </td>
                <td className="py-3 px-4 sm:pr-5 text-right whitespace-nowrap font-semibold">{formatMoney(row.pending)}</td>
              </tr>
              {expanded && (
                <CuotaDetailRow
                  key={`${row.cuota_id}-${row.pending}`}
                  row={row}
                  onPay={onPay}
                  onAssignBenefit={onAssignBenefit}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onChanged={onChanged}
                />
              )}
            </Fragment>
          )
        })}
      </DataTable>

      <TablePagination id="unpaid-cuotas-rows-per-page" {...paginationProps} />
    </div>
  )
}
