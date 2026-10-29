import { useMemo, useState } from 'react'
import { BenefitsTable } from '../../finanzas/BenefitTables'
import ComprobanteDetailModal from '../../finanzas/ComprobanteDetailModal'
import CuotasEstadoCuentaTable from '../../finanzas/CuotasEstadoCuentaTable'
import DevolucionDetailModal from '../../finanzas/DevolucionDetailModal'
import OtroMovimientoModal from '../../finanzas/OtroMovimientoModal'
import { isActiveScholarship, isPaid } from '../../finanzas/accountStatement'
import { formatAmount, formatDate, formatNumber } from '../format'
import { BenefitButton, PayButton } from '../HeaderPersona'
import DataTable from '../../shared/DataTable'
import FlushSection, { SectionEmpty } from '../../shared/FlushSection'
import { FLUSH_END_CLASS } from '../../shared/flushTable'
import { currentPeriod } from '../../shared/periodFormat'
import StatCard from '../../shared/StatCard'
import { SecondaryButton, TabHeader } from './parts'
import useAssignBenefit from '../../../hooks/useAssignBenefit'
import useRegisterPayment from '../../../hooks/useRegisterPayment'
import useRevertPayment from '../../../hooks/useRevertPayment'
import useSocioFinances from '../../../hooks/useSocioFinances'

const BADGE_CLASS = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap'

const MOVEMENT_BADGES = {
  Ingreso: { label: 'Ingreso', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  IngresoAnulado: { label: 'Ingreso anulado', className: 'bg-error-container text-on-error-container border-error/20' },
  Manual: { label: 'Devolución manual', className: 'bg-error/10 text-error border-error/20' },
  NotaCredito: { label: 'Nota de crédito', className: 'bg-amber-50 text-amber-800 border-amber-200' },
}

// Incomes (by their receipt) and refunds of the socio, newest first
const otherMovements = (movimientos) => [
  ...(movimientos?.ingresos ?? []).map((comprobante) => ({
    key: `ingreso-${comprobante.comprobante_id}`,
    raw: comprobante,
    isRefund: false,
    badge: MOVEMENT_BADGES[comprobante.estado === 'Anulado' ? 'IngresoAnulado' : 'Ingreso'],
    codigo: comprobante.codigo,
    fecha: comprobante.fecha_emision,
    concepto: comprobante.concepto,
    detalle: 'Ver recibo',
    monto: comprobante.monto_total,
    anulado: comprobante.estado === 'Anulado',
  })),
  ...(movimientos?.devoluciones ?? []).map((devolucion) => ({
    key: `devolucion-${devolucion.devolucion_id}`,
    raw: devolucion,
    isRefund: true,
    badge: MOVEMENT_BADGES[devolucion.tipo] ?? MOVEMENT_BADGES.Manual,
    codigo: devolucion.codigo,
    fecha: devolucion.fecha,
    concepto: devolucion.concepto,
    detalle: devolucion.medio_de_pago_nombre,
    monto: devolucion.monto,
    anulado: false,
  })),
].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))

// Renders finances already loaded with useSocioFinances, so the page can share them (e.g. for the tab badge)
export function FinancialStatement({ socio, finances }) {
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const { openReversal } = useRevertPayment()
  const socioId = socio.socio_id
  const { loading, error, account, becas, movimientos, reload: reloadFinances } = finances
  const cuotas = useMemo(() => account?.cuotas ?? [], [account])
  const [comprobanteId, setComprobanteId] = useState(null)
  const [devolucionSeleccionada, setDevolucionSeleccionada] = useState(null)
  const [modalMovimientoAbierto, setModalMovimientoAbierto] = useState(false)

  const movimientosOrdenados = useMemo(() => otherMovements(movimientos), [movimientos])

  const openMovement = (movement) => {
    if (movement.isRefund) setDevolucionSeleccionada(movement.raw)
    else setComprobanteId(movement.raw.comprobante_id)
  }

  const scrollToSection = (id) => {
    const heading = document.getElementById(id)
    if (!heading) return
    heading.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  const summary = useMemo(() => {
    const period = currentPeriod()
    const dueUnpaidCuotas = cuotas.filter((cuota) => String(cuota.periodo) <= period && !isPaid(cuota))
    return {
      pendingCount: dueUnpaidCuotas.length,
      debt: dueUnpaidCuotas.reduce((sum, cuota) => sum + Number(cuota.saldo_pendiente ?? 0), 0),
      activeScholarships: becas ? becas.filter((beca) => isActiveScholarship(beca)).length : null,
    }
  }, [cuotas, becas])

  if (loading) {
    return <div className="py-16 flex flex-col items-center gap-3 text-on-surface-variant"><span className="material-symbols-outlined text-3xl animate-spin">progress_activity</span><p>Cargando estado de cuenta...</p></div>
  }

  if (error) {
    return <div className="bg-error-container text-on-error-container p-4 rounded-lg border border-error/30" role="alert">{error}</div>
  }

  if (!account) {
    return <SectionEmpty>Este socio todavía no tiene una cuenta corriente asociada.</SectionEmpty>
  }

  const title = `Cuenta Corriente ${formatNumber(account.cuenta_corriente_id)}`

  return (
    <section className="flex flex-col gap-6" aria-label={title}>
      <TabHeader
        title={title}
        description="Detalle de cuotas, pagos, ingresos, devoluciones y beneficios del socio."
        divider={false}
        actions={(
          <>
            <SecondaryButton icon="add_card" onClick={() => setModalMovimientoAbierto(true)}>
              Ingreso o devolución
            </SecondaryButton>
            <BenefitButton variant="neutral" onClick={() => openBenefit({ socioId, onSuccess: reloadFinances })}>
              Beca o descuento
            </BenefitButton>
            <PayButton onClick={() => openPayment({ socioId, onSuccess: reloadFinances })}>Pagar cuota</PayButton>
          </>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6">
        <StatCard label="Cuotas pendientes" value={summary.pendingCount} icon="pending_actions" tone={summary.pendingCount ? 'warning' : 'neutral'} onClick={() => scrollToSection('cuotas-title')} />
        <StatCard label="Saldo adeudado" value={formatAmount(summary.debt)} icon="account_balance" tone={summary.debt ? 'error' : 'neutral'} onClick={() => scrollToSection('cuotas-title')} />
        <StatCard label="Becas vigentes" value={summary.activeScholarships ?? '—'} icon="sell" tone="neutral" onClick={() => scrollToSection('beneficios-title')} />
      </div>

      <FlushSection id="cuotas-title" icon="receipt_long" title="Cuotas">
        {cuotas.length === 0 ? (
          <SectionEmpty>La cuenta corriente no tiene cuotas generadas.</SectionEmpty>
        ) : (
          <CuotasEstadoCuentaTable
            cuotas={cuotas}
            revertibleIds={account.cuotas_revertibles ?? []}
            onPay={(cuota) => openPayment({ socioId, cuotaIds: [cuota.cuota_id], onSuccess: reloadFinances })}
            onAssignBenefit={(cuota) => openBenefit({ socioId, cuotaId: cuota.cuota_id, onSuccess: reloadFinances })}
            onRevert={() => openReversal({ comprobanteId: account.comprobante_revertible_id, onChanged: reloadFinances })}
            onChanged={reloadFinances}
          />
        )}
      </FlushSection>

      <FlushSection id="otros-movimientos-title" icon="swap_horiz" title="Ingresos y devoluciones">
        {movimientos === null && (
          <SectionEmpty><span className="text-error" role="alert">No se pudieron cargar los ingresos y devoluciones del socio.</span></SectionEmpty>
        )}
        {movimientosOrdenados.length ? (
          <DataTable
            tableClassName="min-w-[760px]"
            headers={(
              <>
                <th className="py-3 px-4 w-[16%]" scope="col">Comprobante</th>
                <th className="py-3 px-4 w-[16%]" scope="col">Tipo</th>
                <th className="py-3 px-4 w-[14%]" scope="col">Fecha</th>
                <th className="py-3 px-4" scope="col">Concepto</th>
                <th className="py-3 px-4 w-[16%]" scope="col">Medio</th>
                <th className="py-3 px-4 w-[15%] text-right" scope="col">Monto</th>
              </>
            )}
          >
            {movimientosOrdenados.map((movement) => (
              <tr
                key={movement.key}
                tabIndex={0}
                role="button"
                onClick={() => openMovement(movement)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openMovement(movement)
                  }
                }}
                className="hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none transition-colors cursor-pointer"
              >
                <td className="py-3 px-4 font-bold text-primary whitespace-nowrap tabular-nums">{movement.codigo}</td>
                <td className="py-3 px-4">
                  <span className={`${BADGE_CLASS} ${movement.badge.className}`}>{movement.badge.label}</span>
                </td>
                <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(movement.fecha)}</td>
                <td className="py-3 px-4 text-on-surface font-medium break-words">{movement.concepto || '—'}</td>
                <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{movement.detalle}</td>
                <td
                  className={`py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                    movement.anulado ? 'text-outline line-through' : movement.isRefund ? 'text-error' : 'text-emerald-700'
                  }`}
                >
                  {movement.anulado ? '' : movement.isRefund ? '− ' : '+ '}{formatAmount(movement.monto)}
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          movimientos !== null && (
            <SectionEmpty>Sin ingresos ni devoluciones registrados. No modifican la deuda del socio.</SectionEmpty>
          )
        )}
      </FlushSection>

      <BenefitsTable becas={becas} cuotas={cuotas} onChanged={reloadFinances} className={FLUSH_END_CLASS} />

      <ComprobanteDetailModal
        comprobanteId={comprobanteId}
        opened={Boolean(comprobanteId)}
        onClose={() => setComprobanteId(null)}
        onChanged={reloadFinances}
      />

      <DevolucionDetailModal
        devolucion={devolucionSeleccionada}
        opened={Boolean(devolucionSeleccionada)}
        onClose={() => setDevolucionSeleccionada(null)}
      />

      <OtroMovimientoModal
        opened={modalMovimientoAbierto}
        initialSocio={socio}
        onClose={() => setModalMovimientoAbierto(false)}
        onSuccess={reloadFinances}
      />
    </section>
  )
}

function FinancialTab({ socio }) {
  const finances = useSocioFinances(socio.socio_id)
  return <FinancialStatement socio={socio} finances={finances} />
}

export default FinancialTab
