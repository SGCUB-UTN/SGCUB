import { Fragment, useEffect, useMemo, useState } from 'react'
import { FILTER_CLASS, FILTER_WIDTH, SEARCH_WIDTH } from '../shared/listFilters'
import { Link, useSearchParams } from 'react-router-dom'
import { getCuota } from '../../api/cuotas'
import CuotaDetailPanel from '../finanzas/CuotaDetailPanel'
import ExportMenu from '../shared/ExportMenu'
import ClearFiltersButton from '../shared/ClearFiltersButton'
import { ROW_LINK_CLASS, stopRowClick } from '../shared/rowLink'
import SelectionBar from '../shared/SelectionBar'
import { formatPeriod } from '../shared/periodFormat'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import TableTabs from '../shared/TableTabs'
import { tabPanelId } from '../shared/tabIds'
import { matchesSearch } from '../shared/search'
import { formatDni } from '../personas/format'
import { CUOTA_STATES, CUOTA_STATE_TONES, cuotaStateLabel, cuotaStateShortLabel, isOverdue } from '../finanzas/cuotaStates'
import StatusBadge from '../shared/StatusBadge'
import ProfileBadge from '../shared/ProfileBadge'
import InactiveTag from '../shared/InactiveTag'
import { TONOS_BADGE } from '../shared/statusTones'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import CategoryFilter from '../shared/CategoryFilter'
import NotifyCuotasModal from './NotifyCuotasModal'
import { ALL_CATEGORIES, GENDERS, NO_CATEGORY, NO_CATEGORY_VALUE, categoryMatches, categoryOptions, findGender, genderFilterValue, selectedCategory } from '../shared/categoryFilters'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { TextSkeleton } from '../shared/Skeleton'
import {
  CUOTA_TYPES,
  CUOTAS_EXPORT_COLUMNS,
  formatCount,
  formatMoney,
  memberName,
} from './cuotaPeriod'

const ALL = 'all'
const ON_TIME = 'on_time'
const OVERDUE = 'overdue'
const PAID = 'paid'
const COLUMN_COUNT = 5

const TABS = [
  { value: ALL, label: 'Todas', matches: () => true, emptyText: 'No hay cuotas en este período.' },
  { value: ON_TIME, label: 'En fecha', matches: (row) => !row.paid && !isOverdue(row), emptyText: 'No hay cuotas en fecha en este período.' },
  { value: OVERDUE, label: 'Vencidas', matches: (row) => !row.paid && isOverdue(row), emptyText: 'No hay cuotas vencidas en este período.', alertWhenCounted: true },
  { value: PAID, label: 'Pagas', matches: (row) => row.paid, emptyText: 'No hay cuotas pagas en este período.' },
]

const isOverdueRow = TABS.find((option) => option.value === OVERDUE).matches

function CuotaStateBadge({ row }) {
  const state = row.paid ? CUOTA_STATES.PAGA : row.estado_cuota
  if (!state) return null
  return (
    <StatusBadge
      size="md"
      badge={{ label: cuotaStateShortLabel(state), title: cuotaStateLabel(state), tono: CUOTA_STATE_TONES[state] ?? 'neutro' }}
    />
  )
}
const HEADER_CLASS = 'py-3 px-4'

const TYPE_FILTERS = [
  { value: ALL, label: 'Tipo: Todos' },
  { value: CUOTA_TYPES.MEMBER, label: 'Socios' },
  { value: CUOTA_TYPES.PLAYER, label: 'Jugadores' },
  { value: CUOTA_TYPES.PARTIAL_LEAVE, label: 'Baja parcial' },
]

const PARAMS = { search: 'buscar', type: 'tipo', category: 'categoria', tab: 'estado' }

const validCategory = (value, categories) => {
  if (!value || value === ALL_CATEGORIES) return ALL_CATEGORIES
  if (value === NO_CATEGORY_VALUE) return value
  if (GENDERS.some((gender) => genderFilterValue(gender.value) === value)) return value
  return categories.some((option) => option.value === value) ? value : ALL_CATEGORIES
}

const categoryOf = (row) => row.categoria ?? NO_CATEGORY

const SORT_VALUES = {
  name: (row) => memberName(row),
  category: (row) => `${categoryOf(row)} ${row.categoria_genero ?? ''}`,
  pending: (row) => Number(row.pending),
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }

const CHECKBOX_CLASS = 'size-5 accent-primary cursor-pointer'
const CHECKBOX_LABEL_CLASS = 'flex items-center py-3 pl-4 sm:pl-5 pr-2 min-h-12 cursor-pointer'
const EXPAND_BUTTON_CLASS = 'inline-flex items-center justify-center size-10 rounded-md text-outline hover:bg-surface-container hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const TABLE_ID = 'period-cuotas'

const detailPath = (row) => (row.jugador_id ? `/padron/jugadores/${row.jugador_id}` : `/padron/socios/${row.socio_id}`)

const sumBy = (rows, key) => rows.reduce((total, row) => total + Number(row[key] ?? 0), 0)

const stopRowToggle = (event) => event.stopPropagation()

const categoryText = (name, genero) => {
  const gender = findGender(genero)
  return gender ? `${name} (${gender.value})` : name
}

const categoryTitle = (name, genero) => {
  const gender = findGender(genero)
  return gender ? `${name} ${gender.label.toLocaleLowerCase('es')}` : name
}

function CuotaTypeTag({ type }) {
  if (type === CUOTA_TYPES.PLAYER) return <ProfileBadge>Jugador</ProfileBadge>
  if (type === CUOTA_TYPES.PARTIAL_LEAVE) return <InactiveTag>Baja parcial</InactiveTag>
  return null
}

function CategoryCell({ row }) {
  if (!row.categoria) return <span className="text-on-surface-variant">{NO_CATEGORY}</span>
  const categories = [[row.categoria, row.categoria_genero]]
  if (row.categoria_secundaria) categories.push([row.categoria_secundaria, row.categoria_secundaria_genero])
  return (
    <span title={categories.map(([name, genero]) => categoryTitle(name, genero)).join(', ')}>
      {categories.map(([name, genero]) => categoryText(name, genero)).join(', ')}
    </span>
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

function CuotaDetailRow({ row, onPay, onAssignDiscount, onAssignScholarship, onChanged }) {
  const [detail, setDetail] = useState({ loading: true, error: false, cuota: null })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getCuota(row.cuota_id)
      .then((cuota) => active && setDetail({ loading: false, error: false, cuota }))
      .catch(() => active && setDetail({ loading: false, error: true, cuota: null }))
    return () => { active = false }
  }, [row.cuota_id, attempt])

  const retry = () => {
    setDetail({ loading: true, error: false, cuota: null })
    setAttempt((current) => current + 1)
  }

  if (!detail.cuota) {
    return (
      <tr className="bg-surface-container-low/60">
        <td colSpan={COLUMN_COUNT} className="py-4 px-4 sm:px-5">
          {detail.error ? (
            <div className="flex flex-wrap items-center gap-3" role="alert">
              <p className="text-base text-on-surface-variant">No se pudo cargar el detalle de la cuota.</p>
              <SecondaryButton icon="refresh" onClick={retry}>Reintentar</SecondaryButton>
            </div>
          ) : <TextSkeleton label="Cargando detalle..." lines={4} />}
        </td>
      </tr>
    )
  }

  return (
    <CuotaDetailPanel
      cuota={detail.cuota}
      colSpan={COLUMN_COUNT}
      onPay={() => onPay(row)}
      onAssignBenefit={() => onAssignDiscount(row)}
      onAssignScholarship={() => onAssignScholarship(row)}
      onChanged={onChanged}
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
  onAssignDiscount,
  onAssignScholarship,
  onChanged,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedIds, setSelectedIds] = useState(() => new Set())
  const [expandedId, setExpandedId] = useState(null)
  const [notifyRows, setNotifyRows] = useState(null)

  const typeCounts = useMemo(() => ({ ...countBy(rows, 'type'), [ALL]: rows.length }), [rows])
  const categories = useMemo(() => categoryOptions(rows), [rows])
  const hasUncategorized = rows.some((row) => !row.categoria_id)

  const search = searchParams.get(PARAMS.search) ?? ''
  const requestedType = searchParams.get(PARAMS.type)
  const type = TYPE_FILTERS.some((filter) => filter.value === requestedType) ? requestedType : ALL
  const categoryLocked = type === CUOTA_TYPES.MEMBER
  const category = categoryLocked ? ALL_CATEGORIES : validCategory(searchParams.get(PARAMS.category), categories)
  const requestedTab = searchParams.get(PARAMS.tab)
  const tab = TABS.some((option) => option.value === requestedTab) ? requestedTab : ALL

  const updateParams = (changes) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === ALL || value === ALL_CATEGORIES) next.delete(key)
      else next.set(key, value)
    })
    return next
  }, { replace: true })

  const setSearch = (value) => updateParams({ [PARAMS.search]: value })
  const setCategory = (value) => updateParams({ [PARAMS.category]: value })
  const setTab = (value) => updateParams({ [PARAMS.tab]: value })
  const changeType = (nextType) => updateParams({
    [PARAMS.type]: nextType,
    ...(nextType === CUOTA_TYPES.MEMBER ? { [PARAMS.category]: ALL_CATEGORIES } : {}),
  })

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
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)
  const hasFilters = search.trim() !== '' || type !== ALL || category !== ALL_CATEGORIES
  const clearFilters = () => {
    updateParams({ [PARAMS.search]: '', [PARAMS.type]: ALL, [PARAMS.category]: ALL_CATEGORIES })
    resetPage()
  }

  const selectedRows = useMemo(() => filtered.filter((row) => selectedIds.has(row.cuota_id)), [filtered, selectedIds])
  const overdueRows = useMemo(() => matching.filter(isOverdueRow), [matching])

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

  const emptyText = matching.length === rows.length
    ? activeTab.emptyText
    : 'Ninguna cuota coincide con la búsqueda o los filtros.'

  return (
    <div className="min-w-0">
      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Nombre, DNI o N° de socio"
            label="Buscar cuotas"
            className={SEARCH_WIDTH}
          />
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
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
          <ClearFiltersButton onClick={clearFilters} visible={hasFilters} />
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 xl:shrink-0">
          <PrimaryButton
            icon="notifications"
            onClick={() => setNotifyRows(overdueRows)}
            disabled={overdueRows.length === 0}
            title={overdueRows.length === 0 ? 'No hay cuotas vencidas con la búsqueda y los filtros actuales' : undefined}
          >
            {overdueRows.length === 0
              ? 'Sin cuotas vencidas'
              : `Notificar ${overdueRows.length === 1 ? 'al vencido' : `a los ${formatCount(overdueRows.length)} vencidos`}`}
          </PrimaryButton>
          <ExportMenu
            title={`Cuotas de ${formatPeriod(period)}`}
            filename={`cuotas-${period}`}
            columns={CUOTAS_EXPORT_COLUMNS}
            items={sorted}
            filters={[
              tab !== ALL && `Estado: ${activeTab.label}`,
              type !== ALL && `Tipo: ${TYPE_FILTERS.find((filter) => filter.value === type)?.label}`,
              category !== ALL_CATEGORIES && `Categoría: ${selectedCategory(category, categories).label}`,
              search.trim() && `Búsqueda: «${search.trim()}»`,
            ]}
          />
        </div>
      </div>

      <TableTabs
        id={TABLE_ID}
        label="Estado de pago"
        options={TABS.map((option) => ({
          ...option,
          count: tabCounts[option.value] ?? 0,
          badgeClass: option.alertWhenCounted && tabCounts[option.value] > 0 ? TONOS_BADGE.error : undefined,
        }))}
        value={tab}
        onChange={withPageReset((nextTab) => {
          setTab(nextTab)
          setSelectedIds(new Set())
        })}
      />

      {selectedRows.length > 0 && (
        <SelectionBar
          count={selectedRows.length}
          singular="cuota seleccionada"
          plural="cuotas seleccionadas"
          detail={<>Saldo <strong className="font-semibold text-on-surface tabular-nums">{formatMoney(sumBy(selectedRows, 'pending'))}</strong></>}
          onClear={() => setSelectedIds(new Set())}
        >
          <SecondaryButton icon="notifications" onClick={() => setNotifyRows(selectedRows)}>
            Notificar
          </SecondaryButton>
          <ExportMenu
            title={`Cuotas de ${formatPeriod(period)}: selección`}
            filename={`cuotas-${period}-seleccion`}
            columns={CUOTAS_EXPORT_COLUMNS}
            items={selectedRows}
          />
        </SelectionBar>
      )}

      <div id={tabPanelId(TABLE_ID)} role="tabpanel" aria-label={`Cuotas: ${activeTab.label}`}>
        <DataTable
          headers={(
            <>
              <th className="p-0 w-12" scope="col">
                <label className={CHECKBOX_LABEL_CLASS}>
                  <SelectAllCheckbox rows={filtered} selectedIds={selectedIds} onChange={toggleFiltered} />
                </label>
              </th>
              <th className="max-sm:hidden py-3 px-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
              <SortableHeader className={`${HEADER_CLASS} max-sm:pl-1`} etiqueta="Socio / Jugador" columna="name" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={`${HEADER_CLASS} max-sm:hidden`} etiqueta="Categoría" columna="category" orden={sort} onOrdenar={sortAndReset} />
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
            onClearFilters={hasFilters ? clearFilters : undefined}
          />

          {visibleRows.map((row) => {
            const name = memberName(row)
            const selected = selectedIds.has(row.cuota_id)
            const expanded = expandedId === row.cuota_id
            return (
              <Fragment key={row.cuota_id}>
                <tr
                  onClick={() => toggleExpanded(row.cuota_id)}
                  className={`cursor-pointer transition-colors ${selected || expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low/80'}`}
                >
                  <td className="p-0" onClick={stopRowToggle}>
                    <label className={CHECKBOX_LABEL_CLASS}>
                      <input
                        type="checkbox"
                        className={CHECKBOX_CLASS}
                        checked={selected}
                        onChange={() => toggleRow(row.cuota_id)}
                        aria-label={`Seleccionar la cuota de ${name}`}
                      />
                    </label>
                  </td>
                  <td className="max-sm:hidden py-1 px-0">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-label={`${expanded ? 'Ocultar' : 'Ver'} el detalle de la cuota de ${name}`}
                      onClick={(event) => {
                        stopRowClick(event)
                        toggleExpanded(row.cuota_id)
                      }}
                      className={EXPAND_BUTTON_CLASS}
                    >
                      <span className={`material-symbols-outlined transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} style={{ fontSize: 22 }} aria-hidden="true">
                        expand_more
                      </span>
                    </button>
                  </td>
                  <td className="py-3 px-4 max-sm:pl-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link to={detailPath(row)} onClick={stopRowClick} className={`font-medium text-on-surface hover:text-primary ${ROW_LINK_CLASS}`}>
                        {name}
                      </Link>
                      <CuotaTypeTag type={row.type} />
                    </div>
                    <div className="text-sm text-on-surface-variant">
                      N° {row.numero_socio ?? '—'} · DNI {formatDni(row.dni)}
                    </div>
                    {row.categoria && (
                      <div className="sm:hidden text-sm text-on-surface-variant">
                        <CategoryCell row={row} />
                      </div>
                    )}
                  </td>
                  <td className="max-sm:hidden py-3 px-4"><CategoryCell row={row} /></td>
                  <td className="py-3 px-4 sm:pr-5 text-right whitespace-nowrap">
                    <div className="flex flex-col items-end gap-1">
                      {!row.paid && <span className="font-semibold tabular-nums text-on-surface">{formatMoney(row.pending)}</span>}
                      <CuotaStateBadge row={row} />
                    </div>
                  </td>
                </tr>
                {expanded && (
                  <CuotaDetailRow
                    key={`${row.cuota_id}-${row.pending}`}
                    row={row}
                    onPay={onPay}
                    onAssignDiscount={onAssignDiscount}
                    onAssignScholarship={onAssignScholarship}
                    onChanged={onChanged}
                  />
                )}
              </Fragment>
            )
          })}
        </DataTable>
      </div>

      <TablePagination id="period-cuotas-rows-per-page" {...paginationProps} />

      {notifyRows && (
        <NotifyCuotasModal
          opened
          rows={notifyRows}
          period={period}
          onClose={() => setNotifyRows(null)}
          onSent={() => setSelectedIds(new Set())}
        />
      )}
    </div>
  )
}
