import { useMemo, useState } from 'react'
import { BenefitsTable } from '../../finanzas/BenefitTables'
import ComprobanteDetailModal from '../../finanzas/ComprobanteDetailModal'
import CuotasEstadoCuentaTable from '../../finanzas/CuotasEstadoCuentaTable'
import DevolucionDetailModal from '../../finanzas/DevolucionDetailModal'
import OtroMovimientoModal from '../../finanzas/OtroMovimientoModal'
import { isActiveScholarship, isPaid } from '../../finanzas/accountStatement'
import { formatAmount, formatDate } from '../format'
import { BenefitButton } from '../HeaderPersona'
import DataTable from '../../shared/DataTable'
import { SectionEmpty } from '../../shared/FlushSection'
import { INSET_PADDING_X_CLASS } from '../../shared/flushTable'
import { currentPeriod } from '../../shared/periodFormat'
import { KpiColumn, KpiGrid } from '../../shared/Kpi'
import { formatCount, formatMoney, formatWholeMoney } from '../../cuota/cuotaPeriod'
import { SecondaryButton, TabHeader } from './parts'
import useAssignBenefit from '../../../hooks/useAssignBenefit'
import useRegisterPayment from '../../../hooks/useRegisterPayment'
import useRevertPayment from '../../../hooks/useRevertPayment'
import useSocioFinances from '../../../hooks/useSocioFinances'

const BADGE_CLASS = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap'

const CUOTAS = 'cuotas'
const MOVEMENTS = 'movimientos'
const BENEFITS = 'beneficios'

const SECTIONS = [
  { value: CUOTAS, id: 'cuotas-title', icon: 'receipt_long', title: 'Cuotas' },
  { value: MOVEMENTS, id: 'otros-movimientos-title', icon: 'swap_horiz', title: 'Ingresos y devoluciones' },
  { value: BENEFITS, id: 'beneficios-title', icon: 'sell', title: 'Becas y descuentos' },
]

const PANEL_ID = 'financial-section-panel'

function PanelFooter({ children }) {
  return (
    <div className={`flex flex-wrap justify-end gap-2 py-3 border-t border-outline-variant/30 bg-surface-container-low/40 ${INSET_PADDING_X_CLASS}`}>
      {children}
    </div>
  )
}

function SectionTabs({ value, onChange }) {
  return (
    <div role="tablist" aria-label="Secciones de la cuenta corriente" className="flex gap-1 p-1.5 mt-6 overflow-x-auto rounded-t-xl bg-surface-container border border-outline-variant/30">
      {SECTIONS.map((section) => {
        const active = section.value === value
        return (
          <button
            key={section.value}
            id={section.id}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={PANEL_ID}
            onClick={() => onChange(section.value)}
            className={`flex-1 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-lg text-base font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${active ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'}`}
          >
            <span className={`material-symbols-outlined ${active ? 'text-primary' : 'text-outline'}`} style={{ fontSize: 20 }} aria-hidden="true">{section.icon}</span>
            {section.title}
          </button>
        )
      })}
    </div>
  )
}

const MOVEMENT_BADGES = {
  Ingreso: { label: 'Ingreso', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  IngresoAnulado: { label: 'Ingreso anulado', className: 'bg-error-container text-on-error-container border-error/20' },
  Manual: { label: 'Devolución manual', className: 'bg-error/10 text-error border-error/20' },
  NotaCredito: { label: 'Nota de crédito', className: 'bg-amber-50 text-amber-800 border-amber-200' },
}

const reversalFor = (account, cuota, onChanged) => {
  const settlement = account.saldo_beneficio_revertible
  if (settlement?.cuota_id !== cuota.cuota_id) return { comprobanteId: account.comprobante_revertible_id, onChanged }
  const item = cuota.items.find((candidate) => candidate.item_cuota_id === settlement.item_cuota_id)
  return { settlement: { cuota, item }, onChanged }
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

function MovementsTable({ movimientos, movements, onOpen }) {
  return (
    <>
      {movimientos === null && (
        <SectionEmpty><span className="text-error" role="alert">No se pudieron cargar los ingresos y devoluciones del socio.</span></SectionEmpty>
      )}
      {movements.length ? (
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
          {movements.map((movement) => (
            <tr
              key={movement.key}
              tabIndex={0}
              role="button"
              onClick={() => onOpen(movement)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onOpen(movement)
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
    </>
  )
}

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
  const [activeSection, setActiveSection] = useState(CUOTAS)

  const movimientosOrdenados = useMemo(() => otherMovements(movimientos), [movimientos])

  const openMovement = (movement) => {
    if (movement.isRefund) setDevolucionSeleccionada(movement.raw)
    else setComprobanteId(movement.raw.comprobante_id)
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

  return (
    <section className="flex flex-col gap-6" aria-label="Resumen de cuenta">
      <TabHeader
        title="Resumen de cuenta"
        description="Detalle de la situación financiera del socio."
      />

      <KpiGrid columns={3} className={`py-5 border-b border-surface-container ${INSET_PADDING_X_CLASS}`}>
        <KpiColumn
          label="Cuotas pendientes"
          value={formatCount(summary.pendingCount)}
          tone={summary.pendingCount ? 'text-amber-700' : 'text-on-surface'}
        />
        <KpiColumn
          label="Saldo adeudado"
          value={formatWholeMoney(summary.debt)}
          title={formatMoney(summary.debt)}
          tone={summary.debt ? 'text-error' : 'text-on-surface'}
        />
        <KpiColumn
          label="Becas vigentes"
          value={summary.activeScholarships == null ? '—' : formatCount(summary.activeScholarships)}
        />
      </KpiGrid>
      <SectionTabs value={activeSection} onChange={setActiveSection} />

      <div className="min-w-0 overflow-hidden rounded-b-xl border-x border-b border-outline-variant/30 bg-surface-container-lowest">
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={SECTIONS.find((section) => section.value === activeSection).id}>
          {activeSection === CUOTAS && (cuotas.length === 0 ? (
            <SectionEmpty>La cuenta corriente no tiene cuotas generadas.</SectionEmpty>
          ) : (
            <CuotasEstadoCuentaTable
              cuotas={cuotas}
              revertibleIds={account.cuotas_revertibles ?? []}
              settlementCuotaId={account.saldo_beneficio_revertible?.cuota_id ?? null}
              onPay={(cuota) => openPayment({ socioId, cuotaIds: [cuota.cuota_id], onSuccess: reloadFinances })}
              onAssignBenefit={(cuota) => openBenefit({ socioId, cuotaId: cuota.cuota_id, onSuccess: reloadFinances })}
              onRevert={(cuota) => openReversal(reversalFor(account, cuota, reloadFinances))}
              onChanged={reloadFinances}
            />
          ))}
          {activeSection === MOVEMENTS && (
            <>
              <MovementsTable movimientos={movimientos} movements={movimientosOrdenados} onOpen={openMovement} />
              <PanelFooter>
                <SecondaryButton icon="add_card" onClick={() => setModalMovimientoAbierto(true)}>
                  Agregar ingreso o devolución
                </SecondaryButton>
              </PanelFooter>
            </>
          )}
          {activeSection === BENEFITS && (
            <>
              <BenefitsTable becas={becas} cuotas={cuotas} onChanged={reloadFinances} />
              <PanelFooter>
                <BenefitButton variant="neutral" onClick={() => openBenefit({ socioId, onSuccess: reloadFinances })}>
                  Agregar beca o descuento
                </BenefitButton>
              </PanelFooter>
            </>
          )}
        </div>
      </div>

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
