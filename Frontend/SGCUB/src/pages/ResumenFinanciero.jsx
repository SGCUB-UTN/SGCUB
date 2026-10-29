import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { downloadFinancialSummaryPdf } from '../api/resumenFinanciero'
import PeriodSelector from '../components/cuota/PeriodSelector'
import { formatCount, formatMoney, formatPercentage, formatWholeMoney, isValidPeriod } from '../components/cuota/cuotaPeriod'
import ComprobanteDetailModal from '../components/finanzas/ComprobanteDetailModal'
import { formatDate, getErrorMessage } from '../components/personas/format'
import CollectionEvolutionChart from '../components/resumen/CollectionEvolutionChart'
import IncomeOriginChart from '../components/resumen/IncomeOriginChart'
import DataTable from '../components/shared/DataTable'
import { KpiColumn, KpiGrid } from '../components/shared/Kpi'
import PageHeader from '../components/shared/PageHeader'
import SectionHeading from '../components/shared/SectionHeading'
import { currentPeriod, formatPeriod } from '../components/shared/periodFormat'
import useResumenFinanciero from '../hooks/useResumenFinanciero'

const PANEL_CLASS = 'min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm overflow-hidden'
const BODY_CLASS = 'px-4 sm:px-5 py-4'
const HEADING_CLASS = 'px-4 sm:px-5 border-b'
const EXPORT_BUTTON_CLASS = 'inline-flex items-center gap-2 h-10 px-4 border border-outline-variant/50 rounded text-sm font-semibold text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
const TOGGLE_BUTTON_CLASS = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent'

const socioLabel = (socio) => `${socio.apellido}, ${socio.nombre}`

function SectionDivider({ children }) {
  return (
    <div className="flex items-center gap-3 pt-2" role="presentation">
      <span className="text-xs font-bold uppercase tracking-widest text-outline whitespace-nowrap">{children}</span>
      <span className="h-px flex-1 bg-outline-variant/40" />
    </div>
  )
}

function TotalLabel({ amount, negative = false }) {
  return (
    <span className="text-sm text-on-surface-variant">
      Total:{' '}
      <strong className={`text-base tabular-nums ${negative && Number(amount) > 0 ? 'text-error' : 'text-on-surface'}`}>
        {negative && Number(amount) > 0 ? '−' : ''}{formatMoney(amount)}
      </strong>
    </span>
  )
}

function ToggleButton({ expanded, count, controls, onToggle }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={controls} disabled={!count} className={TOGGLE_BUTTON_CLASS}>
      {expanded ? 'Ocultar' : `Desplegar (${count})`}
      <span className={`material-symbols-outlined text-[18px] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
    </button>
  )
}

function EffectivenessKpi({ rate }) {
  const value = rate == null ? null : Number(rate)
  return (
    <div className="min-w-0 h-full flex flex-col">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Efectividad</h3>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-tight text-on-surface">{value == null ? '—' : formatPercentage(value)}</p>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
        aria-label="Efectividad de la cobranza"
        className="mt-auto pt-2"
      >
        <div className="h-2 rounded bg-primary-fixed overflow-hidden">
          <div className="h-full rounded bg-primary" style={{ width: `${Math.min(value ?? 0, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

function CuotaKpis({ cuotas }) {
  const debt = Number(cuotas.en_deuda)
  const surcharges = Number(cuotas.recargos)
  return (
    <div className="flex flex-col">
      <KpiGrid columns={3} className="pb-5">
        <KpiColumn label="Facturado esperado" value={formatWholeMoney(cuotas.esperado)} title={formatMoney(cuotas.esperado)} caption="Lo que debía ingresar" />
        <KpiColumn label="Cobranza real" value={formatWholeMoney(cuotas.cobrado)} title={formatMoney(cuotas.cobrado)} tone="text-emerald-700" caption="Lo que se cobró" />
        <KpiColumn label="En deuda" value={formatWholeMoney(debt)} title={formatMoney(debt)} tone={debt > 0 ? 'text-error' : 'text-on-surface'} caption="Falta cobrar" />
      </KpiGrid>
      <KpiGrid columns={3} className="pt-5 border-t border-outline-variant/40">
        <EffectivenessKpi rate={cuotas.efectividad} />
        <KpiColumn label="Volumen" value={`${formatCount(cuotas.pagas)} / ${formatCount(cuotas.generadas)}`} caption="Cuotas pagas / generadas" />
        <KpiColumn label="Recargos" value={formatWholeMoney(surcharges)} title={formatMoney(surcharges)} tone={surcharges > 0 ? 'text-error' : 'text-on-surface'} caption="Aplicados por mora" />
      </KpiGrid>
    </div>
  )
}

function PaymentMethodRows({ methods }) {
  if (!methods.medios.length) {
    return <p className="text-sm text-on-surface-variant">No hay medios de pago configurados.</p>
  }
  return (
    <ul className="flex flex-col gap-3">
      {methods.medios.map((method) => (
        <li key={method.codigo} className="grid grid-cols-[minmax(0,8rem)_1fr] sm:grid-cols-[10rem_1fr_auto] items-center gap-x-4 gap-y-1">
          <span className="text-sm font-semibold text-on-surface truncate" title={method.nombre}>{method.nombre}</span>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(method.porcentaje)}
            aria-label={`${method.nombre}: ${formatPercentage(method.porcentaje)} de lo ingresado`}
            className="h-3 rounded bg-surface-container-high overflow-hidden"
          >
            <div className="h-full rounded bg-primary" style={{ width: `${Number(method.porcentaje)}%` }} />
          </div>
          <span className="col-span-2 sm:col-span-1 text-sm text-right tabular-nums text-on-surface-variant whitespace-nowrap">
            <strong className="text-on-surface">{formatPercentage(method.porcentaje)}</strong> · {formatMoney(method.monto)}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ExtraIncomeTable({ movements, onOpen }) {
  return (
    <DataTable
      tableClassName="min-w-[680px]"
      headers={(
        <>
          <th className="py-2.5 px-4" scope="col">Comprobante</th>
          <th className="py-2.5 px-4" scope="col">Fecha</th>
          <th className="py-2.5 px-4" scope="col">Socio</th>
          <th className="py-2.5 px-4" scope="col">Concepto</th>
          <th className="py-2.5 px-4 text-right" scope="col">Monto</th>
        </>
      )}
    >
      {movements.map((movement) => (
        <tr
          key={movement.comprobante_id}
          tabIndex={0}
          role="button"
          onClick={() => onOpen(movement.comprobante_id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onOpen(movement.comprobante_id)
            }
          }}
          className="hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none transition-colors cursor-pointer"
        >
          <td className="py-2.5 px-4 font-semibold text-primary whitespace-nowrap">{movement.codigo}</td>
          <td className="py-2.5 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(movement.fecha)}</td>
          <td className="py-2.5 px-4 text-on-surface">{socioLabel(movement.socio)}</td>
          <td className="py-2.5 px-4 text-on-surface">{movement.concepto}</td>
          <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-emerald-700 whitespace-nowrap">+ {formatMoney(movement.monto)}</td>
        </tr>
      ))}
    </DataTable>
  )
}

function RefundsTable({ movements }) {
  return (
    <DataTable
      tableClassName="min-w-[760px]"
      headers={(
        <>
          <th className="py-2.5 px-4" scope="col">Comprobante</th>
          <th className="py-2.5 px-4" scope="col">Fecha</th>
          <th className="py-2.5 px-4" scope="col">Socio</th>
          <th className="py-2.5 px-4" scope="col">Concepto</th>
          <th className="py-2.5 px-4" scope="col">Medio</th>
          <th className="py-2.5 px-4 text-right" scope="col">Monto</th>
        </>
      )}
    >
      {movements.map((movement) => (
        <tr key={movement.devolucion_id}>
          <td className="py-2.5 px-4 whitespace-nowrap">
            <span className="block font-semibold text-on-surface">{movement.codigo}</span>
            <span className="block text-xs text-on-surface-variant">{movement.tipo_nombre}</span>
          </td>
          <td className="py-2.5 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(movement.fecha)}</td>
          <td className="py-2.5 px-4 text-on-surface">{socioLabel(movement.socio)}</td>
          <td className="py-2.5 px-4 text-on-surface">
            {movement.concepto}
            {movement.comprobante_anulado && <span className="block text-xs text-on-surface-variant">Sobre {movement.comprobante_anulado}</span>}
          </td>
          <td className="py-2.5 px-4 text-on-surface-variant whitespace-nowrap">{movement.medio_de_pago}</td>
          <td className="py-2.5 px-4 text-right font-semibold tabular-nums text-error whitespace-nowrap">− {formatMoney(movement.monto)}</td>
        </tr>
      ))}
    </DataTable>
  )
}

function LoadingPanel() {
  return (
    <div className={`${PANEL_CLASS} ${BODY_CLASS} flex items-center gap-2 text-on-surface-variant`} role="status">
      <span className="material-symbols-outlined animate-spin text-[20px]" aria-hidden="true">progress_activity</span>
      Cargando resumen financiero...
    </div>
  )
}

function ResumenFinanciero() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPeriod = searchParams.get('periodo')
  const period = isValidPeriod(requestedPeriod) ? requestedPeriod : currentPeriod()
  const { data, isLoading, error, reload } = useResumenFinanciero(period)
  const [expanded, setExpanded] = useState({ incomes: false, refunds: false })
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [comprobanteId, setComprobanteId] = useState(null)

  const changePeriod = (value) => setSearchParams({ periodo: value })
  const toggle = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }))

  const handleExport = async () => {
    setIsExporting(true)
    setExportError('')
    try {
      await downloadFinancialSummaryPdf(period)
    } catch (err) {
      setExportError(getErrorMessage(err, 'No se pudo generar el informe PDF.'))
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Resumen financiero' }]}
        title="Resumen financiero"
        actions={(
          <div className="flex flex-wrap items-center gap-2.5">
            <PeriodSelector value={period} onChange={changePeriod} />
            <button type="button" disabled={isLoading || isExporting} onClick={handleExport} className={EXPORT_BUTTON_CLASS}>
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{isExporting ? 'hourglass_top' : 'download'}</span>
              {isExporting ? 'Generando...' : 'Exportar informe'}
            </button>
          </div>
        )}
      />

      {exportError && <p className="text-sm text-error" role="alert">{exportError}</p>}

      <SectionDivider>Resumen mensual · {formatPeriod(period)}</SectionDivider>

      {isLoading && <LoadingPanel />}
      {error && (
        <p className={`${PANEL_CLASS} ${BODY_CLASS} text-error`} role="alert">
          {getErrorMessage(error, 'No se pudo cargar el resumen financiero.')}
        </p>
      )}

      {data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-[fit-content(40%)_1fr] gap-5">
            <section className={PANEL_CLASS} aria-labelledby="income-origin-title">
              <SectionHeading id="income-origin-title" icon="donut_large" title="Origen de los ingresos" className={HEADING_CLASS} />
              <div className={BODY_CLASS}>
                <IncomeOriginChart income={data.ingresos} />
              </div>
            </section>

            <section className={PANEL_CLASS} aria-labelledby="cuota-kpis-title">
              <SectionHeading id="cuota-kpis-title" icon="monitoring" title={`Análisis de cuotas de ${formatPeriod(period)}`} className={HEADING_CLASS} />
              <div className={BODY_CLASS}>
                <CuotaKpis cuotas={data.cuotas} />
              </div>
            </section>
          </div>

          <section className={PANEL_CLASS} aria-labelledby="extra-income-title">
            <SectionHeading
              id="extra-income-title"
              icon="point_of_sale"
              title="Movimientos de ingresos extra (no incluye cuotas)"
              className={expanded.incomes ? HEADING_CLASS : 'px-4 sm:px-5'}
              actions={(
                <>
                  <TotalLabel amount={data.ingresos_extra.total} />
                  <ToggleButton expanded={expanded.incomes} count={data.ingresos_extra.movimientos.length} controls="extra-income-list" onToggle={() => toggle('incomes')} />
                </>
              )}
            />
            {expanded.incomes && (
              <div id="extra-income-list">
                <ExtraIncomeTable movements={data.ingresos_extra.movimientos} onOpen={setComprobanteId} />
              </div>
            )}
          </section>

          <section className={PANEL_CLASS} aria-labelledby="payment-methods-title">
            <SectionHeading
              id="payment-methods-title"
              icon="credit_card"
              title="Análisis de ingresos por medio de pago"
              className={HEADING_CLASS}
              actions={<TotalLabel amount={data.medios_de_pago.total} />}
            />
            <div className={BODY_CLASS}>
              <PaymentMethodRows methods={data.medios_de_pago} />
            </div>
          </section>

          <section className={PANEL_CLASS} aria-labelledby="refunds-title">
            <SectionHeading
              id="refunds-title"
              icon="currency_exchange"
              title="Devoluciones y ajustes"
              className={expanded.refunds ? HEADING_CLASS : 'px-4 sm:px-5'}
              actions={(
                <>
                  <TotalLabel amount={data.devoluciones.total} negative />
                  <ToggleButton expanded={expanded.refunds} count={data.devoluciones.movimientos.length} controls="refunds-list" onToggle={() => toggle('refunds')} />
                </>
              )}
            />
            {expanded.refunds && (
              <div id="refunds-list">
                <RefundsTable movements={data.devoluciones.movimientos} />
                <p className="px-4 sm:px-5 py-3 border-t border-outline-variant/30 text-sm text-on-surface-variant">
                  Las devoluciones no restan de los ingresos: el dinero devuelto nunca se registró como ingreso o salió de un comprobante anulado.
                </p>
              </div>
            )}
          </section>

          <SectionDivider>Contexto histórico</SectionDivider>

          <section className={PANEL_CLASS} aria-labelledby="evolution-title">
            <SectionHeading id="evolution-title" icon="trending_up" title="Evolución anual de cobranza (cuotas)" className={HEADING_CLASS} />
            <div className={BODY_CLASS}>
              <CollectionEvolutionChart evolution={data.evolucion} />
            </div>
          </section>
        </div>
      )}

      <ComprobanteDetailModal
        comprobanteId={comprobanteId}
        opened={Boolean(comprobanteId)}
        onClose={() => setComprobanteId(null)}
        onChanged={reload}
      />
    </div>
  )
}

export default ResumenFinanciero
