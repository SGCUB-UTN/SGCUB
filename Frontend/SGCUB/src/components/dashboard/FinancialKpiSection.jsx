import { Link } from 'react-router-dom'
import { formatAmount } from '../personas/format'
import StatCard from '../shared/StatCard'
import { overdueBreakdown } from '../finanzas/cuotaStates'

function KpiSkeleton() {
  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg p-4 flex items-center justify-between gap-3 shadow-xs animate-pulse">
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-4 w-3/5 bg-surface-container-high rounded" />
        <div className="h-7 w-2/5 bg-surface-container-high rounded" />
      </div>
      <div className="w-10 h-10 rounded-full bg-surface-container-high shrink-0" />
    </div>
  )
}

function KpiLink({ to, ariaLabel, children }) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className="block min-w-0 rounded-lg transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {children}
    </Link>
  )
}

export default function FinancialKpiSection({
  isLoading,
  totalRecaudadoMes,
  sociosEnMora,
  montoAdeudadoTotal,
  cuotasVencidas,
  cuotasVencidas1,
  cuotasVencidas2,
  totalSociosActivos,
}) {
  const moraPct = sociosEnMora != null && totalSociosActivos > 0
    ? `${((sociosEnMora / totalSociosActivos) * 100).toFixed(1)}% del padrón`
    : undefined

  return (
    <section
      aria-labelledby="dashboard-financial-title"
      className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden"
    >
      <div className="p-space-lg flex items-center gap-space-sm border-b border-surface-container">
        <div className="min-w-0">
          <h2 id="dashboard-financial-title" className="text-xl font-semibold text-on-surface">
            Resumen de cobranzas
          </h2>
          <p className="text-base text-on-surface-variant">Recaudación del mes y estado de la deuda de socios</p>
        </div>
        <Link
          to="/resumen-financiero"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline shrink-0"
        >
          Ver resumen financiero
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>

      <div className="p-space-lg bg-surface-container-low grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <KpiSkeleton key={index} />)
        ) : (
          <>
            <KpiLink to="/resumen-financiero" ariaLabel="Ver resumen financiero">
              <StatCard
                label="Recaudado este mes"
                value={formatAmount(totalRecaudadoMes ?? 0)}
                icon="account_balance_wallet"
                tone="positive"
              />
            </KpiLink>
            <KpiLink to="/morosidad" ariaLabel="Ver reporte de morosidad">
              <StatCard
                label="Socios con deuda"
                value={sociosEnMora ?? '—'}
                caption={moraPct}
                icon="person_alert"
                tone="warning"
              />
            </KpiLink>
            <KpiLink to="/morosidad" ariaLabel="Ver reporte de morosidad">
              <StatCard
                label="Monto adeudado"
                value={montoAdeudadoTotal != null ? formatAmount(montoAdeudadoTotal) : '—'}
                icon="pending_actions"
                tone="warning"
              />
            </KpiLink>
            <KpiLink to="/resumen-financiero" ariaLabel="Ver resumen financiero">
              <StatCard
                label="Cuotas vencidas"
                value={cuotasVencidas ?? '—'}
                caption={cuotasVencidas != null ? overdueBreakdown(cuotasVencidas1, cuotasVencidas2) : undefined}
                icon="event_busy"
                tone="error"
              />
            </KpiLink>
          </>
        )}
      </div>
    </section>
  )
}
