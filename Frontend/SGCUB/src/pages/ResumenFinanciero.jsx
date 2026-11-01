import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { downloadFinancialSummaryPdf } from '../api/resumenFinanciero'
import PeriodSelector from '../components/cuota/PeriodSelector'
import { formatCount, formatMoney, formatPercentage, formatWholeMoney, isValidPeriod } from '../components/cuota/cuotaPeriod'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../components/shared/chartMotion'
import useEntered from '../hooks/useEntered'
import { getErrorMessage } from '../components/personas/format'
import CollectionEvolutionChart from '../components/resumen/CollectionEvolutionChart'
import IncomeOriginChart from '../components/resumen/IncomeOriginChart'
import { KpiColumn, KpiGrid } from '../components/shared/Kpi'
import PageHeader from '../components/shared/PageHeader'
import SectionDivider from '../components/shared/SectionDivider'
import SectionHeading from '../components/shared/SectionHeading'
import { PANEL_BODY_CLASS as BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS as HEADING_CLASS } from '../components/shared/panel'
import { currentPeriod, formatPeriod } from '../components/shared/periodFormat'
import useResumenFinanciero from '../hooks/useResumenFinanciero'

const EXPORT_BUTTON_CLASS = 'inline-flex items-center gap-2 h-10 px-4 border border-outline-variant/50 rounded text-sm font-semibold text-on-surface bg-surface-container-lowest hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer'
const TOGGLE_BUTTON_CLASS = 'inline-flex items-center justify-center w-8 h-8 rounded-md text-primary hover:bg-primary/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

function TotalLabel({ amount }) {
  return (
    <span className="text-sm text-on-surface-variant">
      Total: <strong className="text-base tabular-nums text-on-surface">{formatMoney(amount)}</strong>
    </span>
  )
}

function ToggleButton({ expanded, controls, label }) {
  const action = `${expanded ? 'Ocultar' : 'Desplegar'} ${label}`
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={action}
      title={action}
      className={TOGGLE_BUTTON_CLASS}
    >
      <span className={`material-symbols-outlined transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 22 }} aria-hidden="true">expand_more</span>
    </button>
  )
}

function CollapsibleSection({ id, icon, title, total, label, expanded, isEmpty, emptyText, onToggle, children }) {
  const contentId = `${id}-content`
  return (
    <section className={PANEL_CLASS} aria-labelledby={`${id}-title`}>
      <div onClick={onToggle}>
        <SectionHeading
          id={`${id}-title`}
          icon={icon}
          title={title}
          className={`${expanded ? HEADING_CLASS : 'px-4 sm:px-5'} cursor-pointer transition-colors hover:bg-surface-container`}
          actions={(
            <>
              <TotalLabel amount={total} />
              <ToggleButton expanded={expanded} controls={contentId} label={label} />
            </>
          )}
        />
      </div>
      {expanded && (
        <div id={contentId}>
          {isEmpty ? <p className="px-4 sm:px-5 py-4 text-sm text-on-surface-variant">{emptyText}</p> : children}
        </div>
      )}
    </section>
  )
}

function EffectivenessKpi({ rate }) {
  const entered = useEntered()
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
          <div className={`h-full rounded bg-primary ${WIDTH_MOTION}`} style={{ width: grown(entered, `${Math.min(value ?? 0, 100)}%`) }} />
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
  const entered = useEntered()
  if (!methods.medios.length) {
    return <p className="text-sm text-on-surface-variant">No hay medios de pago configurados.</p>
  }
  return (
    <ul className="flex flex-col gap-1">
      {methods.medios.map((method) => (
        <li key={method.codigo} className={`grid grid-cols-[minmax(0,8rem)_1fr] sm:grid-cols-[10rem_1fr_auto] items-center gap-x-4 gap-y-1 ${ROW_HOVER}`}>
          <span className="text-sm font-semibold text-on-surface truncate" title={method.nombre}>{method.nombre}</span>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(method.porcentaje)}
            aria-label={`${method.nombre}: ${formatPercentage(method.porcentaje)} de lo ingresado`}
            className="h-3 rounded bg-surface-container-high overflow-hidden"
          >
            <div className={`h-full rounded bg-primary ${WIDTH_MOTION}`} style={{ width: grown(entered, `${Number(method.porcentaje)}%`) }} />
          </div>
          <span className="col-span-2 sm:col-span-1 text-sm text-right tabular-nums text-on-surface-variant whitespace-nowrap">
            <strong className="text-on-surface">{formatPercentage(method.porcentaje)}</strong> · {formatMoney(method.monto)}
          </span>
        </li>
      ))}
    </ul>
  )
}

const BREAKDOWN_CELL_Y = 'py-2.5'
const BREAKDOWN_CELL_X = 'px-4 sm:px-5'

function BreakdownRow({ label, porcentaje, monto, variant = 'row' }) {
  const strong = variant === 'total'
  const nested = variant === 'nested'
  const labelTone = strong ? 'font-bold text-on-surface' : nested ? 'font-normal text-on-surface-variant' : 'font-semibold text-on-surface'
  return (
    <tr className={strong ? 'bg-surface-container-low' : 'border-t border-outline-variant/30'}>
      <th scope="row" className={`${BREAKDOWN_CELL_Y} pr-4 sm:pr-5 ${nested ? 'pl-10 sm:pl-11' : 'pl-4 sm:pl-5'} text-left ${labelTone}`}>
        {label}
      </th>
      <td className={`${BREAKDOWN_CELL_Y} ${BREAKDOWN_CELL_X} w-28 text-right tabular-nums ${strong ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}>
        {formatPercentage(porcentaje)}
      </td>
      <td className={`${BREAKDOWN_CELL_Y} ${BREAKDOWN_CELL_X} w-44 text-right tabular-nums text-on-surface whitespace-nowrap ${strong ? 'font-bold' : nested ? '' : 'font-semibold'}`}>
        {formatMoney(monto)}
      </td>
    </tr>
  )
}

function BreakdownTable({ label, total, rows }) {
  return (
    <table className="w-full text-sm">
      <thead className="sr-only">
        <tr>
          <th scope="col">Tipo</th>
          <th scope="col">Porcentaje</th>
          <th scope="col">Monto</th>
        </tr>
      </thead>
      <tbody>
        <BreakdownRow label={label} porcentaje={100} monto={total} variant="total" />
        {rows.map(({ key, ...row }) => <BreakdownRow key={key} {...row} />)}
      </tbody>
    </table>
  )
}

const conceptRows = (concepts, variant, prefix = '') => concepts.map((concept) => ({
  key: `${prefix}${concept.nombre}`,
  label: concept.nombre,
  porcentaje: concept.porcentaje,
  monto: concept.monto,
  variant,
}))

const refundRows = (refunds) => [
  { key: 'notas-credito', label: 'Notas de crédito', porcentaje: refunds.notas_credito.porcentaje, monto: refunds.notas_credito.monto },
  { key: 'manuales', label: 'Devoluciones manuales', porcentaje: refunds.manuales.porcentaje, monto: refunds.manuales.monto },
  ...conceptRows(refunds.manuales.conceptos, 'nested', 'manual-'),
]

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
  const { data, isLoading, error } = useResumenFinanciero(period)
  const [expanded, setExpanded] = useState({ incomes: false, refunds: false })
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState('')

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
          <button type="button" disabled={isLoading || isExporting} onClick={handleExport} className={EXPORT_BUTTON_CLASS}>
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{isExporting ? 'hourglass_top' : 'download'}</span>
            {isExporting ? 'Generando...' : 'Exportar informe'}
          </button>
        )}
      />

      {exportError && <p className="text-sm text-error" role="alert">{exportError}</p>}

      <SectionDivider actions={<PeriodSelector value={period} onChange={changePeriod} />}>
        Resumen mensual
      </SectionDivider>

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

          <CollapsibleSection
            id="extra-income"
            icon="point_of_sale"
            title="Otros ingresos"
            total={data.ingresos_extra.total}
            label="otros ingresos"
            expanded={expanded.incomes}
            isEmpty={data.ingresos_extra.conceptos.length === 0}
            emptyText="No hubo otros ingresos en el período."
            onToggle={() => toggle('incomes')}
          >
            <BreakdownTable
              label="Otros ingresos"
              total={data.ingresos_extra.total}
              rows={conceptRows(data.ingresos_extra.conceptos, 'row')}
            />
          </CollapsibleSection>

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

          <CollapsibleSection
            id="refunds"
            icon="currency_exchange"
            title="Devoluciones"
            total={data.devoluciones.total}
            label="devoluciones"
            expanded={expanded.refunds}
            isEmpty={Number(data.devoluciones.total) === 0}
            emptyText="No hubo devoluciones en el período."
            onToggle={() => toggle('refunds')}
          >
            <BreakdownTable label="Devoluciones" total={data.devoluciones.total} rows={refundRows(data.devoluciones)} />
            <p className="px-4 sm:px-5 py-3 border-t border-outline-variant/30 text-sm text-on-surface-variant">
              Las devoluciones no restan de los ingresos: el dinero devuelto nunca se registró como ingreso o salió de un comprobante anulado.
            </p>
          </CollapsibleSection>

          <SectionDivider>Contexto histórico</SectionDivider>

          <section className={PANEL_CLASS} aria-labelledby="evolution-title">
            <SectionHeading id="evolution-title" icon="trending_up" title="Evolución anual de cobranza (cuotas)" className={HEADING_CLASS} />
            <div className={BODY_CLASS}>
              <CollectionEvolutionChart evolution={data.evolucion} />
            </div>
          </section>
        </div>
      )}

    </div>
  )
}

export default ResumenFinanciero
