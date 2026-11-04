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
import { PANEL_CLASS, PANEL_HEADING_CLASS } from '../shared/panel'
import { formatPeriod } from '../shared/periodFormat'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { matchesSearch } from '../shared/search'
import { downloadCashMovementsCsv } from './cashMovementsCsv'
import { conceptGroup } from './conceptOrigins'
import { descargarComprobantePdf } from '../../api/comprobantes'
import { buildWhatsAppMessage, openWhatsAppChat } from '../../utils/whatsapp'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const HEADER_CLASS = 'py-3 px-4'
const CELL_CLASS = 'py-3 px-4'
const BADGE_CLASS = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap'
const ICON_BUTTON_CLASS = 'inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
const EXPORT_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-sm font-semibold transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const WHATSAPP_ICON_BUTTON_CLASS = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60'
const WHATSAPP_DISABLED_BUTTON_CLASS = 'inline-flex items-center justify-center w-9 h-9 rounded-lg border border-outline-variant/30 text-on-surface-variant/30 cursor-not-allowed'
const COLUMN_COUNT = 6
const ALL = 'todos'
const TABS_ID = 'comprobantes-scope'

const SCOPES = [
  {
    value: 'todos',
    label: 'Todos los movimientos',
  },
  {
    value: 'cuotas',
    label: 'Cobro de cuotas',
  },
  {
    value: 'ingresos',
    label: 'Otros ingresos',
  },
  {
    value: 'devoluciones',
    label: 'Devoluciones',
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

const ACTIVE = 'activo'
const INACTIVE = 'inactivo'
const STATUS_OPTIONS = [{ value: ACTIVE, label: 'Activo' }, { value: INACTIVE, label: 'Inactivo' }]

const SCOPE_FILTERS = {
  todos: { label: 'Estado', field: 'status', options: STATUS_OPTIONS },
  cuotas: { label: 'Estado', field: 'status', options: [{ value: ACTIVE, label: 'Activo' }, { value: INACTIVE, label: 'Anulado' }] },
  ingresos: { label: 'Estado', field: 'status', options: STATUS_OPTIONS, conceptLabel: 'Concepto' },
  devoluciones: {
    label: 'Tipo',
    field: 'filterCode',
    options: [{ value: 'NotaCredito', label: TYPES.NotaCredito.label }, { value: 'Manual', label: TYPES.Manual.label }],
    conceptLabel: 'Motivo',
  },
}

const groupFields = (concept) => {
  const group = conceptGroup(concept)
  return { conceptGroup: group, conceptKey: group.toLocaleLowerCase('es') }
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
}) {
  const [scope, setScope] = useState('todos')
  const [search, setSearch] = useState('')
  const [mainFilter, setMainFilter] = useState(ALL)
  const [conceptFilter, setConceptFilter] = useState(ALL)
  const filters = SCOPE_FILTERS[scope]

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
        paymentMethod: comprobante.medios_de_pago || '—',
        amount: Number(comprobante.monto_total ?? 0),
        isPositive: true,
        isAnulado: comprobante.estado === 'Anulado',
        status: comprobante.estado === 'Anulado' ? INACTIVE : ACTIVE,
        ...(comprobante.es_ingreso ? groupFields(comprobante.concepto) : {}),
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
      status: ACTIVE,
      ...groupFields(devolucion.concepto),
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

  const conceptOptions = useMemo(() => {
    if (!filters.conceptLabel) return []
    const groups = new Map()
    unifiedItems.forEach((item) => {
      if (item.conceptKey && TYPES[item.filterCode]?.group === scope && !groups.has(item.conceptKey)) {
        groups.set(item.conceptKey, item.conceptGroup)
      }
    })
    return [...groups]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [unifiedItems, scope, filters])

  const filtered = useMemo(() => {
    const text = search.trim()
    const textDigits = text.replace(/[.#]/g, '')
    return unifiedItems.filter((item) => {
      if (scope !== 'todos' && TYPES[item.filterCode]?.group !== scope) return false
      if (mainFilter !== ALL && item[filters.field] !== mainFilter) return false
      if (conceptFilter !== ALL && item.conceptKey !== conceptFilter) return false
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
  }, [unifiedItems, scope, filters, mainFilter, conceptFilter, search])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const changeScope = (nextScope) => {
    withPageReset(() => {
      setScope(nextScope)
      setMainFilter(ALL)
      setConceptFilter(ALL)
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

  const handleSendWhatsApp = (event, item) => {
    event.stopPropagation()
    const socio = item.socio
    const phone = socio?.telefono
    if (!phone) return

    if (item.raw?.comprobante_id) {
      descargarComprobantePdf(item.raw.comprobante_id).catch(() => {})
    }
    let tipo = 'comprobante'
    if (item.isAnulado) {
      tipo = 'anulado'
    } else if (item.kind === 'devolucion') {
      tipo = item.filterCode === 'NotaCredito' ? 'nota_credito' : 'devolucion'
    }
    const message = buildWhatsAppMessage({
      socio,
      comprobanteCodigo: item.refCode,
      montoTotal: item.amount,
      tipo,
    })
    openWhatsAppChat({ phone, message })
  }

  return (
    <section className={PANEL_CLASS} aria-labelledby="comprobantes-title">
      <SectionHeading
        id="comprobantes-title"
        icon="receipt_long"
        title="Movimientos y comprobantes de caja"
        className={PANEL_HEADING_CLASS}
      />

      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Comprobante, socio, DNI o concepto"
            label="Filtrar movimientos y comprobantes"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={mainFilter}
            onChange={(event) => withPageReset(setMainFilter)(event.target.value)}
            aria-label={`Filtrar por ${filters.label.toLowerCase()}`}
          >
            <option value={ALL}>{filters.label}: Todos</option>
            {filters.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FilterSelect>
          {filters.conceptLabel && (
            <FilterSelect
              className={FILTER_CLASS}
              value={conceptFilter}
              onChange={(event) => withPageReset(setConceptFilter)(event.target.value)}
              aria-label={`Filtrar por ${filters.conceptLabel.toLowerCase()}`}
            >
              <option value={ALL}>{filters.conceptLabel}: Todos</option>
              {conceptOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </FilterSelect>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 xl:shrink-0">
          <button
            type="button"
            onClick={() => downloadCashMovementsCsv(sorted, period, scope)}
            disabled={isLoading || Boolean(error) || sorted.length === 0}
            title="Exporta los movimientos que se ven con la búsqueda y los filtros actuales"
            className={EXPORT_BUTTON_CLASS}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">file_download</span>
            Exportar listado
          </button>
        </div>
      </div>

      <TableTabs
        id={TABS_ID}
        label="Tipo de registros de caja"
        options={scopeOptions}
        value={scope}
        onChange={changeScope}
      />

      <div id={tabPanelId(TABS_ID)} role="tabpanel" aria-labelledby={tabId(TABS_ID, scope)}>
        <DataTable
          tableClassName="min-w-[820px]"
          headers={(
            <>
              <SortableHeader className={`${HEADER_CLASS} sm:pl-5`} etiqueta="Comprobante" columna="number" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Fecha" columna="date" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Socio" columna="socio" orden={sort} onOrdenar={sortAndReset} />
              <th className={HEADER_CLASS} scope="col">Concepto</th>
              <SortableHeader className={HEADER_CLASS} etiqueta="Monto" columna="amount" orden={sort} onOrdenar={sortAndReset} />
              <th className={`${HEADER_CLASS} sm:pr-5 text-right`} scope="col">Acciones</th>
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
              className="hover:bg-surface-container-low/80 focus:bg-surface-container-low focus:outline-none transition-colors cursor-pointer"
            >
              <td className={`${CELL_CLASS} sm:pl-5 whitespace-nowrap`}>
                <span className="block font-semibold text-primary">{item.refCode}</span>
                <span className={`${BADGE_CLASS} mt-1 ${item.badgeClass}`}>
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
              <td className={`${CELL_CLASS} sm:pr-5 text-right`}>
                <div className="flex items-center justify-end gap-1.5">
                  {item.kind === 'comprobante' && !item.isAnulado && (
                    <button
                      type="button"
                      onClick={(event) => handleSendWhatsApp(event, item)}
                      disabled={!item.socio?.telefono}
                      title={
                        item.socio?.telefono
                          ? item.socio.es_menor && item.socio.responsable_nombre
                            ? `Enviar comprobante por WhatsApp a ${item.socio.responsable_nombre} (Responsable de ${item.socioLabel}) (${item.socio.telefono})`
                            : `Enviar comprobante por WhatsApp (${item.socio.telefono})`
                          : 'Socio sin teléfono registrado'
                      }
                      aria-label={`Enviar comprobante ${item.refCode} por WhatsApp`}
                      className={item.socio?.telefono ? WHATSAPP_ICON_BUTTON_CLASS : WHATSAPP_DISABLED_BUTTON_CLASS}
                    >
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                      </svg>
                    </button>
                  )}
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
                </div>
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
