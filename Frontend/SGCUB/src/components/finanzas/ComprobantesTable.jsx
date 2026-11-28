import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FILTER_CLASS, FILTER_WIDTH, SEARCH_WIDTH, filterLabel } from '../shared/listFilters'
import ClearFiltersButton from '../shared/ClearFiltersButton'
import DataTable from '../shared/DataTable'
import ExportMenu from '../shared/ExportMenu'
import FilterSelect from '../shared/FilterSelect'
import RowIconButton, { RowIcon } from '../shared/RowIconButton'
import { ROW_LINK_CLASS, stopRowClick } from '../shared/rowLink'
import SectionHeading from '../shared/SectionHeading'
import SortableHeader from '../shared/SortableHeader'
import StatusBadge from '../shared/StatusBadge'
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
import { CASH_EXPORT_COLUMNS, cashExportFilename } from './cashMovementsExport'
import { KIND_BADGES } from './movementBadges'
import { INCOME, MANUAL_REFUND, conceptGroup, isOtherConcept } from './conceptOrigins'
import useConceptosMovimiento from '../../hooks/useConceptosMovimiento'
import { descargarComprobantePdf } from '../../api/comprobantes'
import { descargarDevolucionPdf } from '../../api/devoluciones'
import { WhatsAppIcon } from './WhatsAppComprobanteButton'
import { CANCELLED_REFUND_BLOCKER, REFUND_CANCELLED, isCancelledRefund } from './refunds'
import { cancellationSummary } from './cancellations'
import useToast from '../../hooks/useToast'
import { sendReceiptToWhatsApp } from '../../utils/whatsapp'

const HEADER_CLASS = 'py-3 px-4'
const CELL_CLASS = 'py-3 px-4'
const COLUMN_COUNT = 6
const ALL = 'todos'
const PARAMS = { scope: 'tipo', search: 'buscar', filter: 'filtro', concept: 'concepto' }
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

const TYPES = {
  CuotaVigente: { label: 'Cobro de cuotas', kind: 'Cobro de cuotas', group: 'cuotas' },
  CuotaAnulada: { label: 'Cobro de cuotas anulado', kind: 'Cobro de cuotas', group: 'cuotas', badge: KIND_BADGES.Anulado },
  IngresoVigente: { label: 'Ingreso', kind: 'Ingreso', group: 'ingresos' },
  IngresoAnulado: { label: 'Ingreso anulado', kind: 'Ingreso', group: 'ingresos', badge: KIND_BADGES.Anulado },
  NotaCredito: { label: 'Nota de crédito', kind: 'Devolución', group: 'devoluciones', badge: KIND_BADGES.NotaCredito },
  Manual: { label: 'Devolución manual', kind: 'Devolución', group: 'devoluciones', badge: KIND_BADGES.Manual },
}

const ACTIVE = 'vigente'
const INACTIVE = 'anulado'
const RECEIPT_STATUS_OPTIONS = [{ value: ACTIVE, label: 'Vigente' }, { value: INACTIVE, label: 'Anulado' }]
const ALL_STATUS_OPTIONS = [{ value: ACTIVE, label: 'Vigente' }, { value: INACTIVE, label: 'Anulado o cancelado' }]

const SCOPE_FILTERS = {
  todos: { label: 'Estado', field: 'status', options: ALL_STATUS_OPTIONS },
  cuotas: { label: 'Estado', field: 'status', options: RECEIPT_STATUS_OPTIONS },
  ingresos: { label: 'Estado', field: 'status', options: RECEIPT_STATUS_OPTIONS, conceptLabel: 'Concepto', conceptOrigin: INCOME },
  devoluciones: {
    label: 'Tipo',
    field: 'refundFilter',
    options: [
      { value: 'NotaCredito', label: TYPES.NotaCredito.label },
      { value: 'Manual', label: TYPES.Manual.label },
      { value: REFUND_CANCELLED, label: 'Cancelada' },
    ],
    conceptLabel: 'Motivo',
    conceptOrigin: MANUAL_REFUND,
  },
}

const groupFields = (concept) => ({ conceptKey: conceptGroup(concept).toLocaleLowerCase('es') })

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

const refundDetail = (devolucion) => {
  if (isCancelledRefund(devolucion)) {
    return cancellationSummary({
      action: 'Cancelada',
      date: devolucion.fecha_cancelacion,
      authorizedBy: devolucion.cancelado_por,
      reason: devolucion.motivo_cancelacion,
    })
  }
  return devolucion.comprobante_anulado_codigo
    ? `Sobre el comprobante anulado ${devolucion.comprobante_anulado_codigo} · Responsable: ${devolucion.responsable}`
    : `Responsable: ${devolucion.responsable}`
}

const shortDate = (date) => formatDate(date).slice(0, 5)

const amountTone = (item) => {
  if (item.isAnulado) return 'text-outline line-through'
  return item.isPositive ? 'text-emerald-700' : 'text-error'
}

const socioName = (socio) => (socio ? `${socio.apellido ?? ''}, ${socio.nombre ?? ''}`.replace(/^, |, $/g, '') : '')

const SORT_VALUES = {
  number: (item) => Number(item.sortNumber ?? 0),
  date: (item) => item.sortTimestamp ?? 0,
  socio: (item) => item.socioLabel || null,
  amount: (item) => Number(item.amount ?? 0),
}

const INITIAL_SORT = { columna: 'date', direccion: 'desc' }

function ComprobantesTable({
  period,
  comprobantes = [],
  devoluciones = [],
  isLoading,
  onSelect,
  onSelectDevolucion,
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedScope = searchParams.get(PARAMS.scope)
  const scope = SCOPES.some((option) => option.value === requestedScope) ? requestedScope : ALL
  const filters = SCOPE_FILTERS[scope]
  const search = searchParams.get(PARAMS.search) ?? ''
  const requestedFilter = searchParams.get(PARAMS.filter)
  const mainFilter = filters.options.some((option) => option.value === requestedFilter) ? requestedFilter : ALL
  const requestedConcept = searchParams.get(PARAMS.concept) ?? ALL
  const [downloadingKey, setDownloadingKey] = useState(null)
  const [sharingWhatsAppKey, setSharingWhatsAppKey] = useState(null)
  const { showToast } = useToast()
  const { concepts: configuredConcepts } = useConceptosMovimiento()

  const updateParams = (changes) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === ALL) next.delete(key)
      else next.set(key, value)
    })
    return next
  }, { replace: true })

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
        kindLabel: TYPES[type].kind,
        badge: TYPES[type].badge,
        date: comprobante.fecha_emision,
        sortTimestamp: Date.parse(comprobante.fecha_hora || comprobante.fecha_emision || '') || 0,
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

    const refundItems = devoluciones.map((devolucion) => {
      const cancelled = isCancelledRefund(devolucion)
      const type = TYPES[devolucion.tipo] ?? TYPES.Manual
      const typeLabel = TYPES[devolucion.tipo]?.label ?? devolucion.tipo_nombre
      return {
        key: `devolucion-${devolucion.devolucion_id}`,
        kind: 'devolucion',
        raw: devolucion,
        filterCode: devolucion.tipo,
        refundFilter: cancelled ? REFUND_CANCELLED : devolucion.tipo,
        refCode: devolucion.codigo,
        typeLabel: cancelled ? `${typeLabel} cancelada` : typeLabel,
        kindLabel: type.kind,
        badge: cancelled ? KIND_BADGES.Cancelada : type.badge,
        date: devolucion.fecha,
        sortTimestamp: Date.parse(devolucion.fecha || '') || 0,
        sortNumber: devolucion.numero,
        socio: devolucion.socio,
        socioLabel: socioName(devolucion.socio),
        concept: devolucion.concepto,
        subConcept: refundDetail(devolucion),
        paymentMethod: devolucion.medio_de_pago_nombre,
        amount: Number(devolucion.monto ?? 0),
        isPositive: false,
        isAnulado: cancelled,
        isCancelledRefund: cancelled,
        status: cancelled ? INACTIVE : ACTIVE,
        ...groupFields(devolucion.concepto),
      }
    })

    return [...receiptItems, ...refundItems]
  }, [comprobantes, devoluciones])

  const scopeOptions = useMemo(() => {
    if (isLoading) return SCOPES
    return SCOPES.map((option) => ({
      ...option,
      count: unifiedItems.filter((item) => option.value === 'todos' || TYPES[item.filterCode]?.group === option.value).length,
    }))
  }, [unifiedItems, isLoading])

  const conceptOptions = useMemo(() => {
    if (!filters.conceptOrigin) return []
    return configuredConcepts
      .filter((concept) => concept.origen === filters.conceptOrigin)
      .sort((a, b) => (isOtherConcept(a.nombre) - isOtherConcept(b.nombre)) || a.nombre.localeCompare(b.nombre, 'es'))
      .map((concept) => ({ value: concept.nombre.toLocaleLowerCase('es'), label: concept.nombre }))
  }, [configuredConcepts, filters])
  const conceptFilter = conceptOptions.some((option) => option.value === requestedConcept) ? requestedConcept : ALL

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
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)
  const hasFilters = search.trim() !== '' || mainFilter !== ALL || conceptFilter !== ALL
  const clearFilters = () => {
    updateParams({ [PARAMS.search]: '', [PARAMS.filter]: ALL, [PARAMS.concept]: ALL })
    resetPage()
  }
  const setSearch = (value) => updateParams({ [PARAMS.search]: value })
  const setMainFilter = (value) => updateParams({ [PARAMS.filter]: value })
  const setConceptFilter = (value) => updateParams({ [PARAMS.concept]: value })
  const exportFilters = [
    `Período: ${formatPeriod(period)}`,
    SCOPES.find((option) => option.value === scope)?.label,
    filterLabel(filters.options, mainFilter, filters.label),
    filters.conceptLabel && filterLabel(conceptOptions, conceptFilter, filters.conceptLabel),
    search.trim() && `Búsqueda: «${search.trim()}»`,
  ]

  const changeScope = (nextScope) => {
    withPageReset(() => updateParams({ [PARAMS.scope]: nextScope, [PARAMS.filter]: ALL, [PARAMS.concept]: ALL }))()
  }

  const handleRowAction = (item) => {
    if (item.kind === 'comprobante') {
      onSelect?.(item.raw)
    } else {
      onSelectDevolucion?.(item.raw)
    }
  }

  const whatsAppBlocker = (item) => {
    if (item.isCancelledRefund) return CANCELLED_REFUND_BLOCKER
    return item.socio?.telefono ? '' : 'El socio no tiene un teléfono registrado'
  }

  const whatsAppLabel = (item) => {
    const socio = item.socio
    if (!socio?.telefono) return `Enviar ${item.refCode} por WhatsApp`
    const recipient = socio.es_menor && socio.responsable_nombre
      ? `${socio.responsable_nombre}, responsable de ${item.socioLabel}`
      : item.socioLabel
    return `Enviar ${item.refCode} por WhatsApp a ${recipient} (${socio.telefono})`
  }

  const handleSendWhatsApp = async (item) => {
    const socio = item.socio
    const phone = socio?.telefono
    if (!phone || sharingWhatsAppKey) return

    setSharingWhatsAppKey(item.key)
    try {
      let tipo = 'comprobante'
      if (item.isAnulado) {
        tipo = 'anulado'
      } else if (item.kind === 'devolucion') {
        tipo = item.filterCode === 'NotaCredito' ? 'nota_credito' : 'devolucion'
      }
      await sendReceiptToWhatsApp({
        socio,
        phone,
        comprobanteId: item.raw?.comprobante_id,
        devolucionId: item.raw?.devolucion_id,
        comprobanteCodigo: item.refCode,
        montoTotal: item.amount,
        tipo,
        onToast: showToast,
      })
    } finally {
      setSharingWhatsAppKey(null)
    }
  }

  const handleDownload = async (item) => {
    if (downloadingKey) return
    setDownloadingKey(item.key)
    try {
      if (item.kind === 'comprobante') {
        await descargarComprobantePdf(item.raw.comprobante_id)
      } else {
        await descargarDevolucionPdf(item.raw.devolucion_id)
      }
    } catch {
      showToast({ tone: 'error', title: 'No se pudo descargar el PDF', description: `${item.refCode}: probá de nuevo en unos minutos.` })
    } finally {
      setDownloadingKey(null)
    }
  }

  return (
    <section className={PANEL_CLASS} aria-labelledby="comprobantes-title">
      <SectionHeading
        id="comprobantes-title"
        icon="receipt_long"
        title={`Movimientos de ${formatPeriod(period)}`}
        className={PANEL_HEADING_CLASS}
      />

      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Comprobante, socio, DNI o concepto"
            label="Filtrar movimientos y comprobantes"
            className={SEARCH_WIDTH}
          />
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
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
              width={FILTER_WIDTH}
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
          <ClearFiltersButton onClick={clearFilters} visible={hasFilters} />
        </div>
        <ExportMenu
          title={`Movimientos de caja de ${formatPeriod(period)}`}
          filename={cashExportFilename(scope, period)}
          columns={CASH_EXPORT_COLUMNS}
          items={isLoading ? [] : sorted}
          filters={exportFilters}
        />
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
          tableClassName="sm:min-w-[820px]"
          headers={(
            <>
              <SortableHeader className={`${HEADER_CLASS} sm:pl-5 max-sm:hidden`} etiqueta="Comprobante" columna="number" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={`${HEADER_CLASS} max-sm:hidden`} etiqueta="Fecha" columna="date" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className={HEADER_CLASS} etiqueta="Socio" columna="socio" orden={sort} onOrdenar={sortAndReset} />
              <th className={`${HEADER_CLASS} max-sm:hidden`} scope="col">Concepto</th>
              <SortableHeader className={`${HEADER_CLASS} max-sm:text-right`} etiqueta="Monto" columna="amount" orden={sort} onOrdenar={sortAndReset} />
              <th className={`${HEADER_CLASS} sm:pr-5 text-right max-sm:hidden`} scope="col">Acciones</th>
            </>
          )}
        >
          <TableMessageRow
            colSpan={COLUMN_COUNT}
            isLoading={isLoading}
            isEmpty={visibleRows.length === 0}
            loadingText="Cargando movimientos y comprobantes..."
            emptyText={
              unifiedItems.length === 0
                ? `No hay movimientos ni comprobantes registrados en ${formatPeriod(period)}.`
                : 'Ningún movimiento coincide con la búsqueda o los filtros.'
            }
            onClearFilters={hasFilters ? clearFilters : undefined}
          />

          {!isLoading && visibleRows.map((item) => (
            <tr
              key={item.key}
              onClick={() => handleRowAction(item)}
              className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
            >
              <td className={`${CELL_CLASS} sm:pl-5 whitespace-nowrap max-sm:hidden`}>
                <button
                  type="button"
                  onClick={(event) => {
                    stopRowClick(event)
                    handleRowAction(item)
                  }}
                  aria-haspopup="dialog"
                  aria-label={`Ver ${item.typeLabel.toLocaleLowerCase('es')} ${item.refCode}`}
                  className={`block font-semibold text-base text-primary cursor-pointer ${ROW_LINK_CLASS}`}
                >
                  {item.refCode}
                </button>
                <span className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-on-surface-variant">{item.kindLabel}</span>
                  {item.badge && <StatusBadge size="md" badge={item.badge} />}
                </span>
              </td>
              <td className={`${CELL_CLASS} text-on-surface-variant whitespace-nowrap max-sm:hidden`}>{formatDate(item.date)}</td>
              <td className={`${CELL_CLASS} max-sm:pl-4`}>
                {item.socio ? (
                  <>
                    <span className="block text-on-surface">{item.socioLabel}</span>
                    <div className="max-sm:hidden text-sm text-on-surface-variant">DNI {formatDni(item.socio.dni)}</div>
                  </>
                ) : (
                  <span className="block text-on-surface-variant">—</span>
                )}
                <div className="sm:hidden mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="min-w-0 break-words text-sm text-on-surface-variant">{item.concept} · {shortDate(item.date)}</span>
                  {item.badge && <StatusBadge size="md" badge={item.badge} />}
                </div>
              </td>
              <td className={`${CELL_CLASS} max-w-xs max-sm:hidden`}>
                <span className="block text-on-surface truncate" title={item.concept}>
                  {item.concept}
                </span>
                <span className="block text-sm text-on-surface-variant truncate" title={item.subConcept}>
                  {item.subConcept}
                </span>
              </td>
              <td className={`${CELL_CLASS} whitespace-nowrap max-sm:align-top max-sm:text-right max-sm:pr-4`}>
                <span className={`font-semibold tabular-nums ${amountTone(item)}`}>
                  {item.isAnulado ? '' : item.isPositive ? '+ ' : '− '}
                  {formatAmount(item.amount)}
                </span>
                <div className="sm:hidden mt-0.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      stopRowClick(event)
                      handleRowAction(item)
                    }}
                    aria-haspopup="dialog"
                    aria-label={`Ver ${item.typeLabel.toLocaleLowerCase('es')} ${item.refCode}`}
                    className={`text-sm text-primary cursor-pointer ${ROW_LINK_CLASS}`}
                  >
                    {item.refCode}
                  </button>
                </div>
              </td>
              <td className="py-2 px-4 sm:pr-5 text-right max-sm:hidden">
                <div className="flex items-center justify-end gap-1.5">
                  <RowIconButton
                    tone="whatsapp"
                    label={whatsAppLabel(item)}
                    disabledReason={whatsAppBlocker(item)}
                    busy={sharingWhatsAppKey === item.key}
                    onClick={() => handleSendWhatsApp(item)}
                  >
                    <WhatsAppIcon className="w-[18px] h-[18px]" />
                  </RowIconButton>
                  <RowIconButton
                    tone="neutral"
                    label={`Descargar PDF de ${item.refCode}`}
                    disabledReason={item.isCancelledRefund ? CANCELLED_REFUND_BLOCKER : ''}
                    busy={downloadingKey === item.key}
                    onClick={() => handleDownload(item)}
                  >
                    <RowIcon name="download" />
                  </RowIconButton>
                  <RowIconButton
                    tone="neutral"
                    label={`Ver ${item.typeLabel.toLocaleLowerCase('es')} ${item.refCode}`}
                    onClick={() => handleRowAction(item)}
                  >
                    <RowIcon name="receipt_long" />
                  </RowIconButton>
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
