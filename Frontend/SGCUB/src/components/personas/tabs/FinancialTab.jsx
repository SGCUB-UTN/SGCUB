import { useMemo, useState } from 'react'
import { BenefitsTable } from '../../finanzas/BenefitTables'
import CuotasEstadoCuentaTable from '../../finanzas/CuotasEstadoCuentaTable'
import MovimientoManualDetailModal from '../../finanzas/MovimientoManualDetailModal'
import MovimientoManualModal from '../../finanzas/MovimientoManualModal'
import { isActiveScholarship, isPaid } from '../../finanzas/accountStatement'
import { formatAmount, formatDate, formatNumber } from '../format'
import { BenefitButton, PayButton } from '../HeaderPersona'
import DataTable from '../../shared/DataTable'
import StatCard from '../../shared/StatCard'
import { EmptyState, SecondaryButton, TabHeader } from './parts'
import useAssignBenefit from '../../../hooks/useAssignBenefit'
import useRegisterPayment from '../../../hooks/useRegisterPayment'
import useSocioFinances from '../../../hooks/useSocioFinances'

const TABLE_CLASS = 'border border-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm'
const BADGE_CLASS = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border whitespace-nowrap'

const MOVEMENT_BADGES = {
  IngresoManual: {
    label: 'Ingreso manual',
    prefix: 'X',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  Egreso: {
    label: 'Egreso de caja',
    prefix: 'EGR-X',
    className: 'bg-error/10 text-error border-error/20',
  },
  NotaCredito: {
    label: 'Nota de crédito',
    prefix: 'NC-X',
    className: 'bg-amber-50 text-amber-800 border-amber-200',
  },
}

// Renders finances already loaded with useSocioFinances, so the page can share them (e.g. for the tab badge)
export function FinancialStatement({ socio, finances }) {
  const { openPayment } = useRegisterPayment()
  const { openBenefit } = useAssignBenefit()
  const socioId = socio.socio_id
  const { loading, error, account, becas, movimientos, reload: reloadFinances } = finances
  const cuotas = useMemo(() => account?.cuotas ?? [], [account])
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null)
  const [modalManualAbierto, setModalManualAbierto] = useState(false)
  const [operacionManual, setOperacionManual] = useState('IngresoManual')

  const movimientosOrdenados = useMemo(
    () => [...(movimientos ?? [])].sort((a, b) => b.movimiento_cuenta_id - a.movimiento_cuenta_id),
    [movimientos],
  )

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
    activeScholarships: becas ? becas.filter((beca) => isActiveScholarship(beca)).length : null,
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

  const title = `Cuenta Corriente ${formatNumber(account.cuenta_corriente_id)}`

  return (
    <section className="flex flex-col gap-6" aria-label={title}>
      <TabHeader title={title} description="Detalle de cuotas, pagos, otros movimientos y beneficios del socio." divider={false} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 xl:gap-6">
        <StatCard label="Cuotas pendientes" value={summary.pendingCount} icon="pending_actions" tone={summary.pendingCount ? 'warning' : 'neutral'} onClick={() => scrollToSection('cuotas-title')} />
        <StatCard label="Saldo adeudado" value={formatAmount(summary.debt)} icon="account_balance" tone={summary.debt ? 'error' : 'neutral'} onClick={() => scrollToSection('cuotas-title')} />
        <StatCard label="Becas vigentes" value={summary.activeScholarships ?? '—'} icon="sell" tone="neutral" onClick={() => scrollToSection('beneficios-title')} />
      </div>

      <section className="flex flex-col gap-6 my-4" aria-labelledby="cuotas-title">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 id="cuotas-title" tabIndex="-1" className="text-lg font-bold text-on-surface scroll-mt-6 focus:outline-none">Cuotas</h3>
          <div className="flex flex-col sm:flex-row gap-2 [&>button]:justify-center">
            <SecondaryButton
              icon="add_card"
              onClick={() => {
                setOperacionManual('IngresoManual')
                setModalManualAbierto(true)
              }}
            >
              Otro movimiento
            </SecondaryButton>
            <BenefitButton variant="neutral" onClick={() => openBenefit({ socioId, onSuccess: reloadFinances })}>
              Beca o descuento
            </BenefitButton>
            <PayButton onClick={() => openPayment({ socioId, onSuccess: reloadFinances })}>Pagar cuota</PayButton>
          </div>
        </div>
        {cuotas.length === 0 ? (
          <EmptyState icon="receipt_long" title="Sin cuotas generadas" description="La cuenta corriente no tiene cuotas registradas." />
        ) : (
          <CuotasEstadoCuentaTable
            cuotas={cuotas}
            onPay={(cuota) => openPayment({ socioId, cuotaIds: [cuota.cuota_id], onSuccess: reloadFinances })}
            onAssignBenefit={(cuota) => openBenefit({ socioId, cuotaId: cuota.cuota_id, onSuccess: reloadFinances })}
            onChanged={reloadFinances}
          />
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="movimientos-manuales-title">
        <h3 id="movimientos-manuales-title" tabIndex="-1" className="text-lg font-bold text-on-surface py-2 scroll-mt-6 focus:outline-none">
          Otros movimientos de cuenta corriente
        </h3>
        {movimientos === null && (
          <p className="text-sm text-error" role="alert">No se pudieron cargar los movimientos manuales del socio.</p>
        )}
        {movimientosOrdenados.length ? (
          <DataTable
            className={TABLE_CLASS}
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
            {movimientosOrdenados.map((mov) => {
              const isAbono = mov.tipo_movimiento === 'Abono'
              const meta = MOVEMENT_BADGES[mov.origen_manual] ?? MOVEMENT_BADGES.IngresoManual
              const receiptNum = mov.numero_comprobante ?? mov.movimiento_cuenta_id
              return (
                <tr
                  key={mov.movimiento_cuenta_id}
                  tabIndex={0}
                  role="button"
                  onClick={() => setMovimientoSeleccionado(mov)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setMovimientoSeleccionado(mov)
                    }
                  }}
                  className="hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4 font-bold text-primary whitespace-nowrap tabular-nums">
                    {meta.prefix} #{receiptNum}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`${BADGE_CLASS} ${meta.className}`}>{meta.label}</span>
                  </td>
                  <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(mov.fecha)}</td>
                  <td className="py-3 px-4 text-on-surface font-medium break-words">{mov.concepto || '—'}</td>
                  <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">
                    {mov.medio_de_pago_nombre || mov.medio_de_pago || 'Cuenta corriente'}
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${isAbono ? 'text-emerald-700' : 'text-error'}`}>
                    {isAbono ? '+ ' : '− '}{formatAmount(mov.monto)}
                  </td>
                </tr>
              )
            })}
          </DataTable>
        ) : (
          movimientos !== null && (
            <p className="text-base text-on-surface-variant py-6 text-center border border-dashed border-outline-variant/40 rounded-xl">
              Sin otros movimientos registrados (ingresos manuales o egresos de caja).
            </p>
          )
        )}
      </section>

      <BenefitsTable becas={becas} cuotas={cuotas} onChanged={reloadFinances} />

      <MovimientoManualDetailModal
        movimiento={movimientoSeleccionado}
        movimientos={movimientosOrdenados}
        opened={Boolean(movimientoSeleccionado)}
        onClose={() => setMovimientoSeleccionado(null)}
        onSelectMovimiento={setMovimientoSeleccionado}
        onIssueCreditNote={() => {
          setMovimientoSeleccionado(null)
          setOperacionManual('Egreso')
          setModalManualAbierto(true)
        }}
      />

      <MovimientoManualModal
        opened={modalManualAbierto}
        initialSocio={socio}
        initialOperation={operacionManual}
        onClose={() => {
          setModalManualAbierto(false)
          setOperacionManual('IngresoManual')
        }}
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
