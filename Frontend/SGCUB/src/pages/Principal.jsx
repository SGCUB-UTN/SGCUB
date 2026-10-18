import useDashboard from '../hooks/useDashboard'
import DocumentSummarySection from '../components/dashboard/DocumentSummarySection'
import FinancialKpiSection from '../components/dashboard/FinancialKpiSection'
import ProcessStatusSection from '../components/dashboard/ProcessStatusSection'
import PageHeader from '../components/shared/PageHeader'
import { PrimaryButton } from '../components/personas/tabs/parts'
import useRegisterPayment from '../hooks/useRegisterPayment'

const DATE_LABEL = new Date().toLocaleDateString('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function Principal() {
  const { openPayment } = useRegisterPayment()
  const {
    isLoading,
    totalRecaudadoMes,
    sociosEnMora,
    montoAdeudadoTotal,
    cuotasVencidas,
    cuotasVencidas1,
    cuotasVencidas2,
    totalSociosActivos,
    vencidos,
    proximosAVencer,
    getNombreTipo,
  } = useDashboard()

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Inicio' }]}
        title="Panel principal"
        actions={(
          <>
            <PrimaryButton icon="payments" onClick={() => openPayment()}>Registrar pago</PrimaryButton>
            <span className="inline-flex items-center gap-2 h-10 px-4 border border-outline-variant/50 rounded-lg text-sm text-on-surface-variant bg-surface-container-low">
              <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">calendar_today</span>
              <span className="capitalize">{DATE_LABEL}</span>
            </span>
          </>
        )}
      />

      <FinancialKpiSection
        isLoading={isLoading}
        totalRecaudadoMes={totalRecaudadoMes}
        sociosEnMora={sociosEnMora}
        montoAdeudadoTotal={montoAdeudadoTotal}
        cuotasVencidas={cuotasVencidas}
        cuotasVencidas1={cuotasVencidas1}
        cuotasVencidas2={cuotasVencidas2}
        totalSociosActivos={totalSociosActivos}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <DocumentSummarySection
          isLoading={isLoading}
          vencidos={vencidos}
          proximosAVencer={proximosAVencer}
          getNombreTipo={getNombreTipo}
        />
        <ProcessStatusSection />
      </div>
    </div>
  )
}
