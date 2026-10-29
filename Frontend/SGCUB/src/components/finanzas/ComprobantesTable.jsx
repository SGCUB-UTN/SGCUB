import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { formatPeriod, periodOf, periodOptions } from '../shared/periodFormat'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { matchesSearch } from '../shared/search'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const HEADER_CLASS = 'py-3 px-4'
const COLUMN_COUNT = 6
const ALL = 'todos'

const SCOPES = [
  {
    id: 'todos',
    titulo: 'Todos los movimientos',
    detalle: 'Recibos de cuotas e ingresos, notas de crédito y devoluciones.',
  },
  {
    id: 'recibos',
    titulo: 'Recibos',
    detalle: 'Pagos de cuotas e ingresos ajenos a cuotas.',
  },
  {
    id: 'devoluciones',
    titulo: 'Devoluciones',
    detalle: 'Notas de crédito y devoluciones manuales. No restan de los ingresos.',
  },
]

const TYPES = {
  CuotaVigente: { label: 'Cobro de cuotas', group: 'recibos', badge: 'bg-primary/10 text-primary border-primary/20' },
  CuotaAnulada: { label: 'Cobro de cuotas anulado', group: 'recibos', badge: 'bg-error-container text-on-error-container border-error/20' },
  IngresoVigente: { label: 'Ingreso', group: 'recibos', badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  IngresoAnulado: { label: 'Ingreso anulado', group: 'recibos', badge: 'bg-error-container text-on-error-container border-error/20' },
  NotaCredito: { label: 'Nota de crédito', group: 'devoluciones', badge: 'bg-amber-500/15 text-amber-800 border-amber-500/30' },
  Manual: { label: 'Devolución manual', group: 'devoluciones', badge: 'bg-error/10 text-error border-error/20' },
}

const receiptType = (comprobante) => {
  const annulled = comprobante.estado === 'Anulado'
  if (comprobante.es_ingreso) return annulled ? 'IngresoAnulado' : 'IngresoVigente'
  return annulled ? 'CuotaAnulada' : 'CuotaVigente'
}

const socioName = (socio) => (socio ? `${socio.apellido ?? ''}, ${socio.nombre ?? ''}`.replace(/^, |, $/g, '') : '')

const SORT_VALUES = {
  number: (item) => Number(item.sortNumber ?? 0),
  date: (item) => item.sortDate || '',
  socio: (item) => item.socioLabel || null,
  amount: (item) => Number(item.amount ?? 0),
}

const INITIAL_SORT = { columna: 'date', direccion: 'desc' }

function ComprobantesTable({
  comprobantes = [],
  devoluciones = [],
  isLoading,
  error,
  onSelect,
  onSelectDevolucion,
}) {
  const [scope, setScope] = useState('todos')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(ALL)
  const [month, setMonth] = useState(ALL)

  const unifiedItems = useMemo(() => {
    const receiptItems = comprobantes.map((comprobante) => {
      const type = receiptType(comprobante)
      const refunded = Number(comprobante.monto_devuelto ?? 0)
      return {
        key: `comprobante-${comprobante.comprobante_id}`,
        kind: 'comprobante',
        raw: comprobante,
        filterCode: type,
        refCode: comprobante.codigo,
        badgeLabel: TYPES[type].label,
        badgeClass: TYPES[type].badge,
        date: comprobante.fecha_emision,
        sortDate: `${comprobante.fecha_emision || ''}-R${String(comprobante.numero).padStart(8, '0')}`,
        sortNumber: comprobante.numero,
        socio: comprobante.socio,
        socioLabel: socioName(comprobante.socio),
        concept: comprobante.es_ingreso ? comprobante.concepto : 'Cobro de cuotas',
        subConcept: refunded > 0 ? `Devuelto con notas de crédito: ${formatAmount(refunded)}` : `Pago #${comprobante.pago}`,
        paymentMethod: 'Ver comprobante',
        amount: Number(comprobante.monto_total ?? 0),
        isPositive: true,
        isAnulado: comprobante.estado === 'Anulado',
      }
    })

    const refundItems = devoluciones.map((devolucion) => ({
      key: `devolucion-${devolucion.devolucion_id}`,
      kind: 'devolucion',
      raw: devolucion,
      filterCode: devolucion.tipo,
      refCode: devolucion.codigo,
      badgeLabel: TYPES[devolucion.tipo]?.label ?? devolucion.tipo_nombre,
      badgeClass: TYPES[devolucion.tipo]?.badge ?? TYPES.Manual.badge,
      date: devolucion.fecha,
      sortDate: `${String(devolucion.fecha ?? '').slice(0, 10)}-D${String(devolucion.numero).padStart(8, '0')}`,
      sortNumber: devolucion.numero,
      socio: devolucion.socio,
      socioLabel: socioName(devolucion.socio),
      concept: devolucion.concepto,
      subConcept: devolucion.comprobante_anulado_codigo
        ? `Sobre el comprobante anulado ${devolucion.comprobante_anulado_codigo} · Responsable: ${devolucion.responsable}`
        : `Responsable: ${devolucion.responsable}`,
      paymentMethod: devolucion.medio_de_pago_nombre,
      amount: Number(devolucion.monto ?? 0),
      isPositive: false,
      isAnulado: false,
    }))

    return [...receiptItems, ...refundItems]
  }, [comprobantes, devoluciones])

  const availableMonths = useMemo(
    () => periodOptions(unifiedItems, (item) => periodOf(item.date)),
    [unifiedItems],
  )

  const visibleTypeOptions = useMemo(
    () => Object.entries(TYPES)
      .filter(([, type]) => scope === 'todos' || type.group === scope)
      .map(([value, type]) => ({ value, label: type.label })),
    [scope],
  )

  const filtered = useMemo(() => {
    const text = search.trim()
    const textDigits = text.replace(/[.#]/g, '')
    return unifiedItems.filter((item) => {
      if (scope !== 'todos' && TYPES[item.filterCode]?.group !== scope) return false
      if (typeFilter !== ALL && item.filterCode !== typeFilter) return false
      if (month !== ALL && periodOf(item.date) !== month) return false
      if (!text) return true
      return matchesSearch(text, [
        item.socioLabel,
        item.concept,
        item.subConcept,
        item.badgeLabel,
        item.paymentMethod,
        item.refCode,
      ])
        || (textDigits !== '' && [
          item.sortNumber,
          item.raw.pago,
          item.socio?.dni,
          item.socio?.numero_socio,
        ].some((field) => String(field ?? '').includes(textDigits)))
    })
  }, [unifiedItems, scope, typeFilter, month, search])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const changeScope = (nextScope) => {
    withPageReset(() => {
      setScope(nextScope)
      setTypeFilter(ALL)
    })()
  }

  const handleRowAction = (item) => {
    if (item.kind === 'comprobante') {
      onSelect?.(item.raw)
    } else {
      onSelectDevolucion?.(item.raw)
    }
  }

  const handleKeyDown = (event, item) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleRowAction(item)
    }
  }

  return (
    <section
      className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden"
      aria-labelledby="comprobantes-title"
    >
      <div className="p-5 border-b border-outline-variant/20 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 id="comprobantes-title" className="text-xl font-bold text-on-surface">
              Movimientos y comprobantes de caja
            </h2>
            <p className="text-sm text-on-surface-variant">
              Recibos de cuotas e ingresos, notas de crédito y devoluciones manuales.
            </p>
          </div>
          <span className="material-symbols-outlined text-primary text-2xl" aria-hidden="true">receipt_long</span>
        </div>

        <fieldset className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <legend className="sr-only">Seleccionar tipo de registros de caja</legend>
          {SCOPES.map((opcion) => (
            <label
              key={opcion.id}
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                scope === opcion.id
                  ? 'border-primary bg-primary/5'
                  : 'border-outline-variant/40 hover:bg-surface-container-low'
              }`}
            >
              <input
                type="radio"
                name="alcance-caja"
                value={opcion.id}
                checked={scope === opcion.id}
                onChange={() => changeScope(opcion.id)}
                className="mt-1 accent-primary"
              />
              <span>
                <span className="block font-semibold text-on-surface">{opcion.titulo}</span>
                <span className="block mt-0.5 text-sm text-on-surface-variant">{opcion.detalle}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </div>

      <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Buscar por comprobante, socio, DNI o concepto..."
          label="Filtrar movimientos y comprobantes"
        />
        <FilterSelect
          className={FILTER_CLASS}
          value={month}
          onChange={(event) => withPageReset(setMonth)(event.target.value)}
          aria-label="Filtrar por mes"
        >
          <option value={ALL}>Mes: Todos</option>
          {availableMonths.map((value) => <option key={value} value={value}>{formatPeriod(value)}</option>)}
        </FilterSelect>
        <FilterSelect
          className={FILTER_CLASS}
          value={typeFilter}
          onChange={(event) => withPageReset(setTypeFilter)(event.target.value)}
          aria-label="Filtrar por tipo de movimiento"
        >
          <option value={ALL}>Estado / Tipo: Todos</option>
          {visibleTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </FilterSelect>
      </div>

      <DataTable
        tableClassName="min-w-[820px]"
        headers={(
          <>
            <SortableHeader className={HEADER_CLASS} etiqueta="Referencia" columna="number" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Fecha" columna="date" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Socio" columna="socio" orden={sort} onOrdenar={sortAndReset} />
            <th className={HEADER_CLASS} scope="col">Concepto y comprobante asociado</th>
            <th className={HEADER_CLASS} scope="col">Medio / Acción</th>
            <SortableHeader className={`${HEADER_CLASS} text-right`} etiqueta="Monto" columna="amount" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={Boolean(error) || visibleRows.length === 0}
          error={error}
          loadingText="Cargando movimientos y comprobantes..."
          errorText="No se pudieron cargar los movimientos de caja."
          emptyText={
            unifiedItems.length === 0
              ? 'Todavía no hay movimientos ni comprobantes registrados.'
              : 'No hay movimientos que coincidan con el filtro.'
          }
        />

        {!isLoading && !error && visibleRows.map((item) => (
          <tr
            key={item.key}
            onClick={() => handleRowAction(item)}
            onKeyDown={(event) => handleKeyDown(event, item)}
            tabIndex={0}
            role="button"
            className="hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none transition-colors cursor-pointer"
          >
            <td className="py-3 px-4 whitespace-nowrap">
              <div className="flex flex-col items-start gap-1">
                <span className="font-bold text-primary">{item.refCode}</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${item.badgeClass}`}>
                  {item.badgeLabel}
                </span>
              </div>
            </td>
            <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(item.date)}</td>
            <td className="py-3 px-4">
              {item.socio ? (
                <>
                  <span className="block font-medium text-on-surface">{item.socioLabel}</span>
                  <span className="block text-sm text-on-surface-variant">DNI {formatDni(item.socio.dni)}</span>
                </>
              ) : (
                <span className="text-on-surface-variant">—</span>
              )}
            </td>
            <td className="py-3 px-4 max-w-xs">
              <span className="block font-medium text-on-surface truncate" title={item.concept}>
                {item.concept}
              </span>
              <span className="block text-xs text-on-surface-variant truncate" title={item.subConcept}>
                {item.subConcept}
              </span>
            </td>
            <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">
              <span className="inline-flex items-center gap-1 text-sm">
                {item.paymentMethod}
                <span className="material-symbols-outlined text-[16px] text-primary" aria-hidden="true">chevron_right</span>
              </span>
            </td>
            <td
              className={`py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                item.isAnulado
                  ? 'text-outline line-through'
                  : item.isPositive
                    ? 'text-emerald-700'
                    : 'text-error'
              }`}
            >
              {item.isAnulado ? '' : item.isPositive ? '+ ' : '− '}
              {formatAmount(item.amount)}
            </td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="comprobantes-rows-per-page" {...paginationProps} />
    </section>
  )
}

export default ComprobantesTable
