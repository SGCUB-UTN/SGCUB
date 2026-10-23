import { useMemo } from 'react'
import { BenefitsTable } from '../../finanzas/BenefitTables'
import CuotasEstadoCuentaTable from '../../finanzas/CuotasEstadoCuentaTable'
import { isPaid, scholarshipState } from '../../finanzas/accountStatement'
import { formatAmount, formatNumber } from '../format'
import { BenefitButton, PayButton } from '../HeaderPersona'
import StatCard from '../../shared/StatCard'
import { EmptyState } from './parts'
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

  const scrollToSection = (id) => {
    const heading = document.getElementById(id)
    if (!heading) return
    heading.focus({ preventScroll: true })
    heading.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

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
    <section className="flex flex-col gap-6 mt-2" aria-labelledby="estado-cuenta-title">
      <div className="mb-4">
        <h2 id="estado-cuenta-title" className="text-2xl font-bold text-on-surface">Cuenta Corriente {formatNumber(account.cuenta_corriente_id)}</h2>
        <p className="text-base text-on-surface-variant mt-1">Detalle de cuotas, pagos y beneficios del socio.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-10">
        <StatCard label="Cuotas pendientes" value={summary.pendingCount} icon="pending_actions" tone={summary.pendingCount ? 'warning' : 'neutral'} onClick={() => scrollToSection('cuotas-title')} />
        <StatCard label="Saldo adeudado" value={formatAmount(summary.debt)} icon="account_balance" tone={summary.debt ? 'error' : 'neutral'} />
        <StatCard label="Becas vigentes" value={summary.activeScholarships ?? '—'} icon="sell" tone="neutral" onClick={() => scrollToSection('beneficios-title')} />
      </div>

      <section className="flex flex-col gap-6 my-4" aria-labelledby="cuotas-title">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 id="cuotas-title" tabIndex="-1" className="text-lg font-bold text-on-surface scroll-mt-6 focus:outline-none">Cuotas</h3>
          <div className="flex flex-col sm:flex-row gap-2 [&>button]:justify-center">
            <BenefitButton variant="neutral" onClick={() => openBenefit({ socioId, onSuccess: reloadFinances })}>
              Beca o descuento
            </BenefitButton>
            <PayButton onClick={() => openPayment({ socioId, onSuccess: reloadFinances })}>Pagar cuota</PayButton>
          </div>
        </div>
        {cuotas.length === 0 ? (
          <EmptyState icon="receipt_long" title="Sin cuotas generadas" description="La cuenta corriente no tiene cuotas registradas." />
        ) : (
          <CuotasEstadoCuentaTable cuotas={cuotas} />
        )}
      </section>

      <BenefitsTable becas={becas} cuotas={cuotas} />
    </section>
  )
}

function FinancialTab({ socio }) {
  const finances = useSocioFinances(socio.socio_id)
  return <FinancialStatement socio={socio} finances={finances} />
}

export default FinancialTab
