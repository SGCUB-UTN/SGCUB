import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import AccountStatus, { PayButton } from '../finanzas/AccountStatus'
import { accountDebt } from '../finanzas/accountDebt'
import { notifyCajaChanged } from '../finanzas/cajaEvents'
import ClearFiltersButton from '../shared/ClearFiltersButton'
import ExportMenu from '../shared/ExportMenu'
import InactiveTag from '../shared/InactiveTag'
import { ROW_LINK_CLASS, stopRowClick } from '../shared/rowLink'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import ProfileBadge from '../shared/ProfileBadge'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { formatExportAmount } from '../shared/listExport'
import { ACCOUNT_FILTERS, ALL, FILTER_CLASS, FILTER_WIDTH, SEARCH_WIDTH, filterLabel, matchesAccountFilter } from '../shared/listFilters'
import { formatDni, isActiveStatus } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import useRegisterPayment from '../../hooks/useRegisterPayment'
import { matchesSearch } from '../shared/search'

const COLUMN_COUNT = 5
const DEFAULT_STATUS = 'activo'

const STATUS_FILTERS = [
  { value: 'activo', label: 'Activos' },
  { value: ALL, label: 'Estado: Todos' },
  { value: 'baja', label: 'De Baja' },
  { value: 'ex_jugador', label: 'Ex jugadores' },
]

const formatDate = (date) => {
  if (!date) return ''
  const parts = String(date).split('-')
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date
}

const detailPathOf = (socio) => (socio.jugador_id
  ? `/padron/jugadores/${socio.jugador_id}`
  : `/padron/socios/${socio.socio_id}`)

const isActive = (socio) => isActiveStatus(socio.estado_administrativo_nombre)

const EXPORT_COLUMNS = [
  { header: 'N° socio', value: (socio) => socio.numero_socio },
  { header: 'Nombre y apellido', value: (socio) => `${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim() },
  { header: 'DNI', value: (socio) => formatDni(socio.dni) },
  { header: 'Teléfono', value: (socio) => socio.telefono },
  { header: 'Fecha de alta', value: (socio) => formatDate(socio.fecha_alta) },
  { header: 'Estado', value: (socio) => (isActive(socio) ? 'Activo' : 'De Baja') },
  { header: 'Deuda', value: (socio) => formatExportAmount(accountDebt(socio.cuenta)) },
  { header: 'Cuotas vencidas', value: (socio) => socio.cuenta?.cuotas_vencidas ?? 0 },
]

const SORT_VALUES = {
  numero: (socio) => (socio.numero_socio ? Number(socio.numero_socio) : null),
  nombre: (socio) => `${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim(),
  cuenta: (socio) => accountDebt(socio.cuenta),
}
const INITIAL_SORT = { columna: 'numero', direccion: 'desc' }

function SociosTable({ data, isLoading, error, status, onStatusChange, onRetry, exportSlot }) {
  const navigate = useNavigate()
  const { openPayment } = useRegisterPayment()
  const [search, setSearch] = useState('')
  const [account, setAccount] = useState(ALL)

  const socios = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim()
    return socios.filter((socio) => {
      if (status === 'activo' && !isActive(socio)) return false
      if (status === 'baja' && isActive(socio)) return false
      if (status === 'ex_jugador' && !socio.es_ex_jugador) return false
      if (!matchesAccountFilter(socio.cuenta, account)) return false
      if (!text) return true
      return matchesSearch(text, [socio.nombre, socio.apellido, socio.dni, socio.numero_socio])
    })
  }, [socios, search, status, account])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const hasFilters = search.trim() !== '' || account !== ALL || status !== DEFAULT_STATUS
  const clearFilters = () => {
    setSearch('')
    setAccount(ALL)
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
            placeholder="Buscar por nombre, DNI o N° de socio"
            label="Buscar socios"
            className={SEARCH_WIDTH}
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
          title="Socios"
          filename="socios"
          columns={EXPORT_COLUMNS}
          items={sorted}
          filters={[
            filterLabel(STATUS_FILTERS, status, 'Estado'),
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
          loadingText="Cargando socios..."
          errorText="No se pudieron cargar los socios."
          emptyText={socios.length === 0 ? 'Todavía no hay socios cargados.' : 'Ningún socio coincide con la búsqueda o los filtros.'}
          onRetry={onRetry}
          onClearFilters={hasFilters ? clearFilters : undefined}
        />

        {!isLoading && visibleRows.map((socio) => (
          <tr
            key={socio.socio_id}
            onClick={() => navigate(detailPathOf(socio), { state: { from: 'socios' } })}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer group"
          >
            <td className="max-sm:hidden py-3 px-4 font-bold text-primary text-base pl-6">
              {socio.numero_socio ? `#${socio.numero_socio}` : '—'}
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Link
                  to={detailPathOf(socio)}
                  state={{ from: 'socios' }}
                  onClick={stopRowClick}
                  className={`font-medium text-base ${ROW_LINK_CLASS} ${isActive(socio) ? 'text-on-surface' : 'text-on-surface-variant'}`}
                >
                  {socio.nombre} {socio.apellido}
                </Link>
                {!isActive(socio) && <InactiveTag>De Baja</InactiveTag>}
                {socio.es_ex_jugador && <ProfileBadge>Ex jugador</ProfileBadge>}
              </div>
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDni(socio.dni)}</td>
            <td className="max-sm:hidden py-3 px-4 text-right whitespace-nowrap">
              <AccountStatus cuenta={socio.cuenta} />
            </td>
            <td className="max-sm:hidden py-3 px-4 text-right" onClick={stopRowClick}>
              <PayButton
                onPay={() => openPayment({ socioId: socio.socio_id, onSuccess: notifyCajaChanged })}
                label={`Registrar pago de ${socio.nombre} ${socio.apellido}`}
                disabledReason={isActive(socio) ? undefined : 'Los socios de baja no pueden registrar pagos'}
              />
            </td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="socios-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default SociosTable
