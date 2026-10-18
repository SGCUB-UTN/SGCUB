import { Fragment, useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import CuotaDetailPanel from '../finanzas/CuotaDetailPanel'
import { formatPeriod, periodOptions } from '../shared/periodFormat'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'

import {
  CUOTA_STATE_LABELS,
  CUOTA_STATE_ORDER,
  OVERDUE_FILTER,
  cuotaStateBadgeClass,
  cuotaStateLabel,
  matchesStateFilter,
} from '../finanzas/cuotaStates'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const HEADER_CLASS = 'py-3 px-4'
const COLUMN_COUNT = 8
import { formatDate } from '../personas/format'

const ALL = 'todos'

const socioName = (cuota) => {
  const socio = cuota?.socio
  if (!socio) return 'Sin socio'

  const fullName = `${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim()
  return fullName || socio.dni || 'Sin socio'
}

const cuotaAmount = (cuota) => {
  if (cuota.monto_total !== undefined) return Number(cuota.monto_total)
  return (cuota.items ?? []).reduce(
    (total, item) => total + (item.es_descuento ? -Number(item.monto) : Number(item.monto)),
    0,
  )
}

const SORT_VALUES = {
  period: (cuota) => cuota.periodo,
  socio: (cuota) => (cuota.socio ? socioName(cuota) : null),
  firstDue: (cuota) => cuota.fecha_venc1,
  secondDue: (cuota) => cuota.fecha_venc2,
  amount: (cuota) => cuotaAmount(cuota),
  status: (cuota) => CUOTA_STATE_ORDER[cuota.estado_cuota] ?? null,
}
// On load: most recent periods first.
const INITIAL_SORT = { columna: 'period', direccion: 'desc' }

// Remounts the panel (and reloads its receipts) when a payment or benefit changes the cuota
const panelKey = (cuota) => `${cuota.cuota_id}-${cuota.monto_total}-${cuota.saldo_pendiente}`

const stopRowToggle = (event) => event.stopPropagation()

function CuotaTable({ data = [], isLoading = false, error = null, onAdd, onEdit, onDelete, onPay, onAssignBenefit }) {
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [status, setStatus] = useState(ALL)
  const [period, setPeriod] = useState(ALL)

  const cuotas = useMemo(() => data ?? [], [data])
  const availablePeriods = useMemo(() => periodOptions(cuotas, (cuota) => cuota.periodo), [cuotas])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()

    return cuotas.filter((cuota) => {
      if (status !== ALL && !matchesStateFilter(cuota, status)) return false
      if (period !== ALL && cuota.periodo !== period) return false
      if (!text) return true

      return [
        cuota.periodo,
        cuota.cuota_id,
        socioName(cuota),
        cuota.socio?.dni,
      ].some((field) => String(field ?? '').toLowerCase().includes(text))
    })
  }, [cuotas, search, status, period])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, start, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const toggle = (cuotaId) => setExpandedId((current) => (current === cuotaId ? null : cuotaId))

  const handleKeyDown = (event, cuotaId) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle(cuotaId)
    }
  }

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Buscar por período, socio o DNI..."
            label="Filtrar cuotas"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={period}
            onChange={(event) => withPageReset(setPeriod)(event.target.value)}
            aria-label="Filtrar cuotas por período"
          >
            <option value={ALL}>Período: Todos</option>
            {availablePeriods.map((value) => <option key={value} value={value}>{formatPeriod(value)}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            value={status}
            onChange={(event) => withPageReset(setStatus)(event.target.value)}
            aria-label="Filtrar cuotas por estado"
          >
            <option value={ALL}>Estado: Todos</option>
            <option value={OVERDUE_FILTER}>Vencidas (1° y 2° venc.)</option>
            {Object.entries(CUOTA_STATE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </FilterSelect>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-3 xl:shrink-0">
          
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 h-10 px-3 bg-primary text-on-primary rounded text-lg font-medium transition-colors cursor-pointer hover:opacity-95"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            <span>Agregar</span>
          </button>
        </div>
      </div>

      <DataTable
        tableClassName="text-base"
        bodyClassName="text-lg"
        headers={(
          <>
            <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
            <SortableHeader className={HEADER_CLASS} etiqueta="Período" columna="period" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Socio" columna="socio" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Venc. 1" columna="firstDue" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Venc. 2" columna="secondDue" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={`${HEADER_CLASS} text-right`} etiqueta="Monto" columna="amount" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Estado" columna="status" orden={sort} onOrdenar={sortAndReset} />
            <th className={`${HEADER_CLASS} text-right`} scope="col">Acciones</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando cuotas..."
          errorText="No se pudieron cargar las cuotas."
          emptyText="No hay cuotas que coincidan con el filtro."
        />

        {!isLoading && visibleRows.map((cuota) => {
          const expanded = expandedId === cuota.cuota_id
          return (
            <Fragment key={cuota.cuota_id}>
              <tr
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => toggle(cuota.cuota_id)}
                onKeyDown={(event) => handleKeyDown(event, cuota.cuota_id)}
                className={`cursor-pointer transition-colors ${expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low/80'}`}
              >
                <td className="py-3 pl-4 pr-0 text-outline">
                  <span className={`material-symbols-outlined text-[22px] transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
                </td>
                <td className="py-3 px-4 font-medium">{cuota.periodo}</td>
                <td className="py-3 px-4 text-on-surface-variant">{socioName(cuota)}</td>
                <td className="py-3 px-4 text-on-surface-variant">{formatDate(cuota.fecha_venc1)}</td>
                <td className="py-3 px-4 text-on-surface-variant">{formatDate(cuota.fecha_venc2)}</td>
                <td className="py-3 px-4 text-right font-semibold">{cuotaAmount(cuota).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold border ${cuotaStateBadgeClass(cuota.estado_cuota)}`}>
                    {cuotaStateLabel(cuota.estado_cuota)}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2" onClick={stopRowToggle} onKeyDown={stopRowToggle}>
                    <button
                      type="button"
                      title="Editar cuota"
                      aria-label={`Editar cuota ${cuota.periodo}`}
                      onClick={() => onEdit?.(cuota)}
                      className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
                    </button>
                    <button
                      type="button"
                      title="Eliminar cuota"
                      aria-label={`Eliminar cuota ${cuota.periodo}`}
                      onClick={() => onDelete?.(cuota)}
                      className="w-8 h-8 flex items-center justify-center rounded border border-red-200 text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
              {expanded && (
                <CuotaDetailPanel
                  key={panelKey(cuota)}
                  cuota={cuota}
                  colSpan={COLUMN_COUNT}
                  onPay={cuota.socio ? onPay : undefined}
                  onAssignBenefit={cuota.socio ? onAssignBenefit : undefined}
                />
              )}
            </Fragment>
          )
        })}
      </DataTable>

      <TablePagination id="cuotas-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default CuotaTable
