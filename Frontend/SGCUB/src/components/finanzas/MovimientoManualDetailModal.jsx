import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { formatAmount, formatDate, formatDni, formatNumber } from '../personas/format'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import { SummaryLine, TICKET_CLASS, TicketSection } from './formParts'

const ORIGIN_META = {
  IngresoManual: {
    label: 'Ingreso manual',
    headerLabel: 'Recibo de ingreso X',
    codePrefix: 'X',
    icon: 'add_card',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    iconBoxClass: 'bg-emerald-500/10 text-emerald-700',
    amountTone: 'text-emerald-700',
    totalLabel: 'Total percibido',
    downloadLabel: 'Descargar comprobante PDF',
  },
  Egreso: {
    label: 'Egreso de caja',
    headerLabel: 'Comprobante de egreso X',
    codePrefix: 'EGR-X',
    icon: 'payments',
    badgeClass: 'bg-error/10 text-error border-error/20',
    iconBoxClass: 'bg-error/10 text-error',
    amountTone: 'text-error',
    totalLabel: 'Total egresado',
    downloadLabel: 'Descargar comprobante PDF',
  },
  NotaCredito: {
    label: 'Nota de crédito',
    headerLabel: 'Nota de crédito X',
    codePrefix: 'NC-X',
    icon: 'assignment_return',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    iconBoxClass: 'bg-primary/10 text-primary',
    amountTone: 'text-primary',
    totalLabel: 'Total acreditado',
    downloadLabel: 'Descargar nota de crédito PDF',
  },
}

const METHOD_ICONS = {
  Efectivo: 'payments',
  Transferencia: 'account_balance',
  BilleteraVirtual: 'account_balance_wallet',
}

function splitConcept(rawConcept = '') {
  const parts = rawConcept.split(' · ')
  if (parts.length <= 1) {
    return { title: rawConcept || '—', detail: '' }
  }
  return {
    title: parts[0],
    detail: parts.slice(1).join(' · '),
  }
}

function MovimientoManualDetailModal({
  movimiento,
  movimientos = [],
  opened,
  onClose,
  onSelectMovimiento,
  onIssueCreditNote,
}) {
  const isMobile = useMediaQuery('(max-width: 640px)')

  if (!movimiento) return null

  const meta = ORIGIN_META[movimiento.origen_manual] ?? {
    label: movimiento.origen_manual_nombre || 'Movimiento manual',
    headerLabel: 'Comprobante de movimiento X',
    codePrefix: 'X',
    icon: 'swap_vert',
    badgeClass: 'bg-surface-container text-on-surface-variant border-outline-variant/40',
    iconBoxClass: 'bg-surface-container text-on-surface-variant',
    amountTone: 'text-on-surface',
    totalLabel: 'Importe total',
    downloadLabel: 'Descargar comprobante PDF',
  }

  const isAbono = movimiento.tipo_movimiento === 'Abono'
  const socio = movimiento.socio
  const { title: conceptTitle, detail: conceptDetail } = splitConcept(movimiento.concepto)
  const paymentMethodLabel = movimiento.medio_de_pago_nombre || movimiento.medio_de_pago || 'Ajuste en cuenta corriente'
  const receiptNumber = movimiento.numero_comprobante ?? movimiento.movimiento_cuenta_id
  const numeroLabel = `${meta.codePrefix} #${receiptNumber}`

  const reversedOrigin = movimiento.movimiento_revertido
    ? movimientos.find((item) => item.movimiento_cuenta_id === movimiento.movimiento_revertido) ?? null
    : null
  const reversedOriginNumber = reversedOrigin?.numero_comprobante ?? movimiento.movimiento_revertido

  const creditNoteChildren = movimientos.filter(
    (item) => item.movimiento_revertido === movimiento.movimiento_cuenta_id,
  )
  const creditNoteChild = creditNoteChildren[0] ?? null
  const creditNoteChildNumber = creditNoteChild
    ? (creditNoteChild.numero_comprobante ?? creditNoteChild.movimiento_cuenta_id)
    : null

  const reversedSum = creditNoteChildren.reduce((sum, item) => sum + Number(item.monto || 0), 0)
  const remainingReversible = movimiento.saldo_reversible != null
    ? Number(movimiento.saldo_reversible)
    : Math.max(0, Math.round((Number(movimiento.monto || 0) - reversedSum) * 100) / 100)

  const isRefundedByEgreso = creditNoteChild?.origen_manual === 'Egreso'

  const canIssueCreditNote = (
    movimiento.origen_manual === 'IngresoManual'
    && isAbono
    && remainingReversible > 0
    && Boolean(onIssueCreditNote)
  )

  const modalTitle = (
    <div className="flex items-center justify-between gap-4 min-w-0 pr-2">
      <div className="flex items-center gap-4 min-w-0">
        <span className="shrink-0 text-sm uppercase tracking-wider font-semibold text-primary">
          {meta.headerLabel}
        </span>
        {socio && (
          <>
            <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
            <p className="min-w-0 truncate text-base text-on-surface-variant">
              <span className="text-lg font-bold text-on-surface">{socio.apellido}, {socio.nombre}</span>
              {' '}(DNI {formatDni(socio.dni)} • Socio #{formatNumber(socio.numero_socio)})
            </p>
          </>
        )}
      </div>
      <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${meta.badgeClass}`}>
        {meta.label}
      </span>
    </div>
  )

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      aria-label="Detalle del movimiento de caja"
      title={modalTitle}
      styles={{ header: { gap: 16 }, title: { flex: 1, minWidth: 0 } }}
      size="min(980px, 95vw)"
      fullScreen={isMobile}
      centered
      padding="lg"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${meta.iconBoxClass}`}>
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">{meta.icon}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  {meta.headerLabel}
                </p>
                <p className="text-xl font-bold text-on-surface tabular-nums">{numeroLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-xs text-on-surface-variant">Fecha de emisión</p>
                <p className="font-semibold text-on-surface tabular-nums">{formatDate(movimiento.fecha)}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Impacto contable</p>
                <p className={`font-semibold ${meta.amountTone}`}>
                  {isAbono ? 'Abono (Ingreso)' : 'Cargo (Salida / Devolución)'}
                </p>
              </div>
            </div>
          </div>

          <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
            <div className="px-3.5 py-2.5 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between">
              <h3 className="font-semibold text-on-surface">Concepto y detalle de la operación</h3>
              <span className="text-xs font-semibold text-on-surface-variant">Cuenta corriente</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex flex-col gap-1">
                  <p className="text-base font-bold text-on-surface break-words">{conceptTitle}</p>
                  {conceptDetail && (
                    <p className="text-sm text-on-surface-variant break-words">{conceptDetail}</p>
                  )}
                </div>
                <strong className={`text-base font-bold tabular-nums shrink-0 ${meta.amountTone}`}>
                  {isAbono ? '+ ' : '− '}{formatAmount(movimiento.monto)}
                </strong>
              </div>
            </div>
          </section>

          <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
            <div className="px-3.5 py-2.5 bg-surface-container-low border-b border-outline-variant/30">
              <h3 className="font-semibold text-on-surface">Medio de operación</h3>
            </div>
            <div className="flex items-center justify-between px-3.5 py-3 text-sm">
              <span className="inline-flex items-center gap-2 text-on-surface font-medium">
                <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
                  {METHOD_ICONS[movimiento.medio_de_pago] ?? 'account_balance_wallet'}
                </span>
                {paymentMethodLabel}
              </span>
              <strong className="text-on-surface tabular-nums">{formatAmount(movimiento.monto)}</strong>
            </div>
          </section>

          {movimiento.movimiento_revertido && (
            <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-0.5">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  Ingreso original revertido
                </p>
                <p className="text-sm font-bold text-on-surface break-words">
                  Recibo X #{reversedOriginNumber}
                  {reversedOrigin ? ` · ${reversedOrigin.concepto}` : ''}
                </p>
                {reversedOrigin && (
                  <p className="text-xs text-on-surface-variant">
                    Importe original: {formatAmount(reversedOrigin.monto)} • Fecha: {formatDate(reversedOrigin.fecha)}
                  </p>
                )}
              </div>
              {reversedOrigin && onSelectMovimiento && (
                <button
                  type="button"
                  onClick={() => onSelectMovimiento(reversedOrigin)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/40 bg-white text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">open_in_new</span>
                  Ver original
                </button>
              )}
            </div>
          )}

          {creditNoteChild && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex flex-col gap-0.5">
                <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  {isRefundedByEgreso ? 'Excedente devuelto por Egreso de Caja' : 'Revertido por Nota de Crédito'}
                </p>
                <p className="text-sm font-bold text-on-surface">
                  {isRefundedByEgreso ? 'EGR-X' : 'NC-X'} #{creditNoteChildNumber} · {formatAmount(creditNoteChild.monto)}
                </p>
                <p className="text-xs text-on-surface-variant break-words">{creditNoteChild.concepto}</p>
              </div>
              {onSelectMovimiento && (
                <button
                  type="button"
                  onClick={() => onSelectMovimiento(creditNoteChild)}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-600/40 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">receipt_long</span>
                  {isRefundedByEgreso ? 'Ver comprobante de egreso' : 'Ver nota de crédito'}
                </button>
              )}
            </div>
          )}
        </div>

        <aside
          className={`${TICKET_CLASS} lg:sticky lg:top-4`}
          aria-label="Resumen tipo ticket del movimiento"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-on-surface">Resumen del ticket</h3>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 tabular-nums">
              {numeroLabel}
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-between gap-3">
            <TicketSection title="Comprobante">
              <SummaryLine label="Comprobante N°" value={`#${receiptNumber}`} />
              <SummaryLine label="Operación" value={meta.label} />
              <SummaryLine label="Fecha" value={formatDate(movimiento.fecha)} />
              <SummaryLine
                label="Asiento"
                value={isAbono ? 'Abono a favor' : 'Cargo en cuenta'}
                valueClassName={meta.amountTone}
              />
            </TicketSection>

            <TicketSection title="Liquidación">
              <SummaryLine
                label="Socio"
                value={socio ? `#${formatNumber(socio.numero_socio)}` : '—'}
              />
              <SummaryLine label="Medio" value={paymentMethodLabel} />
              {movimiento.movimiento_revertido && (
                <SummaryLine label="Revierte a" value={`X #${reversedOriginNumber}`} />
              )}
              {creditNoteChild && (
                <SummaryLine
                  label="Estado"
                  value={isRefundedByEgreso ? `Devuelto (EGR-X #${creditNoteChildNumber})` : `Revertido (NC-X #${creditNoteChildNumber})`}
                  valueClassName="text-amber-800"
                />
              )}
            </TicketSection>

            <div className="flex flex-col gap-1 pt-1">
              <SummaryLine
                label={meta.totalLabel}
                value={`${isAbono ? '+ ' : '− '}${formatAmount(movimiento.monto)}`}
                isTotal
                valueClassName={meta.amountTone}
              />
              <p className="text-xs text-on-surface-variant">
                {movimiento.origen_manual === 'NotaCredito'
                  ? 'Comprobante de nota de crédito sobre un ingreso registrado en cuenta corriente.'
                  : isAbono
                    ? 'Acredita fondos a favor en la cuenta corriente del socio.'
                    : 'Registra la salida de fondos en la cuenta corriente del socio.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-200">
            <DownloadComprobanteButtom
              movimientoId={movimiento.movimiento_cuenta_id}
              variant="primary"
              fullWidth
              label={meta.downloadLabel}
            />

            {canIssueCreditNote && (
              <button
                type="button"
                onClick={() => onIssueCreditNote(movimiento)}
                className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 border border-outline-variant/60 bg-white rounded text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">payments</span>
                Registrar devolución / egreso
              </button>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  )
}

export default MovimientoManualDetailModal

