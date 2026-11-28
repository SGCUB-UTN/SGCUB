import { Link } from 'react-router-dom'
import { formatMoney, formatWholeMoney } from '../cuota/cuotaPeriod'
import { KpiColumn, KpiGrid } from '../shared/Kpi'
import SectionHeading from '../shared/SectionHeading'
import { PANEL_BODY_CLASS, PANEL_CLASS, PANEL_HEADING_CLASS } from '../shared/panel'
import { formatPeriod } from '../shared/periodFormat'
import { HeadingSkeleton, SkeletonBlock, SkeletonStatus } from '../shared/Skeleton'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'
import { countLabel } from './cashFormat'
import cashSummary from './cashSummary'

const KPI_COUNT = 3

function CashKpisSkeleton() {
  return (
    <SkeletonStatus label="Cargando totales del mes..." className={PANEL_CLASS}>
      <HeadingSkeleton withAction />
      <div className={`${PANEL_BODY_CLASS} grid grid-cols-1 sm:grid-cols-3 gap-6`}>
        {Array.from({ length: KPI_COUNT }, (_, index) => (
          <div key={index} className="flex flex-col gap-2">
            <SkeletonBlock soft className="h-3.5 w-24" />
            <SkeletonBlock className="h-7 w-32 max-w-full" />
            <SkeletonBlock soft className="h-3 w-40 max-w-full" />
          </div>
        ))}
      </div>
    </SkeletonStatus>
  )
}

function MoneyKpi({ label, amount, tone, caption }) {
  return (
    <KpiColumn
      label={label}
      value={formatWholeMoney(amount)}
      title={formatMoney(amount)}
      tone={amount > 0 ? tone : undefined}
      caption={caption}
    />
  )
}

export default function CashKpis({ period, comprobantes, devoluciones, isLoading }) {
  if (isLoading) return <CashKpisSkeleton />

  const summary = cashSummary(comprobantes, devoluciones)
  const refunded = summary.creditNotes.amount + summary.manualRefunds.amount

  return (
    <section className={PANEL_CLASS} aria-labelledby="cash-totals-title">
      <SectionHeading
        id="cash-totals-title"
        icon="account_balance_wallet"
        title={`Totales de ${formatPeriod(period)}`}
        className={PANEL_HEADING_CLASS}
        actions={(
          <Link to={`/resumen-financiero?periodo=${period}`} className={`${TEXT_BUTTON_CLASS} text-base`}>
            Ver resumen financiero
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
          </Link>
        )}
      />
      <div className={PANEL_BODY_CLASS}>
        <KpiGrid columns={KPI_COUNT}>
          <MoneyKpi
            label="Ingresos"
            amount={summary.income.amount}
            tone="text-emerald-700"
            caption={`Cuotas ${formatWholeMoney(summary.cuotas.amount)} · Otros ${formatWholeMoney(summary.otherIncome.amount)}`}
          />
          <MoneyKpi
            label="Devoluciones"
            amount={refunded}
            caption={`${countLabel(summary.creditNotes.count, 'nota de crédito', 'notas de crédito')} · ${countLabel(summary.manualRefunds.count, 'manual', 'manuales')}`}
          />
          <MoneyKpi
            label="Anulados"
            amount={summary.annulled.amount}
            caption={countLabel(summary.annulled.count, 'comprobante anulado', 'comprobantes anulados')}
          />
        </KpiGrid>
      </div>
    </section>
  )
}
