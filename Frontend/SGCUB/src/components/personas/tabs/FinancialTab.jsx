import { useMemo } from 'react'
import { DiscountsTable, ScholarshipsTable } from '../../finanzas/BenefitTables'
import CuotasEstadoCuentaTable from '../../finanzas/CuotasEstadoCuentaTable'
import { isPaid, scholarshipState } from '../../finanzas/accountStatement'
import { formatAmount, formatNumber } from '../format'
import { EmptyState, KPI } from './parts'
import useAssignBenefit from '../../../hooks/useAssignBenefit'
import useRegisterPayment from '../../../hooks/useRegisterPayment'
import useSocioFinances from '../../../hooks/useSocioFinances'

// Renders finances already loaded with useSocioFinances, so the page can share them (e.g. for the tab badge)
export function FinancialStatement({ socio, finances }) {
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const socioId = socio.socio_id
  const { loading, error, account, becas, reload: reloadFinances } = finances
  const cuotas = useMemo(() => account?.cuotas ?? [], [account])

  const summary = useMemo(() => ({
    pendingCount: cuotas.filter((cuota) => !isPaid(cuota)).length,
    debt: Number(account?.total_adeudado ?? 0),
    activeScholarships: becas ? becas.filter((beca) => scholarshipState(beca) === 'active').length : null,
  }), [account, cuotas, becas])

  if (loading) {
    return <div className="py-16 flex flex-col items-center gap-3 text-on-surface-variant"><span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span><p>Cargando estado de cuenta...</p></div>
  }

  if (error) {
    return <div className="bg-error-container text-on-error-container p-4 rounded-lg border border-error/30" role="alert">{error}</div>
  }

  if (!account) {
    return <EmptyState icon="account_balance_wallet" title="Sin cuenta corriente" description="Este socio todavía no tiene una cuenta corriente asociada." />
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="estado-cuenta-title">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-wider font-semibold text-primary">Cuenta corriente {formatNumber(account.cuenta_corriente_id)}</p>
          <h2 id="estado-cuenta-title" className="text-2xl font-bold text-on-surface mt-1">Estado de cuenta</h2>
          <p className="text-base text-on-surface-variant mt-1">Detalle de cuotas, pagos y beneficios del socio.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 my-4">
        <KPI label="Cuotas pendientes" value={summary.pendingCount} icon="pending_actions" tone={summary.pendingCount ? 'alert' : 'ok'} />
        <KPI label="Saldo total adeudado" value={formatAmount(summary.debt)} icon="account_balance" tone={summary.debt ? 'error' : 'ok'} />
        <KPI label="Becas vigentes" value={summary.activeScholarships ?? '—'} icon="sell" />
      </div>

      <section className="flex flex-col gap-6 my-4" aria-labelledby="cuotas-title">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="cuotas-title" tabIndex="-1" className="text-lg font-bold text-on-surface">Cuotas</h3>
          <span className="text-sm text-on-surface-variant">{cuotas.length} {cuotas.length === 1 ? 'cuota' : 'cuotas'}</span>
        </div>
        {cuotas.length === 0 ? (
          <EmptyState icon="receipt_long" title="Sin cuotas generadas" description="La cuenta corriente no tiene cuotas registradas." />
        ) : (
          <CuotasEstadoCuentaTable
            cuotas={cuotas}
            onPay={(cuota) => openPayment({ socioId, cuotaIds: [cuota.cuota_id], onSuccess: reloadFinances })}
            onAssignBenefit={(cuota) => openBenefit({ socioId, cuotaId: cuota.cuota_id, onSuccess: reloadFinances })}
          />
        )}
      </section>

      <ScholarshipsTable becas={becas} />
      <div className="my-4">
        <DiscountsTable cuotas={cuotas} />
      </div>
    </section>
  )
}

function FinancialTab({ socio }) {
  const finances = useSocioFinances(socio.socio_id)
  return <FinancialStatement socio={socio} finances={finances} />
}

export default FinancialTab
