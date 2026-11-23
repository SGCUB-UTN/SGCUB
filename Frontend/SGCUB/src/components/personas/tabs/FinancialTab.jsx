import { useMemo, useState } from 'react'
import { BenefitsTable } from '../../finanzas/BenefitTables'
import ComprobanteDetailModal from '../../finanzas/ComprobanteDetailModal'
import CuotasEstadoCuentaTable from '../../finanzas/CuotasEstadoCuentaTable'
import MovementsTable from '../../finanzas/MovementsTable'
import DevolucionDetailModal from '../../finanzas/DevolucionDetailModal'
import OtroMovimientoModal from '../../finanzas/OtroMovimientoModal'
import { isActiveScholarship, isPaid } from '../../finanzas/accountStatement'
import { isOverdue } from '../../finanzas/cuotaStates'
import { SectionEmpty } from '../../shared/FlushSection'
import { INSET_PADDING_X_CLASS } from '../../shared/flushTable'
import { currentPeriod } from '../../shared/periodFormat'
import { KpiColumn, KpiGrid } from '../../shared/Kpi'
import { formatCount, formatMoney } from '../../cuota/cuotaPeriod'
import { SecondaryButton, SegmentedTabs, TAB_PANEL_CLASS, TabHeader } from './parts'
import { INCOME, MANUAL_REFUND } from '../../finanzas/conceptOrigins'
import useAssignBenefit from '../../../hooks/useAssignBenefit'
import useRegisterPayment from '../../../hooks/useRegisterPayment'
import useRevertPayment from '../../../hooks/useRevertPayment'
import { SkeletonBlock, SkeletonStatus, TableSkeletonRows } from '../../shared/Skeleton'


const CUOTAS = 'cuotas'
const MOVEMENTS = 'movimientos'
const BENEFITS = 'beneficios'

const SECTIONS = [
  { value: CUOTAS, id: 'cuotas-title', icon: 'receipt_long', title: 'Cuotas' },
  { value: MOVEMENTS, id: 'otros-movimientos-title', icon: 'swap_horiz', title: 'Ingresos y devoluciones' },
  { value: BENEFITS, id: 'beneficios-title', icon: 'sell', title: 'Becas y descuentos' },
]

const PANEL_ID = 'financial-section-panel'

const READ_ONLY_HINT = 'La ficha está en solo lectura'

const reversalFor = (account, cuota, onChanged) => {
  const settlement = account.saldo_beneficio_revertible
  if (settlement?.cuota_id !== cuota.cuota_id) return { comprobanteId: account.comprobante_revertible_id, onChanged }
  const item = cuota.items.find((candidate) => candidate.item_cuota_id === settlement.item_cuota_id)
  return { settlement: { cuota, item }, onChanged }
}

// Renders finances already loaded with useSocioFinances, so the page can share them (e.g. for the tab badge)
function ExemptNotice({ category }) {
  return (
    <div className={`${INSET_PADDING_X_CLASS} my-2`}>
      <p className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary-fixed/30 px-4 py-3 text-base text-on-surface" role="status">
        <span className="material-symbols-outlined shrink-0 text-[20px] text-primary" aria-hidden="true">money_off</span>
        <span>
          No se generan cuotas porque juega en la categoría <strong>{category.nombre}</strong>, que está exenta de pago. Si existe deuda, puede deberse a las cuotas de su categoría anterior.
        </span>
      </p>
    </div>
  )
}

export function FinancialStatement({ socio, finances, exemptCategory = null, readOnly = false }) {
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const { openReversal } = useRevertPayment()
  const socioId = socio.socio_id
  const { loading, error, account, becas, movimientos, reload: reloadFinances } = finances
  const cuotas = useMemo(() => account?.cuotas ?? [], [account])
  const [comprobanteId, setComprobanteId] = useState(null)
  const [devolucionSeleccionada, setDevolucionSeleccionada] = useState(null)
  const [movementOperation, setMovementOperation] = useState(null)
  const [activeSection, setActiveSection] = useState(CUOTAS)

  const openMovement = (movement) => {
    if (movement.isRefund) setDevolucionSeleccionada(movement.raw)
    else setComprobanteId(movement.raw.comprobante_id)
  }

  const summary = useMemo(() => {
    const period = currentPeriod()
    const unpaid = cuotas.filter((cuota) => !isPaid(cuota))
    const overdue = unpaid.filter(isOverdue)
    const upcoming = unpaid.filter((cuota) => !isOverdue(cuota) && String(cuota.periodo) <= period)
    const total = (list) => list.reduce((sum, cuota) => sum + Number(cuota.saldo_pendiente ?? 0), 0)
    return {
      hasOverdue: overdue.length > 0,
      pending: total([...overdue, ...upcoming]),
      activeScholarships: becas ? becas.filter((beca) => isActiveScholarship(beca)).length : null,
    }
  }, [cuotas, becas])

  if (loading) {
    return (
      <SkeletonStatus label="Cargando estado de cuenta..." className="flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {[0, 1].map((index) => (
            <div key={index} className="flex flex-col gap-2">
              <SkeletonBlock soft className="h-3.5 w-28" />
              <SkeletonBlock className="h-7 w-36" />
            </div>
          ))}
        </div>
        <table className="w-full">
          <tbody>
            <TableSkeletonRows colSpan={5} rows={4} animated={false} />
          </tbody>
        </table>
      </SkeletonStatus>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-error-container text-on-error-container p-4 rounded-lg border border-error/30" role="alert">
        <span>{error}</span>
        <SecondaryButton icon="refresh" onClick={reloadFinances}>Reintentar</SecondaryButton>
      </div>
    )
  }

  if (!account) {
    return <SectionEmpty>Este socio todavía no tiene una cuenta corriente asociada.</SectionEmpty>
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Resumen de cuenta">
      <TabHeader title="Resumen de cuenta" />

      {exemptCategory && <ExemptNotice category={exemptCategory} />}

      <KpiGrid columns={2} className={`py-3 border-b border-surface-container ${INSET_PADDING_X_CLASS}`}>
        <KpiColumn
          label="Monto pendiente"
          value={formatMoney(summary.pending)}
          tone={summary.hasOverdue ? 'text-error' : 'text-on-surface'}
        />
        <KpiColumn
          label="Becas vigentes"
          value={summary.activeScholarships == null ? '—' : formatCount(summary.activeScholarships)}
        />
      </KpiGrid>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Acciones de la cuenta">

          <SecondaryButton
            icon="add_circle"
            onClick={() => setMovementOperation(INCOME)}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_HINT : undefined}
          >
            Registrar ingreso
          </SecondaryButton>
          <SecondaryButton
            icon="remove_circle"
            onClick={() => setMovementOperation(MANUAL_REFUND)}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_HINT : undefined}
          >
            Registrar devolución
          </SecondaryButton>
          <SecondaryButton
            icon="school"
            onClick={() => openBenefit({ socioId, onSuccess: reloadFinances })}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_HINT : undefined}
          >
            Agregar beca
          </SecondaryButton>
      </div>
      <SegmentedTabs
        label="Secciones de la cuenta corriente"
        sections={SECTIONS}
        value={activeSection}
        onChange={setActiveSection}
        panelId={PANEL_ID}
        className="mt-2"
      />

      <div className={TAB_PANEL_CLASS}>
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={SECTIONS.find((section) => section.value === activeSection).id}>
          {activeSection === CUOTAS && (cuotas.length === 0 ? (
            <SectionEmpty>La cuenta corriente no tiene cuotas generadas.</SectionEmpty>
          ) : (
            <CuotasEstadoCuentaTable
              cuotas={cuotas}
              socio={socio}
              revertibleIds={readOnly ? undefined : account.cuotas_revertibles ?? []}
              settlementCuotaId={readOnly ? null : account.saldo_beneficio_revertible?.cuota_id ?? null}
              onPay={(cuota) => openPayment({ socioId, cuotaIds: [cuota.cuota_id], onSuccess: reloadFinances })}
              onAssignBenefit={readOnly ? undefined : (cuota) => openBenefit({ socioId, cuotaId: cuota.cuota_id, onSuccess: reloadFinances })}
              onRevert={readOnly ? undefined : (cuota) => openReversal(reversalFor(account, cuota, reloadFinances))}
              onChanged={reloadFinances}
              readOnly={readOnly}
            />
          ))}
          {activeSection === MOVEMENTS && (
            <MovementsTable movimientos={movimientos} socio={socio} readOnly={readOnly} onOpen={openMovement} onChanged={reloadFinances} />
          )}
          {activeSection === BENEFITS && (
            <BenefitsTable becas={becas} cuotas={cuotas} onChanged={reloadFinances} readOnly={readOnly} />
          )}
        </div>
      </div>

      <ComprobanteDetailModal
        comprobanteId={comprobanteId}
        opened={Boolean(comprobanteId)}
        onClose={() => setComprobanteId(null)}
        onChanged={reloadFinances}
        readOnly={readOnly}
      />

      <DevolucionDetailModal
        devolucion={devolucionSeleccionada}
        opened={Boolean(devolucionSeleccionada)}
        onClose={() => setDevolucionSeleccionada(null)}
      />

      <OtroMovimientoModal
        opened={Boolean(movementOperation)}
        initialSocio={socio}
        initialOperation={movementOperation ?? INCOME}
        onClose={() => setMovementOperation(null)}
        onSuccess={reloadFinances}
      />
    </section>
  )
}
