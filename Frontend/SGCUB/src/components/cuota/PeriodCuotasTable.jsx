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
import { CUOTA_STATES, cuotaStateBadgeClass } from '../finanzas/cuotaStates'
import { GENERO_BADGE_CLASSES } from '../categorias/categoriaFormat'
import CategoryFilter from './CategoryFilter'
import NotifyCuotasModal from './NotifyCuotasModal'
import { ALL_CATEGORIES, NO_CATEGORY, categoryMatches, categoryOptions, findGender } from './cuotaCategories'
import { SecondaryButton } from '../personas/tabs/parts'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import {
  CUOTA_TYPES,
  cuotaTypeBadgeClass,
  cuotaTypeLabel,
  downloadCuotasCsv,
  formatCount,
  formatMoney,
  memberName,
} from './cuotaPeriod'

const ALL = 'all'
const PENDING = 'pending'
const PAID = 'paid'
const COLUMN_COUNT = 5

const TABS = [
  { value: ALL, label: 'Todas', matches: () => true, emptyText: 'No hay cuotas en este período.' },
  { value: PENDING, label: 'Pendientes', matches: (row) => !row.paid, emptyText: 'No hay cuotas pendientes en este período.', badgeClass: 'bg-error-container text-on-error-container' },
  { value: PAID, label: 'Pagas', matches: (row) => row.paid, emptyText: 'No hay cuotas pagas en este período.' },
]
const HEADER_CLASS = 'py-3 px-4'

const TYPE_FILTERS = [
  { value: ALL, label: 'Tipo: Todos' },
  { value: CUOTA_TYPES.MEMBER, label: 'Socios' },
  { value: CUOTA_TYPES.PLAYER, label: 'Jugadores' },
  { value: CUOTA_TYPES.PARTIAL_LEAVE, label: 'Baja parcial' },
]

const categoryOf = (row) => row.categoria ?? NO_CATEGORY

const SORT_VALUES = {
  name: (row) => memberName(row),
  category: (row) => `${categoryOf(row)} ${row.categoria_genero ?? ''}`,
  pending: (row) => Number(row.pending),
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const BADGE_CLASS = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap'
const EXPORT_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const TOOL_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded border text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600/60'
const NOTIFY_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-primary text-on-primary hover:bg-primary/90 rounded text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed'
const DELETE_BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg text-base font-semibold text-error hover:bg-error-container/60 transition-colors cursor-pointer'
const CHECKBOX_CLASS = 'w-4 h-4 accent-primary cursor-pointer'
const TAB_CLASS = 'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-surface-container-low'
const TABLE_PANEL_ID = 'period-cuotas-panel'

const Icon = ({ name, size = 18 }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size }} aria-hidden="true">{name}</span>
)

const detailPath = (row) => (row.jugador_id ? `/padron/jugadores/${row.jugador_id}` : `/padron/socios/${row.socio_id}`)

const sumBy = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

const stopRowToggle = (event) => event.stopPropagation()

function CategoryCell({ row }) {
  if (!row.categoria) return <span className="text-on-surface-variant">{NO_CATEGORY}</span>
  const gender = findGender(row.categoria_genero)
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {row.categoria}
      {gender && (
        <span className={`${BADGE_CLASS} ${GENERO_BADGE_CLASSES[gender.value]}`} title={gender.label}>
          {gender.shortLabel}
        </span>
      )}
    </span>
  )
}

function CuotaTabs({ value, counts, onChange }) {
  return (
    <div role="tablist" aria-label="Estado de pago" className="flex gap-1 overflow-x-auto px-4 sm:px-5 border-b border-outline-variant/30">
      {TABS.map((tab) => {
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
              {formatCount(counts[tab.value] ?? 0)}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => ({ ...counts, [row[key]]: (counts[row[key]] ?? 0) + 1 }), {})
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
      className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-2.5 bg-sky-100 border-b border-sky-300 border-l-4 border-l-sky-600"
    >
      <p className="flex items-center gap-2 text-sm text-sky-900">
        <span className="material-symbols-outlined text-sky-700" style={{ fontSize: 20 }} aria-hidden="true">check_box</span>
        <span>
          <strong className="font-bold">{formatCount(rows.length)}</strong> {rows.length === 1 ? 'cuota seleccionada' : 'cuotas seleccionadas'}
          <span className="text-sky-800"> · Saldo <strong className="font-semibold">{formatMoney(sumBy(rows, 'pending'))}</strong></span>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
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
      extraActions={!row.paid && (
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

export default function PeriodCuotasTable({
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
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [tab, setTab] = useState(ALL)
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [expandedId, setExpandedId] = useState(null)
  const [notifyOpen, setNotifyOpen] = useState(false)

  const typeCounts = useMemo(() => ({ ...countBy(rows, 'type'), [ALL]: rows.length }), [rows])
  const categories = useMemo(() => categoryOptions(rows), [rows])
  const hasUncategorized = rows.some((row) => !row.categoria_id)

  const matching = useMemo(() => {
    const text = search.trim()
    return rows.filter((row) => {
      if (type !== ALL && row.type !== type) return false
      if (!categoryMatches(row, category)) return false
      return !text || matchesSearch(text, [row.apellido, row.nombre, row.dni, row.numero_socio, row.email])
    })
  }, [rows, search, type, category])

  const tabCounts = useMemo(
    () => Object.fromEntries(TABS.map((option) => [option.value, matching.filter(option.matches).length])),
    [matching],
  )

  const activeTab = TABS.find((option) => option.value === tab)
  const filtered = useMemo(() => matching.filter(activeTab.matches), [matching, activeTab])

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

  const emptyText = matching.length === rows.length
    ? activeTab.emptyText
    : 'Ninguna cuota coincide con la búsqueda o los filtros.'

  return (
    <div className="min-w-0">
      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Nombre, DNI o N° de socio"
            label="Buscar cuotas"
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
          <CategoryFilter
            value={category}
            categories={categories}
            hasUncategorized={hasUncategorized}
            onChange={withPageReset(setCategory)}
          />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 xl:shrink-0">
          <button
            type="button"
            onClick={() => setNotifyOpen(true)}
            disabled={selectedRows.length === 0}
            className={NOTIFY_BUTTON_CLASS}
            title={selectedRows.length === 0 ? 'Seleccioná las cuotas de los socios a notificar' : 'Notifica por email a los socios de las cuotas seleccionadas'}
          >
            <Icon name="notifications" />
            Notificar
            {selectedRows.length > 0 && <span className="tabular-nums">({formatCount(selectedRows.length)})</span>}
          </button>
          <button
            type="button"
            onClick={() => downloadCuotasCsv(sorted, period)}
            disabled={sorted.length === 0}
            className={EXPORT_BUTTON_CLASS}
            title="Exporta las cuotas que se ven con la búsqueda y el filtro actuales"
          >
            <Icon name="file_download" />
            Exportar listado
          </button>
        </div>
      </div>

      <CuotaTabs value={tab} counts={tabCounts} onChange={withPageReset(setTab)} />

      {selectedRows.length > 0 && (
        <BulkActionsBar
          rows={selectedRows}
          onExport={() => downloadCuotasCsv(selectedRows, period)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      <div id={TABLE_PANEL_ID} role="tabpanel" aria-label={`Cuotas: ${activeTab.label}`}>
        <DataTable
          headers={(
            <>
              <th className="py-3 pl-4 sm:pl-5 pr-2 w-10" scope="col">
                <SelectAllCheckbox rows={filtered} selectedIds={selectedIds} onChange={toggleFiltered} />
              </th>
              <th className="py-3 px-0 w-8" scope="col"><span className="sr-only">Detalle</span></th>
              <SortableHeader className={HEADER_CLASS} etiqueta="Socio / Jugador" columna="name" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Categoría" columna="category" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={`${HEADER_CLASS} sm:pr-5 text-right`} etiqueta="Saldo" columna="pending" orden={sort} onOrdenar={sortAndReset} />
            </>
          )}
        >
          <TableMessageRow
            colSpan={COLUMN_COUNT}
            isLoading={isLoading && rows.length === 0}
            isEmpty={visibleRows.length === 0}
            error={error}
            loadingText="Cargando cuotas..."
            errorText="No se pudieron cargar las cuotas."
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
                  <td className="py-3 px-4"><CategoryCell row={row} /></td>
                  <td className="py-3 px-4 sm:pr-5 text-right whitespace-nowrap font-semibold">
                    {row.paid
                      ? <span className={`${BADGE_CLASS} ${cuotaStateBadgeClass(CUOTA_STATES.PAGA)}`}>Pagada</span>
                      : formatMoney(row.pending)}
                  </td>
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
      </div>

      <TablePagination id="period-cuotas-rows-per-page" {...paginationProps} />

      {notifyOpen && (
        <NotifyCuotasModal
          opened
          rows={selectedRows}
          period={period}
          onClose={() => setNotifyOpen(false)}
          onSent={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  )
}
