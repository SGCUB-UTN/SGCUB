import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import DocumentationStatus from '../documental/DocumentationStatus'
import { DOCUMENTATION_LABELS, documentationSeverity } from '../documental/documentationStates'
import AccountStatus, { PayButton } from '../finanzas/AccountStatus'
import { accountDebt } from '../finanzas/accountDebt'
import { notifyCajaChanged } from '../finanzas/cajaEvents'
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
import { formatExportAmount } from '../shared/listExport'
import {
  ACCOUNT_FILTERS,
  ALL,
  DOCUMENTATION_FILTERS,
  FILTER_CLASS,
  FILTER_WIDTH,
  SEARCH_WIDTH,
  filterLabel,
  matchesAccountFilter,
  matchesDocumentationFilter,
} from '../shared/listFilters'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import useRegisterPayment from '../../hooks/useRegisterPayment'
import { formatDni, isActiveStatus } from '../personas/format'
import { matchesSearch } from '../shared/search'

const COLUMN_COUNT = 7
const GENDER_PREFIX = 'gender:'
const DEFAULT_STATUS = 'activo'
const GENDER_LABELS = { M: 'Masculino', F: 'Femenino' }

const STATUS_FILTERS = [
  { value: 'activo', label: 'Activos' },
  { value: ALL, label: 'Estado: Todos' },
  { value: 'baja', label: 'De Baja' },
  { value: 'baja_parcial', label: 'Baja parcial' },
]

const matchesCategory = (jugador, value) => {
  if (value === ALL_CATEGORIES) return true
  const cat = jugador.categoria
  if (value === NO_CATEGORY_VALUE) return !cat?.categoria_id
  if (value.startsWith(GENDER_PREFIX)) {
    return Boolean(cat?.categoria_id) && cat.genero === value.slice(GENDER_PREFIX.length)
  }
  return String(cat?.categoria_id) === value
}

const isActive = (jugador) => {
  const estado = (jugador.estado?.nombre ?? '').toLowerCase()
  return estado.includes('activo') && !estado.includes('baja') && !estado.includes('inactivo')
}

const statusLabel = (jugador) => {
  if (isActive(jugador)) return 'Activo'
  return jugador.tipo_baja === 'parcial' ? 'Baja parcial' : 'De Baja'
}

const fullName = (jugador) => `${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''}`.trim()

const secondaryCategoryName = (jugador) => jugador.categoria_secundaria?.nombre ?? ''

const socioCanPay = (jugador) => isActiveStatus(jugador.socio?.estado_administrativo_nombre)

const EXPORT_COLUMNS = [
  { header: 'N° socio', value: (jugador) => jugador.socio?.numero_socio },
  { header: 'Nombre y apellido', value: fullName },
  { header: 'DNI', value: (jugador) => formatDni(jugador.socio?.dni) },
  { header: 'Categoría', value: (jugador) => jugador.categoria?.nombre },
  { header: 'Categoría secundaria', value: secondaryCategoryName },
  { header: 'Documentación', value: (jugador) => DOCUMENTATION_LABELS[jugador.documentacion?.estado] },
  { header: 'Estado', value: statusLabel },
  { header: 'Deuda', value: (jugador) => formatExportAmount(accountDebt(jugador.socio?.cuenta)) },
  { header: 'Cuotas vencidas', value: (jugador) => jugador.socio?.cuenta?.cuotas_vencidas ?? 0 },
]

const SORT_VALUES = {
  numero: (jugador) => (jugador.socio?.numero_socio ? Number(jugador.socio.numero_socio) : null),
  nombre: fullName,
  documentacion: (jugador) => documentationSeverity(jugador.documentacion),
  cuenta: (jugador) => accountDebt(jugador.socio?.cuenta),
}
const INITIAL_SORT = { columna: 'numero', direccion: 'desc' }

const categoryDescription = (value, options) => {
  if (value === ALL_CATEGORIES) return null
  if (value === NO_CATEGORY_VALUE) return 'Categoría: Sin categoría'
  if (value.startsWith(GENDER_PREFIX)) return `Categoría: ${GENDER_LABELS[value.slice(GENDER_PREFIX.length)] ?? value}`
  const option = options.find((item) => item.value === value)
  return option ? `Categoría: ${option.name}` : null
}

function JugadoresTable({ data, categorias = [], isLoading, error, status, onStatusChange, onRetry, exportSlot }) {
  const navigate = useNavigate()
  const { openPayment } = useRegisterPayment()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL_CATEGORIES)
  const [account, setAccount] = useState(ALL)
  const [documentation, setDocumentation] = useState(ALL)

  const jugadores = useMemo(() => data ?? [], [data])

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
    () => jugadores.some((jugador) => !jugador.categoria?.categoria_id),
    [jugadores],
  )

  const filtered = useMemo(() => {
    const text = search.trim()
    return jugadores.filter((jugador) => {
      if (!matchesCategory(jugador, category)) return false
      if (status === 'activo' && !isActive(jugador)) return false
      if (status === 'baja' && jugador.tipo_baja !== 'completa') return false
      if (status === 'baja_parcial' && jugador.tipo_baja !== 'parcial') return false
      if (!matchesAccountFilter(jugador.socio?.cuenta, account)) return false
      if (!matchesDocumentationFilter(jugador.documentacion, documentation)) return false
      if (!text) return true
      return matchesSearch(text, [jugador.socio?.nombre, jugador.socio?.apellido, jugador.socio?.dni, jugador.categoria?.nombre])
    })
  }, [jugadores, search, category, status, account, documentation])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const hasFilters = search.trim() !== ''
    || category !== ALL_CATEGORIES
    || account !== ALL
    || documentation !== ALL
    || status !== DEFAULT_STATUS
  const clearFilters = () => {
    setSearch('')
    setCategory(ALL_CATEGORIES)
    setAccount(ALL)
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
            placeholder="Buscar por nombre, DNI o categoría"
            label="Buscar jugadores"
            className={SEARCH_WIDTH}
          />
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
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
            value={account}
            onChange={(event) => withPageReset(setAccount)(event.target.value)}
            aria-label="Filtrar por estado de cuenta"
          >
            {ACCOUNT_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </FilterSelect>
          <ClearFiltersButton onClick={clearFilters} visible={hasFilters} />
        </div>
      </div>

      {exportSlot && createPortal(
        <ExportMenu
          title="Jugadores"
          filename="jugadores"
          columns={EXPORT_COLUMNS}
          items={sorted}
          filters={[
            filterLabel(STATUS_FILTERS, status, 'Estado'),
            categoryDescription(category, categoryOptions),
            filterLabel(DOCUMENTATION_FILTERS, documentation, 'Documentación'),
            filterLabel(ACCOUNT_FILTERS, account, 'Cuenta'),
            search.trim() && `Búsqueda: «${search.trim()}»`,
          ]}
        />,
        exportSlot,
      )}

      <DataTable
        headers={(
          <>
            <SortableHeader className="max-sm:hidden py-3 px-4 w-28 whitespace-nowrap" etiqueta="N° Socio" columna="numero" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Nombre y Apellido" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">DNI</th>
            <th className="max-sm:hidden py-3 px-4" scope="col">Categoría</th>
            <SortableHeader className="max-sm:hidden py-3 px-4 whitespace-nowrap" etiqueta="Documentación" columna="documentacion" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="max-sm:hidden py-3 px-4 whitespace-nowrap text-right" etiqueta="Cuenta" columna="cuenta" orden={sort} onOrdenar={sortAndReset} />
            <th className="max-sm:hidden py-3 px-4 w-28" scope="col"><span className="sr-only">Acciones</span></th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando jugadores..."
          errorText="No se pudieron cargar los jugadores."
          emptyText={jugadores.length === 0 ? 'Todavía no hay jugadores cargados.' : 'Ningún jugador coincide con la búsqueda o los filtros.'}
          onRetry={onRetry}
          onClearFilters={hasFilters ? clearFilters : undefined}
        />

        {!isLoading && visibleRows.map((jugador) => (
          <tr
            key={jugador.jugador_id}
            onClick={() => navigate(`/padron/jugadores/${jugador.jugador_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer group"
          >
            <td className="max-sm:hidden py-3 px-4 font-bold text-primary text-base pl-6">
              {jugador.socio?.numero_socio ? `#${jugador.socio.numero_socio}` : '—'}
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={`/padron/jugadores/${jugador.jugador_id}`}
                  onClick={stopRowClick}
                  className={`font-medium block text-base ${ROW_LINK_CLASS} ${isActive(jugador) ? 'text-on-surface' : 'text-on-surface-variant'}`}
                >
                  {fullName(jugador)}
                </Link>
                {!isActive(jugador) && <InactiveTag>{statusLabel(jugador)}</InactiveTag>}
              </div>
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDni(jugador.socio?.dni)}</td>
            <td className="max-sm:hidden py-3 px-4 text-on-surface-variant">
              {jugador.categoria?.nombre ?? '—'}
              {secondaryCategoryName(jugador) && <span className="text-on-surface-variant/80"> ({secondaryCategoryName(jugador)})</span>}
            </td>
            <td className="max-sm:hidden py-3 px-4"><DocumentationStatus documentacion={jugador.documentacion} /></td>
            <td className="max-sm:hidden py-3 px-4 text-right whitespace-nowrap"><AccountStatus cuenta={jugador.socio?.cuenta} /></td>
            <td className="max-sm:hidden py-3 px-4 text-right" onClick={stopRowClick}>
              <PayButton
                onPay={() => openPayment({ socioId: jugador.socio.socio_id, onSuccess: notifyCajaChanged })}
                label={`Registrar pago de ${fullName(jugador)}`}
                disabledReason={socioCanPay(jugador) ? undefined : 'Los socios de baja no pueden registrar pagos'}
              />
            </td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="jugadores-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default JugadoresTable
