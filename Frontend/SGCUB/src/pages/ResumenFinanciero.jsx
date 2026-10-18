import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { downloadFinancialSummaryPdf } from '../api/resumenFinanciero'
import { formatAmount, formatDni, getErrorMessage } from '../components/personas/format'
import DataTable from '../components/shared/DataTable'
import PageHeader from '../components/shared/PageHeader'
import TableMessageRow from '../components/shared/TableMessageRow'
import TablePagination from '../components/shared/TablePagination'
import TableSearchInput from '../components/shared/TableSearchInput'
import useResumenFinanciero from '../hooks/useResumenFinanciero'
import usePagination from '../hooks/usePagination'
import useOrdenTabla from '../hooks/useOrdenTabla'
import StatCard from '../components/shared/StatCard'
import SortableHeader from '../components/shared/SortableHeader'
import { overdueBreakdown } from '../components/finanzas/cuotaStates'

const SORT_VALUES = {
  numero: (row) => (row.numero_socio ? Number(row.numero_socio) : null),
  nombre: (row) => `${row.apellido ?? ''} ${row.nombre ?? ''}`.trim(),
  vencidas: (row) => Number(row.cuotasVencidas ?? 0),
}
const INITIAL_SORT = { columna: 'numero', direccion: 'desc' }

const financialTabPath = (row) => (row.jugador_id
  ? `/padron/jugadores/${row.jugador_id}?tab=financiero`
  : `/padron/socios/${row.socio_id}?tab=financiero`)

function StatCardSkeleton() {
  return (
    <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4 flex items-center justify-between gap-3 shadow-xs animate-pulse min-h-[82px]">
      <div className="flex flex-col min-w-0 flex-1">
        <div className="h-3.5 w-1/2 bg-surface-container-high rounded mb-1.5"></div>
        <div className="h-6 w-3/4 bg-surface-container-high rounded"></div>
      </div>
      <div className="w-10 h-10 rounded-full bg-surface-container-high shrink-0"></div>
    </div>
  )
}

function CollectionCard({ label, amount, detail, icon, dotClass }) {
  return (
    <div className="bg-surface-container-lowest p-space-md rounded-xl border border-outline-variant/30 flex items-start justify-between shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
          <span className="font-label-sm text-label-sm text-outline uppercase font-semibold tracking-wide truncate">{label}</span>
        </div>
        <span className="font-headline-sm text-headline-sm font-bold text-on-surface tracking-tight">
          {amount != null ? formatAmount(amount) : '—'}
        </span>
        <p className="font-body-sm text-body-sm text-on-surface-variant">{detail}</p>
      </div>
      <div className="w-9 h-9 rounded-lg bg-surface-container-low text-primary flex items-center justify-center shrink-0 ml-3">
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
      </div>
    </div>
  )
}

const COLLECTION_METHODS = [
  { key: 'transferencia_bancaria', label: 'Transferencia bancaria', icon: 'account_balance', dotClass: 'bg-primary', detail: 'Recaudado · acumulado histórico' },
  { key: 'billetera_virtual', label: 'Billetera virtual', icon: 'wallet', dotClass: 'bg-secondary-container', detail: 'Recaudado · acumulado histórico' },
  { key: 'pago_efectivo', label: 'Pago en efectivo', icon: 'payments', dotClass: 'bg-tertiary', detail: 'Recaudado · acumulado histórico' },
]

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'

function SummaryBlock({ id, title, subtitle, icon, controls, children }) {
  return (
    <section className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden" aria-labelledby={id}>
      <div className="p-5 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 id={id} className="text-2xl font-bold text-on-surface">{title}</h2>
          <p className="text-base text-on-surface-variant">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {controls}
          {icon && <span className="material-symbols-outlined text-primary text-2xl" aria-hidden="true">{icon}</span>}
        </div>
      </div>
      <div className="p-5 flex flex-col gap-space-md">
        {children}
      </div>
    </section>
  )
}

// Debtor status filter options
const DEBT_FILTERS = [
  { value: 'all', label: 'Todos los estados' },
  { value: 'en_fecha', label: 'Solo deuda en fecha' },
  { value: 'vencida', label: 'Solo deuda vencida' },
  { value: 'ambas', label: 'Deuda en fecha y vencida' },
]

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function ResumenFinanciero() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [debtFilter, setDebtFilter] = useState('all')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

  const {
    isLoading,
    errors,
    resumen,
    selectedPeriod,
    setSelectedPeriod,
    availablePeriods,
    selectedPeriodLabel,
    periodKpis,
    debtorRows,
  } = useResumenFinanciero()

  // Apply search + debt-type filter
  const filteredRows = useMemo(() => {
    let rows = debtorRows

    if (debtFilter === 'en_fecha') rows = rows.filter((r) => r.deudaEnFecha > 0)
    else if (debtFilter === 'vencida') rows = rows.filter((r) => r.deudaVencida > 0)
    else if (debtFilter === 'ambas') rows = rows.filter((r) => r.deudaEnFecha > 0 && r.deudaVencida > 0)

    const query = search.trim().toLocaleLowerCase()
    if (!query) return rows
    return rows.filter((r) =>
      `${r.nombre} ${r.apellido} ${r.dni} ${r.numero_socio}`.toLocaleLowerCase().includes(query),
    )
  }, [debtorRows, search, debtFilter])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filteredRows, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const handleExport = async () => {
    setIsExporting(true)
    setExportError('')
    try {
      await downloadFinancialSummaryPdf(selectedPeriod)
    } catch (err) {
      setExportError(getErrorMessage(err, 'No se pudo generar el informe PDF.'))
    } finally {
      setIsExporting(false)
    }
  }

  const dataError = errors.cuotas || errors.resumen

  return (
    <div className="w-full flex flex-col gap-5 pb-8">

      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Resumen financiero' }]}
        title="Balance de cuotas y deuda de socios"
        actions={(
          <>
            <button
              type="button"
              disabled={isLoading || isExporting}
              onClick={handleExport}
              className="inline-flex items-center gap-2 h-10 px-4 border border-outline-variant/50 rounded-lg text-on-surface bg-surface-container-low hover:bg-surface-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">
                {isExporting ? 'hourglass_top' : 'download'}
              </span>
              {isExporting ? 'Generando...' : 'Exportar informe contable'}
              {!isExporting && selectedPeriod && (
                <span className="text-on-surface-variant font-normal">· {selectedPeriodLabel}</span>
              )}
            </button>
          </>
        )}
      />

      {exportError && (
        <p className="text-sm text-error" role="alert">{exportError}</p>
      )}

      <SummaryBlock
        id="period-block-title"
        title="Resumen del período"
        subtitle="Métricas de las cuotas del período seleccionado."
        controls={(
          <label className="flex items-center gap-2 font-medium text-sm text-on-surface-variant">
            Período:
            <input
              type="month"
              aria-label="Seleccionar período"
              className={`${FILTER_CLASS} h-9 px-3 font-normal`}
              value={selectedPeriod ?? ''}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              disabled={isLoading}
            />
          </label>
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-space-md">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard size="sm" tone="neutral" icon="receipt_long" label="Cuotas generadas" value={periodKpis.cuotasGeneradas} />
              <StatCard size="sm" tone="positive" icon="check_circle" label="Cuotas pagas" value={periodKpis.cuotasPagas} />
              <StatCard size="sm" tone="warning" icon="pending" label="Cuotas sin pagar" value={periodKpis.cuotasImpagas} />
              <StatCard size="sm" tone="neutral" icon="payments" label="Total recaudado" value={formatAmount(periodKpis.totalRecaudadoPeriodo)} />
            </>
          )}
        </div>
      </SummaryBlock>

      <SummaryBlock
        id="general-block-title"
        title="Situación general"
        subtitle="Información historica · no depende del período seleccionado."
        icon="monitoring"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-space-md">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <StatCardSkeleton key={i} />)
          ) : (
            <>
              <StatCard size="sm" tone="warning" icon="person_alert" label="Socios con deuda" value={Number(resumen?.socios_en_mora ?? 0).toLocaleString('es-AR')} />
              <StatCard size="sm" tone="warning" icon="pending_actions" label="Monto adeudado total" value={formatAmount(resumen?.monto_adeudado_total ?? 0)} />
              <StatCard
                size="sm"
                tone="neutral"
                icon="event_busy"
                label="Cuotas vencidas a la fecha"
                value={Number(resumen?.cuotas_vencidas ?? 0).toLocaleString('es-AR')}
                caption={overdueBreakdown(resumen?.cuotas_vencidas_1, resumen?.cuotas_vencidas_2)}
              />
            </>
          )}
        </div>
        {errors.resumen && <p className="text-sm text-error" role="alert">{getErrorMessage(errors.resumen, 'No se pudieron cargar las métricas financieras.')}</p>}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-space-md">
          {COLLECTION_METHODS.map((method) => (
            <CollectionCard
              key={method.key}
              label={method.label}
              amount={resumen ? resumen[method.key] : null}
              detail={method.detail}
              icon={method.icon}
              dotClass={method.dotClass}
            />
          ))}
        </div>
      </SummaryBlock>

      <section
        aria-labelledby="debtors-table-title"
        className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm overflow-hidden min-w-0"
      >
        <div className="flex flex-wrap items-end justify-between gap-space-sm border-b border-outline-variant/30 px-4 py-4">
          <div className="flex flex-wrap items-end gap-space-sm flex-1">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="font-label-sm text-label-sm text-outline uppercase font-semibold">
                Estado de deuda
              </label>
              <div className="relative">
                <select
                  value={debtFilter}
                  onChange={(e) => withPageReset(() => setDebtFilter(e.target.value))()}
                  className="w-full h-10 pl-3 pr-8 bg-surface-container-low text-on-surface rounded-lg font-body-sm text-body-sm appearance-none focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  {DEBT_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2.5 top-2.5 text-on-surface-variant pointer-events-none text-[18px]" aria-hidden="true">expand_more</span>
              </div>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
              <label className="font-label-sm text-label-sm text-outline uppercase font-semibold">
                Búsqueda rápida
              </label>
              <TableSearchInput
                value={search}
                onChange={withPageReset(setSearch)}
                placeholder="Filtrar por nombre, DNI o N° de socio..."
                label="Filtrar socios por nombre, DNI o número de socio"
              />
            </div>
          </div>

        </div>

        <DataTable
          className="min-w-full"
          tableClassName="min-w-[780px]"
          bodyClassName="text-base"
          headers={(
            <>
              <SortableHeader className="py-3 px-4 w-28 whitespace-nowrap" etiqueta="N° Socio" columna="numero" orden={sort} onOrdenar={sortAndReset} />
              <SortableHeader className="py-3 px-4" etiqueta="Nombre y Apellido" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
              <th className="py-3 px-4" scope="col">DNI</th>
              <th className="py-3 px-4 text-right" scope="col">Deuda en fecha</th>
              <th className="py-3 px-4 text-right" scope="col">Deuda vencida</th>
              <SortableHeader className="py-3 px-4 text-center" etiqueta="Cuotas vencidas" columna="vencidas" orden={sort} onOrdenar={sortAndReset} />
            </>
          )}
        >
          <TableMessageRow
            colSpan={6}
            isLoading={isLoading}
            isEmpty={visibleRows.length === 0}
            error={dataError}
            loadingText="Cargando resumen financiero..."
            errorText={dataError ? getErrorMessage(dataError, 'No se pudieron cargar los datos financieros.') : ''}
            emptyText="No hay socios con deuda que coincidan con los filtros aplicados."
          />

          {!isLoading && !dataError && visibleRows.map((row) => {
            const hasVencida = row.deudaVencida > 0
            return (
              <tr
                key={row.socio_id}
                tabIndex={0}
                aria-label={`Ver estado de cuenta de ${row.nombre} ${row.apellido}`}
                onClick={() => navigate(financialTabPath(row))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(financialTabPath(row))
                  }
                }}
                className="hover:bg-surface-container-low/80 transition-colors cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <td className="py-3 px-4 font-bold text-primary text-base pl-6">
                  {row.numero_socio ? `#${row.numero_socio}` : '—'}
                </td>

                <td className="py-3 px-4">
                  <span className="font-medium text-on-surface block text-base">
                    {row.nombre} {row.apellido}
                  </span>
                </td>

                <td className="py-3 px-4 text-on-surface-variant">{formatDni(row.dni)}</td>

                <td className="py-3 px-4 text-right">
                  {row.deudaEnFecha > 0 ? (
                    <span className="font-semibold text-on-surface">{formatAmount(row.deudaEnFecha)}</span>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </td>

                <td className="py-3 px-4 text-right">
                  {row.deudaVencida > 0 ? (
                    <span className={`font-mono font-bold ${hasVencida ? 'text-error' : 'text-on-surface'}`}>
                      {formatAmount(row.deudaVencida)}
                    </span>
                  ) : (
                    <span className="text-on-surface-variant">—</span>
                  )}
                </td>

                <td className="py-3 px-4 text-center">
                  {row.cuotasVencidas > 0 ? (
                    <span className="inline-flex flex-col items-center gap-0.5">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded font-label-sm text-label-sm font-bold bg-error-container text-on-error-container">
                        {row.cuotasVencidas} cuota{row.cuotasVencidas !== 1 ? 's' : ''}
                      </span>
                      <span className="text-xs text-on-surface-variant">{overdueBreakdown(row.cuotasVencidas1, row.cuotasVencidas2)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded font-label-sm text-label-sm bg-surface-container text-on-surface-variant">
                      —
                    </span>
                  )}
                </td>
              </tr>
            )
          })}
        </DataTable>

        <TablePagination id="resumen-financiero-rows-per-page" {...paginationProps} />
      </section>
    </div>
  )
}

export default ResumenFinanciero
