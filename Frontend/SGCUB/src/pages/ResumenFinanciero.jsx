import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { downloadFinancialSummaryPdf } from '../api/resumenFinanciero'
import PeriodSelector from '../components/cuota/PeriodSelector'
import { formatCount, formatMoney, formatPercentage, formatWholeMoney, isValidPeriod } from '../components/cuota/cuotaPeriod'
import { ROW_HOVER, WIDTH_MOTION, grown } from '../components/shared/chartMotion'
import { HeadingSkeleton, LineSkeletons, RingSkeleton, SkeletonBlock, SkeletonStatus } from '../components/shared/Skeleton'
import useEntered from '../hooks/useEntered'
import { getErrorMessage } from '../components/personas/format'
import CollectionEvolutionChart, { CollectionEvolutionTable } from '../components/resumen/CollectionEvolutionChart'
import SegmentedControl from '../components/shared/SegmentedControl'
import IncomeOriginChart from '../components/resumen/IncomeOriginChart'
import { KpiColumn, KpiGrid } from '../components/shared/Kpi'
import PageHeader from '../components/shared/PageHeader'
import SectionDivider from '../components/shared/SectionDivider'
import SectionHeading from '../components/shared/SectionHeading'
import StackedBar from '../components/shared/StackedBar'
import { colorSeries, segmentKeyOf, stackSegments } from '../components/shared/stackedBarSeries'
import { PANEL_BODY_CLASS as BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS as HEADING_CLASS } from '../components/shared/panel'
import { TEXT_BUTTON_CLASS } from '../components/shared/textButton'
import { currentPeriod, formatPeriod } from '../components/shared/periodFormat'
import useResumenFinanciero from '../hooks/useResumenFinanciero'
import useToast from '../hooks/useToast'
import { SecondaryButton } from '../components/personas/tabs/parts'
import LoadErrorBanner from '../components/shared/LoadErrorBanner'


function TotalLabel({ amount }) {
  return (
    <span className="text-base text-on-surface-variant">
      Total: <strong className="tabular-nums text-on-surface">{formatMoney(amount)}</strong>
    </span>
  )
}

function CollapsibleSection({ id, icon, title, total, expanded, isEmpty, emptyText, onToggle, children }) {
  const contentId = `${id}-content`
  return (
    <section className={PANEL_CLASS} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="m-0">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggle}
          className={`w-full min-h-14 flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-3 bg-surface-container-low text-left cursor-pointer transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ${expanded ? 'border-b border-outline-variant/30' : ''}`}
        >
          <span className="flex min-w-0 items-center gap-2 text-base font-semibold text-on-surface">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 22 }} aria-hidden="true">{icon}</span>
            {title}
          </span>
          <span className="flex items-center gap-3 shrink-0">
            <TotalLabel amount={total} />
            <span className={`material-symbols-outlined text-primary transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 24 }} aria-hidden="true">expand_more</span>
          </span>
        </button>
      </h2>
      {expanded && (
        <div id={contentId}>
          {isEmpty ? <p className="px-4 sm:px-5 py-4 text-base text-on-surface-variant">{emptyText}</p> : children}
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
      <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">% cobrado</h3>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-tight text-on-surface">{value == null ? '—' : formatPercentage(value)}</p>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? 0}
        aria-label="Porcentaje cobrado de las cuotas del período"
        className="mt-auto pt-2"
      >
        <div className="h-2 rounded bg-surface-container-high overflow-hidden">
          <div className={`h-full rounded bg-emerald-600 ${WIDTH_MOTION}`} style={{ width: grown(entered, `${Math.min(value ?? 0, 100)}%`) }} />
        </div>
      </div>
    </div>
  )
}

function BasisNote({ children }) {
  return <p className="px-4 sm:px-5 py-3 border-t border-outline-variant/30 text-base text-on-surface-variant">{children}</p>
}

function CuotaKpis({ cuotas }) {
  const debt = Number(cuotas.en_deuda)
  const surcharges = Number(cuotas.recargos)
  return (
    <div className="flex flex-col">
      <KpiGrid columns={3} className="pb-5">
        <KpiColumn label="Total a cobrar" value={formatWholeMoney(cuotas.esperado)} title={formatMoney(cuotas.esperado)} caption="Cuotas más recargos" />
        <KpiColumn label="Cobrado" value={formatWholeMoney(cuotas.cobrado)} title={formatMoney(cuotas.cobrado)} tone="text-emerald-700" caption="Hasta hoy" />
        <KpiColumn label="Pendiente" value={formatWholeMoney(debt)} title={formatMoney(debt)} tone={debt > 0 ? 'text-error' : 'text-on-surface'} caption="Falta cobrar" />
      </KpiGrid>
      <KpiGrid columns={3} className="pt-5 border-t border-outline-variant/40">
        <EffectivenessKpi rate={cuotas.efectividad} />
        <KpiColumn label="Cuotas pagas" value={`${formatCount(cuotas.pagas)} de ${formatCount(cuotas.generadas)}`} caption="Emitidas en el período" />
        <KpiColumn label="Recargos por mora" value={formatWholeMoney(surcharges)} title={formatMoney(surcharges)} caption="Aplicados en el período" />
      </KpiGrid>
    </div>
  )
}

function PaymentMethodRows({ methods }) {
  const entered = useEntered()
  if (!methods.medios.length) {
    return <p className="text-base text-on-surface-variant">No hay medios de pago configurados.</p>
  }
  return (
    <ul className="flex flex-col gap-1">
      {methods.medios.map((method) => (
        <li key={method.codigo} className={`grid grid-cols-[minmax(0,8rem)_1fr] sm:grid-cols-[10rem_1fr_auto] items-center gap-x-4 gap-y-1 ${ROW_HOVER}`}>
          <span className="text-base font-semibold text-on-surface truncate" title={method.nombre}>{method.nombre}</span>
          <div
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Number(method.porcentaje)}
            aria-label={`${method.nombre}: ${formatPercentage(method.porcentaje)} de lo ingresado`}
            className="h-3 rounded bg-surface-container-high overflow-hidden"
          >
            <div className={`h-full rounded bg-emerald-600 ${WIDTH_MOTION}`} style={{ width: grown(entered, `${Number(method.porcentaje)}%`) }} />
          </div>
          <span className="col-span-2 sm:col-span-1 text-base text-right tabular-nums text-on-surface-variant whitespace-nowrap">
            <strong className="text-on-surface">{formatPercentage(method.porcentaje)}</strong> · {formatMoney(method.monto)}
          </span>
        </li>
      ))}
    </ul>
  )
}

const BREAKDOWN_CELL_Y = 'py-2.5'
const BREAKDOWN_CELL_X = 'px-3 sm:px-5'

function RowMarker({ swatchClass, icon }) {
  if (swatchClass) return <span className={`w-2.5 h-2.5 shrink-0 rounded-sm ${swatchClass}`} aria-hidden="true" />
  if (icon) return <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">{icon}</span>
  return null
}

const highlightState = (segmentKey, activeKey) => {
  if (!segmentKey || activeKey === null) return ''
  return activeKey === segmentKey ? 'bg-surface-container-low' : 'opacity-40'
}

function BreakdownRow({ label, porcentaje, monto, variant = 'row', swatchClass, icon, segmentKey, activeKey = null, onActiveChange }) {
  const nested = variant === 'nested'
  const labelTone = nested ? 'font-normal text-on-surface-variant' : 'font-semibold text-on-surface'
  const interaction = segmentKey && onActiveChange
    ? {
      tabIndex: 0,
      onMouseEnter: () => onActiveChange(segmentKey),
      onMouseLeave: () => onActiveChange(null),
      onFocus: () => onActiveChange(segmentKey),
      onBlur: () => onActiveChange(null),
    }
    : {}
  return (
    <tr
      {...interaction}
      className={`border-t border-outline-variant/30 first:border-t-0 transition-[opacity,background-color] duration-150 focus:outline-none focus-visible:bg-surface-container-low ${highlightState(segmentKey, activeKey)}`}
    >
      <th scope="row" className={`${BREAKDOWN_CELL_Y} pr-2 sm:pr-5 ${nested ? 'pl-8 sm:pl-11' : 'pl-4 sm:pl-5'} text-left ${labelTone}`}>
        <span className="flex items-center gap-2.5">
          <RowMarker swatchClass={swatchClass} icon={icon} />
          {label}
        </span>
      </th>
      <td className={`${BREAKDOWN_CELL_Y} ${BREAKDOWN_CELL_X} sm:w-28 text-right tabular-nums text-on-surface-variant`}>
        {formatPercentage(porcentaje)}
      </td>
      <td className={`${BREAKDOWN_CELL_Y} ${BREAKDOWN_CELL_X} sm:w-44 text-right tabular-nums text-on-surface whitespace-nowrap ${nested ? '' : 'font-semibold'}`}>
        {formatMoney(monto)}
      </td>
    </tr>
  )
}

function BreakdownTable({ rows, activeKey, onActiveChange }) {
  return (
    <table className="w-full text-base">
      <thead className="sr-only">
        <tr>
          <th scope="col">Tipo</th>
          <th scope="col">Porcentaje</th>
          <th scope="col">Monto</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ key, ...row }) => <BreakdownRow key={key} {...row} activeKey={activeKey} onActiveChange={onActiveChange} />)}
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
  { key: 'notas-credito', label: 'Notas de crédito', icon: 'request_quote', porcentaje: refunds.notas_credito.porcentaje, monto: refunds.notas_credito.monto },
  { key: 'manuales', label: 'Devoluciones manuales', icon: 'currency_exchange', porcentaje: refunds.manuales.porcentaje, monto: refunds.manuales.monto },
  ...conceptRows(refunds.manuales.conceptos, 'nested', 'manual-'),
]

const extraIncomeSeries = (concepts) => colorSeries(concepts.map((concept) => ({
  key: concept.nombre.toLocaleLowerCase('es'),
  label: concept.nombre,
  amount: Number(concept.monto),
  count: concept.cantidad,
  porcentaje: concept.porcentaje,
})))

function ExtraIncomeBreakdown({ extra }) {
  const [activeKey, setActiveKey] = useState(null)
  const series = extraIncomeSeries(extra.conceptos)
  const rows = series.map((concept, index) => ({
    key: concept.key,
    label: concept.label,
    porcentaje: concept.porcentaje,
    monto: concept.amount,
    swatchClass: concept.colorClass,
    segmentKey: segmentKeyOf(concept, index),
  }))
  return (
    <>
      <div className="px-4 sm:px-5 py-4 border-b border-outline-variant/30">
        <StackedBar
          segments={stackSegments(series)}
          total={Number(extra.total)}
          label="Otros ingresos por concepto"
          activeKey={activeKey}
          onActiveChange={setActiveKey}
        />
      </div>
      <BreakdownTable rows={rows} activeKey={activeKey} onActiveChange={setActiveKey} />
    </>
  )
}

function KpiBlockSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBlock soft className="h-3.5 w-24" />
      <SkeletonBlock className="h-7 w-32 max-w-full" />
      <SkeletonBlock soft className="h-3 w-20" />
    </div>
  )
}

function SummarySkeleton() {
  return (
    <SkeletonStatus label="Cargando resumen financiero..." className="flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-[fit-content(40%)_1fr] gap-5">
        <div className={PANEL_CLASS}>
          <HeadingSkeleton />
          <div className={`${BODY_CLASS} flex flex-col sm:flex-row items-center gap-5`}>
            <RingSkeleton />
            <LineSkeletons count={3} className="w-full sm:w-48 flex flex-col gap-3" />
          </div>
        </div>
        <div className={PANEL_CLASS}>
          <HeadingSkeleton />
          <div className={`${BODY_CLASS} grid grid-cols-1 sm:grid-cols-3 gap-6`}>
            {Array.from({ length: 6 }, (_, index) => <KpiBlockSkeleton key={index} />)}
          </div>
        </div>
      </div>
      <div className={PANEL_CLASS}><HeadingSkeleton withAction /></div>
      <div className={PANEL_CLASS}>
        <HeadingSkeleton withAction />
        <div className={`${BODY_CLASS} flex flex-col gap-4`}>
          {[0, 1, 2].map((index) => <SkeletonBlock key={index} soft className="h-3 w-full" />)}
        </div>
      </div>
      <div className={PANEL_CLASS}><HeadingSkeleton withAction /></div>
      <div className={PANEL_CLASS}>
        <HeadingSkeleton />
        <div className={BODY_CLASS}><SkeletonBlock soft className="h-[220px] w-full" /></div>
      </div>
    </SkeletonStatus>
  )
}

function ResumenFinanciero() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPeriod = searchParams.get('periodo')
  const period = isValidPeriod(requestedPeriod) ? requestedPeriod : currentPeriod()
  const { data, isLoading, error, reload } = useResumenFinanciero(period)
  const { showToast } = useToast()
  const [expanded, setExpanded] = useState({ incomes: false, refunds: false })
  const [evolutionView, setEvolutionView] = useState('chart')
  const [isExporting, setIsExporting] = useState(false)

  const changePeriod = (value) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.set('periodo', value)
    return next
  })
  const toggle = (key) => setExpanded((current) => ({ ...current, [key]: !current[key] }))

  const handleExport = async () => {
    setIsExporting(true)
    try {
      await downloadFinancialSummaryPdf(period)
      showToast({ title: 'Informe descargado', description: `Resumen financiero de ${formatPeriod(period)}.` })
    } catch (err) {
      showToast({ tone: 'error', title: 'No se pudo generar el informe', description: getErrorMessage(err, 'Probá de nuevo en unos minutos.') })
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
          <SecondaryButton icon="picture_as_pdf" disabled={isLoading || isExporting} onClick={handleExport}>
            {isExporting ? 'Generando PDF...' : 'Descargar PDF'}
          </SecondaryButton>
        )}
      />

      <SectionDivider actions={<PeriodSelector value={period} onChange={changePeriod} />}>
        Resumen mensual
      </SectionDivider>

      {isLoading && <SummarySkeleton />}
      {error && (
        <LoadErrorBanner
          message={data
            ? 'No pudimos actualizar el resumen. Estás viendo los últimos datos que se cargaron.'
            : `No pudimos traer el resumen de ${formatPeriod(period)}. Revisá la conexión y probá de nuevo.`}
          onRetry={reload}
        />
      )}

      {data && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-[fit-content(40%)_1fr] gap-5">
            <section className={PANEL_CLASS} aria-labelledby="income-origin-title">
              <SectionHeading
                id="income-origin-title"
                icon="donut_large"
                title={`Ingresos de ${formatPeriod(period)}`}
                className={HEADING_CLASS}
                actions={(
                  <Link to={`/caja?periodo=${period}`} className={`${TEXT_BUTTON_CLASS} text-base`}>
                    Ver en caja
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                  </Link>
                )}
              />
              <div className={BODY_CLASS}>
                <IncomeOriginChart income={data.ingresos} />
              </div>
            </section>

            <section className={PANEL_CLASS} aria-labelledby="cuota-kpis-title">
              <SectionHeading
                id="cuota-kpis-title"
                icon="monitoring"
                title={`Cuotas de ${formatPeriod(period)}`}
                className={HEADING_CLASS}
                actions={(
                  <Link to={`/finanzas/cuotas?periodo=${period}`} className={`${TEXT_BUTTON_CLASS} text-base`}>
                    Ver cuotas
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
                  </Link>
                )}
              />
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
            expanded={expanded.incomes}
            isEmpty={data.ingresos_extra.conceptos.length === 0}
            emptyText="No hubo otros ingresos en el período."
            onToggle={() => toggle('incomes')}
          >
            <ExtraIncomeBreakdown extra={data.ingresos_extra} />
          </CollapsibleSection>

          <CollapsibleSection
            id="refunds"
            icon="assignment_return"
            title="Devoluciones"
            total={data.devoluciones.total}
            expanded={expanded.refunds}
            isEmpty={Number(data.devoluciones.total) === 0}
            emptyText="No hubo devoluciones en el período."
            onToggle={() => toggle('refunds')}
          >
            <BreakdownTable rows={refundRows(data.devoluciones)} />
            <BasisNote>
              Las devoluciones no restan de los ingresos. Una devolución manual devuelve dinero que nunca se registró como ingreso, y una nota de crédito sale de un comprobante que ya está anulado.
            </BasisNote>
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
            <BasisNote>Con qué medio se cobraron los ingresos de {formatPeriod(period)}.</BasisNote>
          </section>

          <SectionDivider>Contexto histórico</SectionDivider>

          <section className={PANEL_CLASS} aria-labelledby="evolution-title">
            <SectionHeading
              id="evolution-title"
              icon="trending_up"
              title="Evolución anual de cobranza (cuotas)"
              className={HEADING_CLASS}
              actions={(
                <SegmentedControl
                  label="Ver la evolución como"
                  options={[{ value: 'chart', label: 'Gráfico' }, { value: 'table', label: 'Tabla' }]}
                  value={evolutionView}
                  onChange={setEvolutionView}
                />
              )}
            />
            {evolutionView === 'chart' ? (
              <div className={BODY_CLASS}>
                <CollectionEvolutionChart evolution={data.evolucion} period={period} />
              </div>
            ) : (
              <CollectionEvolutionTable evolution={data.evolucion} period={period} />
            )}
            <BasisNote>Para cada mes: lo emitido en cuotas y lo cobrado de ellas hasta hoy.</BasisNote>
          </section>
        </div>
      )}

    </div>
  )
}

export default ResumenFinanciero
