import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SectionHeading from '../shared/SectionHeading'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import TableTabs from '../shared/TableTabs'
import { tabId, tabPanelId } from '../shared/tabIds'
import { PANEL_CLASS } from '../shared/panel'
import { formatPeriod } from '../shared/periodFormat'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { matchesSearch } from '../shared/search'
import { downloadCashMovementsCsv } from './cashMovementsCsv'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const HEADER_CLASS = 'py-2.5 px-4'
const CELL_CLASS = 'py-2.5 px-4'
const ICON_BUTTON_CLASS = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer'
const COLUMN_COUNT = 6
const ALL = 'todos'
const TABS_ID = 'comprobantes-scope'

const SCOPES = [
  {
    value: 'todos',
    label: 'Todos los movimientos',
    description: 'Comprobantes de cuotas, otros ingresos y devoluciones.',
  },
  {
    value: 'Cobro de cuotas',
    label: 'Cobro de cuotas',
    description: 'Cobros de cuotas de socios.',
  },
  {
    value: 'ingresos',
    label: 'Otros ingresos',
    description: 'Ingresos ajenos a cuotas.',
  },
  {
    value: 'devoluciones',
    label: 'Devoluciones',
    description: 'Notas de crédito y devoluciones manuales.',
  },
]

const ANNULLED_BADGE = 'bg-error-container text-on-error-container border-error/20'

const TYPES = {
  CuotaVigente: { label: 'Cobro de cuotas', group: 'cuotas', badge: 'bg-primary/10 text-primary border-primary/20' },
  CuotaAnulada: { label: 'Cobro de cuotas anulado', badgeLabel: 'Anulado', group: 'cuotas', badge: ANNULLED_BADGE },
  IngresoVigente: { label: 'Ingreso', group: 'ingresos', badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  IngresoAnulado: { label: 'Ingreso anulado', badgeLabel: 'Anulado', group: 'ingresos', badge: ANNULLED_BADGE },
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
  period,
  comprobantes = [],
  devoluciones = [],
  isLoading,
  error,
  onSelect,
  onSelectDevolucion,
  onRegisterPayment,
  onRegisterMovement,
}) {
  const [scope, setScope] = useState('todos')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(ALL)

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

  const scopeOptions = useMemo(() => {
    if (isLoading || error) return SCOPES
    return SCOPES.map((option) => ({
      ...option,
      count: unifiedItems.filter((item) => option.value === 'todos' || TYPES[item.filterCode]?.group === option.value).length,
    }))
  }, [unifiedItems, isLoading, error])

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
  }, [unifiedItems, scope, typeFilter, search])

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
    <section className={PANEL_CLASS} aria-labelledby="comprobantes-title">
      <SectionHeading
        id="comprobantes-title"
        icon="receipt_long"
        title="Movimientos y comprobantes de caja"
        className="px-4 sm:px-5"
      />

      <TableTabs
        id={TABS_ID}
        label="Tipo de registros de caja"
        options={scopeOptions}
        value={scope}
        onChange={changeScope}
      />

      <div id={tabPanelId(TABS_ID)} role="tabpanel" aria-labelledby={tabId(TABS_ID, scope)}>
        <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/30 flex flex-col gap-3">
          <p className="text-sm text-on-surface-variant">
            {SCOPES.find((option) => option.value === scope).description}
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <TableSearchInput
              value={search}
              onChange={withPageReset(setSearch)}
              placeholder="Buscar por comprobante, socio, DNI o concepto..."
              label="Filtrar movimientos y comprobantes"
            />
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
              onClick={() => downloadCashMovementsCsv(sorted, period)}
              disabled={isLoading || Boolean(error) || sorted.length === 0}
              title="Exportar movimientos filtrados"
              aria-label="Exportar movimientos filtrados"
              className="inline-flex items-center justify-center h-10 w-10 shrink-0 p-2 border border-outline-variant rounded-md text-on-surface-variant hover:text-primary hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">download</span>
            </button>
            <div className="flex flex-wrap items-center gap-2.5 ml-auto">
              {(scope === 'todos' || scope === 'cuotas') && (
                <PrimaryButton icon="payments" onClick={onRegisterPayment}>
                  Registrar pago
                </PrimaryButton>
              )}
              {scope !== 'cuotas' && (
                <SecondaryButton icon="currency_exchange" onClick={onRegisterMovement}>
                  Ingreso o devolución
                </SecondaryButton>
              )}
            </div>
          </div>
        </div>

        <DataTable
          tableClassName="min-w-[820px]"
          headerCase="title"
          headers={(
            <>
              <SortableHeader className={HEADER_CLASS} etiqueta="Comprobante" columna="number" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Fecha" columna="date" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Socio" columna="socio" orden={sort} onOrdenar={sortAndReset} />
              <th className={HEADER_CLASS} scope="col">Concepto</th>
              <SortableHeader className={HEADER_CLASS} etiqueta="Monto" columna="amount" orden={sort} onOrdenar={sortAndReset} />
              <th className={`${HEADER_CLASS} text-center`} scope="col">Acciones</th>
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
                ? `No hay movimientos ni comprobantes registrados en ${formatPeriod(period)}.`
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
              <td className={`${CELL_CLASS} whitespace-nowrap`}>
                <span className="block font-semibold text-primary">{item.refCode}</span>
                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${item.badgeClass}`}>
                  {item.badgeLabel}
                </span>
              </td>
              <td className={`${CELL_CLASS} text-on-surface-variant whitespace-nowrap`}>{formatDate(item.date)}</td>
              <td className={CELL_CLASS}>
                {item.socio ? (
                  <>
                    <span className="block text-on-surface">{item.socioLabel}</span>
                    <span className="block text-xs text-on-surface-variant">DNI {formatDni(item.socio.dni)}</span>
                  </>
                ) : (
                  <span className="text-on-surface-variant">—</span>
                )}
              </td>
              <td className={`${CELL_CLASS} max-w-xs`}>
                <span className="block text-on-surface truncate" title={item.concept}>
                  {item.concept}
                </span>
                <span className="block text-xs text-on-surface-variant truncate" title={item.subConcept}>
                  {item.subConcept}
                </span>
              </td>
              <td
                className={`${CELL_CLASS} font-semibold tabular-nums whitespace-nowrap ${
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
              <td className={`${CELL_CLASS} text-center`}>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    handleRowAction(item)
                  }}
                  onKeyDown={(event) => event.stopPropagation()}
                  title="Ver detalle"
                  aria-label={`Ver ${item.kind === 'comprobante' ? 'comprobante' : 'devolución'} ${item.refCode}`}
                  className={ICON_BUTTON_CLASS}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
                </button>
              </td>
            </tr>
          ))}
        </DataTable>

        <TablePagination id="comprobantes-rows-per-page" {...paginationProps} />
      </div>
    </section>
  )
}

export default ComprobantesTable
