import { useState } from 'react'
import useDashboard from '../hooks/useDashboard'
import DocumentSummarySection from '../components/dashboard/DocumentSummarySection'
import FinancialKpiSection from '../components/dashboard/FinancialKpiSection'
import ProcessStatusSection from '../components/dashboard/ProcessStatusSection'
import MovimientoManualModal from '../components/finanzas/MovimientoManualModal'
import PageHeader from '../components/shared/PageHeader'
import { PrimaryButton, SecondaryButton } from '../components/personas/tabs/parts'
import useRegisterPayment from '../hooks/useRegisterPayment'

const DATE_LABEL = new Date().toLocaleDateString('es-AR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export default function Principal() {
  const { openPayment } = useRegisterPayment()
  const [movimientoManualAbierto, setMovimientoManualAbierto] = useState(false)
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
            <SecondaryButton icon="swap_horiz" onClick={() => setMovimientoManualAbierto(true)}>Registrar movimiento</SecondaryButton>
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

      <MovimientoManualModal
        opened={movimientoManualAbierto}
        onClose={() => setMovimientoManualAbierto(false)}
      />
    </div>
  )
}
