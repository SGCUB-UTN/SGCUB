import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SegmentedControl from '../shared/SegmentedControl'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { formatPeriod, periodOf, periodOptions } from '../shared/periodFormat'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { matchesSearch } from '../shared/search'
import { downloadCashMovementsCsv } from './cashMovementsCsv'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const HEADER_CLASS = 'py-3 px-4'
const COLUMN_COUNT = 6
const ALL = 'todos'

const SCOPES = [
  {
    value: 'todos',
    label: 'Todos los movimientos',
    description: 'Recibos de cuotas e ingresos, notas de crédito y devoluciones.',
  },
  {
    value: 'recibos',
    label: 'Recibos',
    description: 'Pagos de cuotas e ingresos ajenos a cuotas.',
  },
  {
    value: 'devoluciones',
    label: 'Devoluciones',
    description: 'Notas de crédito y devoluciones manuales. No restan de los ingresos.',
  },
]

const ANNULLED_BADGE = 'bg-error-container text-on-error-container border-error/20'

const TYPES = {
  CuotaVigente: { label: 'Cobro de cuotas', group: 'recibos', badge: 'bg-primary/10 text-primary border-primary/20' },
  CuotaAnulada: { label: 'Cobro de cuotas anulado', badgeLabel: 'Anulado', group: 'recibos', badge: ANNULLED_BADGE },
  IngresoVigente: { label: 'Ingreso', group: 'recibos', badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  IngresoAnulado: { label: 'Ingreso anulado', badgeLabel: 'Anulado', group: 'recibos', badge: ANNULLED_BADGE },
  NotaCredito: { label: 'Nota de crédito', group: 'devoluciones', badge: 'bg-amber-500/15 text-amber-800 border-amber-500/30' },
  Manual: { label: 'Devolución manual', group: 'devoluciones', badge: 'bg-error/10 text-error border-error/20' },
}

const receiptType = (comprobante) => {
  const annulled = comprobante.estado === 'Anulado'
  if (comprobante.es_ingreso) return annulled ? 'IngresoAnulado' : 'IngresoVigente'
  return annulled ? 'CuotaAnulada' : 'CuotaVigente'
}

const receiptDetail = (comprobante, refunded) => {
  if (comprobante.estado === 'Anulado') {
    return comprobante.motivo_anulacion ? `Anulado: ${comprobante.motivo_anulacion}` : 'Anulado'
  }
  return refunded > 0 ? `Devuelto con notas de crédito: ${formatAmount(refunded)}` : `Pago #${comprobante.pago}`
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
        typeLabel: TYPES[type].label,
        badgeLabel: TYPES[type].badgeLabel ?? TYPES[type].label,
        badgeClass: TYPES[type].badge,
        date: comprobante.fecha_emision,
        sortDate: `${comprobante.fecha_emision || ''}-R${String(comprobante.numero).padStart(8, '0')}`,
        sortNumber: comprobante.numero,
        socio: comprobante.socio,
        socioLabel: socioName(comprobante.socio),
        concept: comprobante.es_ingreso ? comprobante.concepto : 'Cobro de cuotas',
        subConcept: receiptDetail(comprobante, refunded),
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
      typeLabel: TYPES[devolucion.tipo]?.label ?? devolucion.tipo_nombre,
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
        item.typeLabel,
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
      <div className="p-5 pb-4 border-b border-outline-variant/20 flex flex-col gap-4">
        <div>
          <h2 id="comprobantes-title" className="text-xl font-bold text-on-surface">
            Movimientos y comprobantes de caja
          </h2>
          <p className="text-sm text-on-surface-variant">
            {SCOPES.find((option) => option.value === scope).description}
          </p>
        </div>

        <SegmentedControl
          label="Seleccionar tipo de registros de caja"
          options={SCOPES}
          value={scope}
          onChange={changeScope}
          className="self-start"
        />

        <div className="flex flex-wrap items-center gap-4">
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
          <button
            type="button"
            onClick={() => downloadCashMovementsCsv(sorted)}
            disabled={isLoading || Boolean(error) || sorted.length === 0}
            title="Exportar movimientos filtrados"
            aria-label="Exportar movimientos filtrados"
            className="inline-flex items-center justify-center h-10 w-10 shrink-0 p-2 border border-outline-variant rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">receipt_long</span>
          </button>
        </div>
      </div>

      <DataTable
        tableClassName="min-w-[820px]"
        headerCase="title"
        headers={(
          <>
            <SortableHeader className={HEADER_CLASS} etiqueta="Referencia" columna="number" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Fecha" columna="date" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Socio" columna="socio" orden={sort} onOrdenar={sortAndReset} />
            <th className={HEADER_CLASS} scope="col">Concepto y Comprobante</th>
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
