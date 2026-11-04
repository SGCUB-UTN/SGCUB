import { useState } from 'react'
import useDashboard from '../hooks/useDashboard'
import AlertCenterSection from '../components/dashboard/AlertCenterSection'
import CuotaStatusSection from '../components/dashboard/CuotaStatusSection'
import MemberCountsSection from '../components/dashboard/MemberCountsSection'
import OtroMovimientoModal from '../components/finanzas/OtroMovimientoModal'
import PageHeader from '../components/shared/PageHeader'
import { PrimaryButton, SecondaryButton } from '../components/personas/tabs/parts'
import useRegisterPayment from '../hooks/useRegisterPayment'

export default function Principal() {
  const { openPayment } = useRegisterPayment()
  const [movimientoAbierto, setMovimientoAbierto] = useState(false)
  const { isLoading, data, error, reload } = useDashboard()

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Inicio' }]}
        title="Panel principal"
        actions={(
          <>
            <PrimaryButton icon="payments" onClick={() => openPayment({ onSuccess: reload })}>Registrar pago</PrimaryButton>
            <SecondaryButton icon="swap_horiz" onClick={() => setMovimientoAbierto(true)}>Otros movimientos</SecondaryButton>
          </>
        )}
      />

      {error && (
        <p className="p-4 bg-error-container/40 border border-error/20 rounded-md text-sm text-on-error-container" role="alert">
          No se pudo cargar el panel principal.
        </p>
      )}

      <MemberCountsSection isLoading={isLoading} members={data?.members} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg items-start">
        <CuotaStatusSection isLoading={isLoading} cuotas={data?.cuotas} />
        <AlertCenterSection isLoading={isLoading} alerts={data?.alerts} />
      </div>

      <OtroMovimientoModal
        opened={movimientoAbierto}
        onClose={() => setMovimientoAbierto(false)}
        onSuccess={reload}
      />
    </div>
  )
}
