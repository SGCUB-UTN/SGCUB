import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PeriodSelector from '../components/cuota/PeriodSelector'
import { isValidPeriod } from '../components/cuota/cuotaPeriod'
import CashKpis from '../components/finanzas/CashKpis'
import ComprobantesTable from '../components/finanzas/ComprobantesTable'
import ComprobanteDetailModal from '../components/finanzas/ComprobanteDetailModal'
import DevolucionDetailModal from '../components/finanzas/DevolucionDetailModal'
import OtroMovimientoModal from '../components/finanzas/OtroMovimientoModal'
import PageHeader from '../components/shared/PageHeader'
import { PrimaryButton, SecondaryButton } from '../components/personas/tabs/parts'
import SectionDivider from '../components/shared/SectionDivider'
import LoadErrorBanner from '../components/shared/LoadErrorBanner'
import { currentPeriod, formatPeriod } from '../components/shared/periodFormat'
import useMovimientosCaja from '../hooks/useMovimientosCaja'
import useRegisterPayment from '../hooks/useRegisterPayment'
import { INCOME, MANUAL_REFUND } from '../components/finanzas/conceptOrigins'

function Caja() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPeriod = searchParams.get('periodo')
  const period = isValidPeriod(requestedPeriod) ? requestedPeriod : currentPeriod()
  const { openPayment } = useRegisterPayment()
  const movimientos = useMovimientosCaja(period)
  const [comprobanteId, setComprobanteId] = useState(null)
  const [devolucionSeleccionada, setDevolucionSeleccionada] = useState(null)
  const [movementOperation, setMovementOperation] = useState(null)

  const recargarCaja = movimientos.reload
  const sinMovimientos = Boolean(movimientos.error) && !movimientos.hasData

  const changePeriod = (value) => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    next.set('periodo', value)
    return next
  })

  return (
    <div className="w-full flex flex-col gap-5 pb-8">
      <PageHeader
        breadcrumb={[{ label: 'Finanzas' }, { label: 'Caja y cobros' }]}
        title="Caja y cobros"
        actions={(
          <div className="flex flex-wrap items-center gap-2.5">
            <PrimaryButton icon="payments" onClick={() => openPayment({ onSuccess: recargarCaja })}>
              Registrar pago
            </PrimaryButton>
            <SecondaryButton icon="add_circle" onClick={() => setMovementOperation(INCOME)}>
              Registrar ingreso
            </SecondaryButton>
            <SecondaryButton icon="remove_circle" onClick={() => setMovementOperation(MANUAL_REFUND)}>
              Registrar devolución
            </SecondaryButton>
          </div>
        )}
      />

      <SectionDivider actions={<PeriodSelector value={period} onChange={changePeriod} />}>
        Resumen mensual
      </SectionDivider>

      {movimientos.error && (
        <LoadErrorBanner
          message={sinMovimientos
            ? `No pudimos traer los movimientos de ${formatPeriod(period)}. Revisá la conexión y probá de nuevo.`
            : 'No pudimos actualizar los movimientos. Estás viendo los últimos datos que se cargaron.'}
          onRetry={recargarCaja}
        />
      )}

      {!sinMovimientos && (
        <>
          <CashKpis
            period={period}
            comprobantes={movimientos.comprobantes}
            devoluciones={movimientos.devoluciones}
            isLoading={movimientos.isLoading}
          />

          <ComprobantesTable
            period={period}
            comprobantes={movimientos.comprobantes}
            devoluciones={movimientos.devoluciones}
            isLoading={movimientos.isLoading}
            onSelect={(comprobante) => setComprobanteId(comprobante.comprobante_id)}
            onSelectDevolucion={setDevolucionSeleccionada}
            onChanged={recargarCaja}
          />
        </>
      )}

      <ComprobanteDetailModal
        comprobanteId={comprobanteId}
        opened={Boolean(comprobanteId)}
        onClose={() => setComprobanteId(null)}
        onChanged={recargarCaja}
      />

      <DevolucionDetailModal
        devolucion={devolucionSeleccionada}
        opened={Boolean(devolucionSeleccionada)}
        onClose={() => setDevolucionSeleccionada(null)}
        onChanged={recargarCaja}
      />

      <OtroMovimientoModal
        opened={Boolean(movementOperation)}
        operation={movementOperation}
        onClose={() => setMovementOperation(null)}
        onSuccess={recargarCaja}
      />
    </div>
  )
}

export default Caja
