import { Modal } from '@mantine/core'
import { formatAmount, formatDate, formatDni, formatNumber } from '../personas/format'

const ORIGIN_META = {
  IngresoManual: {
    label: 'Ingreso manual',
    icon: 'add_card',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    amountTone: 'text-emerald-700',
  },
  Egreso: {
    label: 'Egreso de caja',
    icon: 'payments',
    badgeClass: 'bg-error/10 text-error border-error/20',
    amountTone: 'text-error',
  },
  NotaCredito: {
    label: 'Nota de crédito',
    icon: 'assignment_return',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    amountTone: 'text-primary',
  },
}

function MovimientoManualDetailModal({
  movimiento,
  movimientos = [],
  opened,
  onClose,
  onSelectMovimiento,
  onIssueCreditNote,
}) {
  if (!movimiento) return null

  const meta = ORIGIN_META[movimiento.origen_manual] ?? {
    label: movimiento.origen_manual_nombre || 'Movimiento manual',
    icon: 'swap_vert',
    badgeClass: 'bg-surface-container text-on-surface-variant border-outline-variant/40',
    amountTone: 'text-on-surface',
  }

  const isAbono = movimiento.tipo_movimiento === 'Abono'
  const socio = movimiento.socio

  const reversedOrigin = movimiento.movimiento_revertido
    ? movimientos.find((item) => item.movimiento_cuenta_id === movimiento.movimiento_revertido) ?? null
    : null

  const creditNoteChild = movimientos.find(
    (item) => item.movimiento_revertido === movimiento.movimiento_cuenta_id,
  ) ?? null

  const canIssueCreditNote = (
    movimiento.origen_manual === 'IngresoManual'
    && isAbono
    && !creditNoteChild
    && Boolean(onIssueCreditNote)
  )

  return (
    <Modal opened={opened} onClose={onClose} title="Detalle del movimiento de caja" centered size="md">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
          <div className="flex items-center gap-3 min-w-0">
            <span className="material-symbols-outlined text-primary text-3xl shrink-0" aria-hidden="true">
              {meta.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm text-on-surface-variant">Movimiento de cuenta</p>
              <p className="text-xl font-bold text-on-surface">#{movimiento.movimiento_cuenta_id}</p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${meta.badgeClass}`}>
            {meta.label}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <dt className="text-sm text-on-surface-variant">Fecha de registro</dt>
            <dd className="font-semibold text-on-surface">{formatDate(movimiento.fecha)}</dd>
          </div>
          <div>
            <dt className="text-sm text-on-surface-variant">Impacto contable</dt>
            <dd className="font-semibold text-on-surface">
              {isAbono ? 'Abono (Ingreso)' : 'Cargo (Salida / Devolución)'}
            </dd>
          </div>
          <div className="col-span-2 p-3 rounded-lg bg-surface-container-low flex items-baseline justify-between gap-3">
            <dt className="text-sm text-on-surface-variant">Importe del movimiento</dt>
            <dd className={`text-2xl font-bold tabular-nums ${meta.amountTone}`}>
              {isAbono ? '+ ' : '− '}{formatAmount(movimiento.monto)}
            </dd>
          </div>
        </dl>

        {socio && (
          <div className="p-3 rounded-lg bg-surface-container-low">
            <p className="text-sm text-on-surface-variant">Socio asociado</p>
            <p className="font-semibold text-on-surface">
              {socio.apellido}, {socio.nombre} · DNI {formatDni(socio.dni)} · Socio N° {formatNumber(socio.numero_socio)}
            </p>
          </div>
        )}

        <div className="p-3 rounded-lg bg-surface-container-low flex flex-col gap-2">
          <div>
            <p className="text-sm text-on-surface-variant">Concepto y detalle</p>
            <p className="font-semibold text-on-surface break-words">{movimiento.concepto || '—'}</p>
          </div>
          <div className="pt-2 border-t border-outline-variant/20 flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">Medio de pago</span>
            <strong className="text-on-surface">
              {movimiento.medio_de_pago_nombre || movimiento.medio_de_pago || 'Ajuste en cuenta corriente'}
            </strong>
          </div>
        </div>

        {movimiento.movimiento_revertido && (
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Ingreso original revertido</p>
              <p className="text-sm font-semibold text-on-surface truncate">
                Movimiento #{movimiento.movimiento_revertido}
                {reversedOrigin ? ` · ${reversedOrigin.concepto}` : ''}
              </p>
              {reversedOrigin && (
                <p className="text-xs text-on-surface-variant">
                  Importe original: {formatAmount(reversedOrigin.monto)} ({formatDate(reversedOrigin.fecha)})
                </p>
              )}
            </div>
            {reversedOrigin && onSelectMovimiento && (
              <button
                type="button"
                onClick={() => onSelectMovimiento(reversedOrigin)}
                className="shrink-0 px-3 py-1.5 rounded-md border border-primary/40 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                Ver original
              </button>
            )}
          </div>
        )}

        {creditNoteChild && (
          <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Revertido por Nota de Crédito</p>
              <p className="text-sm font-semibold text-on-surface truncate">
                Movimiento #{creditNoteChild.movimiento_cuenta_id} · {formatAmount(creditNoteChild.monto)}
              </p>
              <p className="text-xs text-on-surface-variant">{creditNoteChild.concepto}</p>
            </div>
            {onSelectMovimiento && (
              <button
                type="button"
                onClick={() => onSelectMovimiento(creditNoteChild)}
                className="shrink-0 px-3 py-1.5 rounded-md border border-amber-600/40 text-xs font-semibold text-amber-900 hover:bg-amber-500/20 transition-colors cursor-pointer"
              >
                Ver nota de crédito
              </button>
            )}
          </div>
        )}

        {canIssueCreditNote && (
          <div className="pt-3 border-t border-outline-variant/30 flex justify-end">
            <button
              type="button"
              onClick={() => onIssueCreditNote(movimiento)}
              className="inline-flex items-center gap-2 h-10 px-4 border border-primary/40 rounded-md font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">assignment_return</span>
              Emitir nota de crédito
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default MovimientoManualDetailModal

