import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { matchesSearch } from '../shared/search'
import { formatDni } from '../personas/format'
import { CUOTA_STATE_ORDER, cuotaStateBadgeClass, cuotaStateLabel } from '../finanzas/cuotaStates'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import RowActionsMenu from './RowActionsMenu'
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
const COLUMN_COUNT = 8
const HEADER_CLASS = 'py-3 px-4'
const AMOUNT_HEADER_CLASS = `${HEADER_CLASS} text-right`

const TYPE_FILTERS = [
  { value: ALL, label: 'Todos' },
  { value: CUOTA_TYPES.MEMBER, label: 'Socios' },
  { value: CUOTA_TYPES.PLAYER, label: 'Jugadores' },
  { value: CUOTA_TYPES.PARTIAL_LEAVE, label: 'Baja parcial' },
]

const SORT_VALUES = {
  name: (row) => memberName(row),
  type: (row) => cuotaTypeLabel(row.type),
  status: (row) => CUOTA_STATE_ORDER[row.estado_cuota] ?? null,
  cuota: (row) => Number(row.cuota_amount),
  surcharges: (row) => Number(row.surcharges),
  pending: (row) => Number(row.pending),
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }

const CHIP_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const CHIP_ACTIVE_CLASS = 'bg-primary text-on-primary border-primary'
const CHIP_IDLE_CLASS = 'bg-surface-container-lowest text-on-surface-variant border-outline-variant/50 hover:bg-surface-container-low hover:text-on-surface'
const TOOL_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border border-outline-variant/50 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const UPCOMING_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border border-outline-variant/50 text-sm font-semibold text-on-surface-variant opacity-60 cursor-not-allowed'
const PAY_BUTTON_CLASS = 'inline-flex items-center gap-1 h-9 px-3 rounded bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer'

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size }} aria-hidden="true">{name}</span>
)

const detailPath = (row) => (row.jugador_id ? `/padron/jugadores/${row.jugador_id}` : `/padron/socios/${row.socio_id}`)

const sumBy = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

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
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 bg-primary/5 border-y border-primary/20"
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

export default function UnpaidCuotasTable({ rows = [], isLoading = false, error = null, period, onPay, onAssignBenefit, onEdit, onDelete }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState(ALL)
  const [selectedIds, setSelectedIds] = useState(() => new Set())

  const typeCounts = useMemo(() => rows.reduce(
    (counts, row) => ({ ...counts, [row.type]: (counts[row.type] ?? 0) + 1 }),
    { [ALL]: rows.length },
  ), [rows])

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

  const emptyText = rows.length === 0
    ? 'No hay cuotas impagas en este período.'
    : 'Ninguna cuota impaga coincide con la búsqueda o el filtro.'

  return (
    <div className="min-w-0">
      <div className="px-4 sm:px-5 py-4 flex flex-col xl:flex-row xl:items-center gap-3">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Nombre, DNI o N° de socio"
          label="Buscar cuotas impagas"
        />
        <div role="group" aria-label="Filtrar por tipo" className="flex flex-wrap items-center gap-2">
          {TYPE_FILTERS.map((filter) => {
            const active = type === filter.value
            return (
              <button
                key={filter.value}
                type="button"
                aria-pressed={active}
                onClick={() => withPageReset(setType)(filter.value)}
                className={`${CHIP_CLASS} ${active ? CHIP_ACTIVE_CLASS : CHIP_IDLE_CLASS}`}
              >
                {filter.label}
                <span className={`tabular-nums ${active ? '' : 'text-outline'}`}>({formatCount(typeCounts[filter.value] ?? 0)})</span>
              </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => downloadUnpaidCsv(sorted, period)}
          disabled={sorted.length === 0}
          className={`${TOOL_BUTTON_CLASS} xl:ml-auto self-start xl:self-auto disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Exporta las cuotas que se ven con la búsqueda y el filtro actuales"
        >
          <Icon name="download" />
          Exportar listado (CSV)
        </button>
      </div>

      {selectedRows.length > 0 && (
        <BulkActionsBar
          rows={selectedRows}
          onExport={() => downloadUnpaidCsv(selectedRows, period)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <DataTable
        className={selectedRows.length > 0 ? '' : 'border-t border-outline-variant/30'}
        headers={(
          <>
            <th className="py-3 pl-4 sm:pl-5 pr-2 w-10" scope="col">
              <SelectAllCheckbox rows={filtered} selectedIds={selectedIds} onChange={toggleFiltered} />
            </th>
            <SortableHeader className={HEADER_CLASS} etiqueta="Socio / Jugador" columna="name" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Tipo" columna="type" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Estado" columna="status" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={AMOUNT_HEADER_CLASS} etiqueta="Cuota" columna="cuota" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={AMOUNT_HEADER_CLASS} etiqueta="Recargos" columna="surcharges" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={AMOUNT_HEADER_CLASS} etiqueta="Saldo" columna="pending" orden={sort} onOrdenar={sortAndReset} />
            <th className={`${HEADER_CLASS} sm:pr-5 text-right`} scope="col">Acción</th>
          </>
        )}
        footer={filtered.length > 0 && (
          <>
            <td className="py-3 pl-4 sm:pl-5 pr-2" />
            <td className="py-3 px-4 font-semibold" colSpan={3}>
              Total {type === ALL && !search.trim() ? 'del período' : 'filtrado'} ({formatCount(filtered.length)})
            </td>
            <td className="py-3 px-4 text-right">{formatMoney(sumBy(filtered, 'cuota_amount'))}</td>
            <td className="py-3 px-4 text-right">{formatMoney(sumBy(filtered, 'surcharges'))}</td>
            <td className="py-3 px-4 text-right font-semibold">{formatMoney(sumBy(filtered, 'pending'))}</td>
            <td className="py-3 px-4 sm:pr-5" />
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
          const surcharges = Number(row.surcharges)
          return (
            <tr key={row.cuota_id} className={`transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-surface-container-low/80'}`}>
              <td className="py-3 pl-4 sm:pl-5 pr-2">
                <input
                  type="checkbox"
                  className={CHECKBOX_CLASS}
                  checked={selected}
                  onChange={() => toggleRow(row.cuota_id)}
                  aria-label={`Seleccionar la cuota de ${name}`}
                />
              </td>
              <td className="py-3 px-4">
                <Link to={detailPath(row)} className="font-medium text-on-surface hover:text-primary hover:underline">
                  {name}
                </Link>
                <div className="text-xs text-on-surface-variant">
                  N° {row.numero_socio ?? '—'} · DNI {formatDni(row.dni)}
                </div>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cuotaTypeBadgeClass(row.type)}`}>
                  {cuotaTypeLabel(row.type)}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cuotaStateBadgeClass(row.estado_cuota)}`}>
                  {cuotaStateLabel(row.estado_cuota)}
                </span>
              </td>
              <td className="py-3 px-4 text-right whitespace-nowrap">{formatMoney(row.cuota_amount)}</td>
              <td className={`py-3 px-4 text-right whitespace-nowrap ${surcharges > 0 ? 'text-error' : 'text-on-surface-variant'}`}>
                {surcharges > 0 ? `+ ${formatMoney(surcharges)}` : '—'}
              </td>
              <td className="py-3 px-4 text-right whitespace-nowrap font-semibold">{formatMoney(row.pending)}</td>
              <td className="py-3 px-4 sm:pr-5">
                <div className="flex items-center justify-end gap-2">
                  <button type="button" onClick={() => onPay(row)} className={PAY_BUTTON_CLASS} aria-label={`Cobrar la cuota de ${name}`}>
                    <Icon name="payments" />
                    Cobrar
                  </button>
                  <RowActionsMenu
                    label={name}
                    onAssignBenefit={() => onAssignBenefit(row)}
                    onEdit={() => onEdit(row)}
                    onDelete={() => onDelete(row)}
                  />
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>

      <TablePagination id="unpaid-cuotas-rows-per-page" {...paginationProps} />
    </div>
  )
}
