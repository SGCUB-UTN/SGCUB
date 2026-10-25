import { useEffect, useState } from 'react'
import { descargarComprobantePdf, getComprobante, getComprobantesByCuota } from '../../api/comprobantes'
import { descargarMovimientoPdf } from '../../api/movimientos'
import { formatAmount, formatDate } from '../personas/format'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import ComprobanteDetailModal from './ComprobanteDetailModal'
import MovimientoManualDetailModal from './MovimientoManualDetailModal'
import RemoveCuotaItemModal, { RemoveItemButton } from './CuotaItemRemoval'
import { SUMMARY_GROUP_CLASS } from './formParts'
import { isPaid } from './accountStatement'
import { isAdjustment, itemLabel, itemTone, removalBlocker } from './cuotaItems'

const CARD_CLASS = 'rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm'

const CARD_TITLE_CLASS = `${SUMMARY_GROUP_CLASS} mb-0`

const ICON_BUTTON_CLASS = 'w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

const isAnnulled = (comprobante) => comprobante.estado === 'Anulado'

const PAID_HINT = 'La cuota ya está paga'

const sumItems = (items) => items.reduce((total, item) => total + Number(item.monto ?? 0) * (item.es_descuento ? -1 : 1), 0)

function ReceiptRow({ comprobante, onOpen, onEdit }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')
  const annulled = isAnnulled(comprobante)

  const download = async () => {
    setDownloading(true)
    setError('')
    try {
      await descargarComprobantePdf(comprobante.comprobante_id)
    } catch {
      setError('No se pudo descargar el comprobante.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <li className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-[22px] shrink-0 ${annulled ? 'text-outline' : 'text-primary'}`} aria-hidden="true">receipt_long</span>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-base font-semibold ${annulled ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>Comprobante #{comprobante.numero}</span>
            {annulled && (
              <span className="px-2 py-0.5 rounded text-xs font-bold border bg-error-container text-on-error-container border-error/20">
                {comprobante.estado}
              </span>
            )}
          </div>
          <span className="text-sm text-on-surface-variant">
            {formatDate(comprobante.fecha_emision)} · <span className="font-semibold text-on-surface">{formatAmount(comprobante.monto_total)}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => onOpen(comprobante)} title="Ver detalle" aria-label={`Ver comprobante ${comprobante.numero}`} className={ICON_BUTTON_CLASS}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
          </button>
          {!annulled && onEdit && (
            <button type="button" onClick={() => onEdit(comprobante)} title="Editar pago o cuota" aria-label={`Editar comprobante ${comprobante.numero}`} className={ICON_BUTTON_CLASS}>
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit_note</span>
            </button>
          )}
          <button type="button" onClick={download} disabled={downloading} title="Descargar PDF" aria-label={`Descargar comprobante ${comprobante.numero}`} className={ICON_BUTTON_CLASS}>
            <span className={`material-symbols-outlined text-[20px] ${downloading ? 'animate-spin' : ''}`} aria-hidden="true">{downloading ? 'progress_activity' : 'download'}</span>
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-error pl-9" role="alert">{error}</p>}
    </li>
  )
}

function CreditNoteRow({ creditNote, onOpen }) {
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  const download = async () => {
    setDownloading(true)
    setError('')
    try {
      await descargarMovimientoPdf(creditNote.movimiento_cuenta_id)
    } catch {
      setError('No se pudo descargar la nota de crédito.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <li className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[22px] shrink-0 text-amber-700" aria-hidden="true">
          receipt_long
        </span>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-base font-semibold text-on-surface truncate">
            Nota de Crédito #{creditNote.numero_comprobante}
          </span>
          <span className="text-sm text-on-surface-variant">
            {formatDate(creditNote.fecha)} · <span className="font-semibold text-on-surface tabular-nums">−{formatAmount(creditNote.monto)}</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpen && (
            <button
              type="button"
              onClick={() => onOpen(creditNote)}
              title="Ver detalle"
              aria-label={`Ver nota de crédito ${creditNote.numero_comprobante}`}
              className={ICON_BUTTON_CLASS}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">visibility</span>
            </button>
          )}
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            title="Descargar PDF"
            aria-label={`Descargar nota de crédito ${creditNote.numero_comprobante}`}
            className={ICON_BUTTON_CLASS}
          >
            <span className={`material-symbols-outlined text-[20px] ${downloading ? 'animate-spin' : ''}`} aria-hidden="true">
              {downloading ? 'progress_activity' : 'download'}
            </span>
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-error pl-9" role="alert">{error}</p>}
    </li>
  )
}

function ConceptLine({ label, detail, value, className = 'text-on-surface', action = null }) {
  return (
    <div className={`flex items-center justify-between gap-3 py-2 border-b border-outline-variant/20 ${className}`}>
      <div className="flex flex-col min-w-0">
        <span>{label}</span>
        {detail && <span className="text-sm text-on-surface-variant truncate" title={detail}>{detail}</span>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="tabular-nums whitespace-nowrap">{value}</span>
        <span className="w-6 shrink-0">{action}</span>
      </div>
    </div>
  )
}

function DueDatesBar({ cuota }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 rounded-md bg-surface-container-low/70 border border-outline-variant/20 text-sm text-on-surface-variant">
      <span>1° Vencimiento: <span className="font-semibold text-on-surface">{formatDate(cuota.fecha_venc1)}</span></span>
      <span className="text-outline-variant" aria-hidden="true">|</span>
      <span>2° Vencimiento: <span className="font-semibold text-on-surface">{formatDate(cuota.fecha_venc2)}</span></span>
    </div>
  )
}

function ConceptsCard({ cuota, onRemove }) {
  const items = cuota.items ?? []
  const charges = items.filter((item) => !isAdjustment(item))
  const adjustments = items.filter(isAdjustment)
  const creditNotes = cuota.notas_credito ?? []
  const totalOriginal = Number(cuota.monto_total ?? 0)
  const ncDiscount = Number(cuota.monto_nota_credito ?? 0)
  const netTotal = cuota.monto_neto != null ? Number(cuota.monto_neto) : Math.max(0, totalOriginal - ncDiscount)
  const hasPaidNc = creditNotes.length > 0 && netTotal < totalOriginal

  return (
    <div className={`${CARD_CLASS} flex flex-col gap-3 p-4 h-full`} role="region" aria-label="Detalle de conceptos">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h4 className={CARD_TITLE_CLASS}>Detalle de conceptos</h4>
        <DueDatesBar cuota={cuota} />
      </div>
      <div className="flex flex-col text-base">
        {charges.map((item) => (
          <ConceptLine key={item.item_cuota_id} label={itemLabel(item)} value={formatAmount(Number(item.monto ?? 0))} />
        ))}
        {(adjustments.length > 0 || hasPaidNc) && (
          <>
            <ConceptLine label="Subtotal" value={formatAmount(sumItems(charges))} className="font-semibold text-on-surface" />
            {adjustments.map((item) => {
              const tone = itemTone(item)
              const blocker = onRemove ? removalBlocker(cuota, item) : null
              return (
                <ConceptLine
                  key={item.item_cuota_id}
                  label={itemLabel(item)}
                  detail={item.es_descuento ? item.motivo : ''}
                  value={`${tone.sign}${formatAmount(Number(item.monto ?? 0))}`}
                  className={tone.className}
                  action={blocker === null ? null : (
                    <RemoveItemButton label={`Remover ${itemLabel(item)}`} blocker={blocker} onClick={() => onRemove(item)} />
                  )}
                />
              )
            })}
            {hasPaidNc && creditNotes.map((nc) => (
              <ConceptLine
                key={`nc-${nc.movimiento_cuenta_id}`}
                label={`Nota de Crédito NC-X #${nc.numero_comprobante}`}
                detail={nc.concepto}
                value={`− ${formatAmount(Number(nc.monto ?? 0))}`}
                className="text-emerald-700 font-medium"
              />
            ))}
          </>
        )}
      </div>
      <div className="mt-auto flex items-baseline justify-between gap-3 pt-1 text-base font-bold text-on-surface">
        <span className="uppercase tracking-wider text-sm">{hasPaidNc ? 'Total neto final' : 'Total calculado'}</span>
        <span className="tabular-nums whitespace-nowrap pr-[30px]">{formatAmount(hasPaidNc ? netTotal : totalOriginal)}</span>
      </div>
    </div>
  )
}

function SummaryRow({ label, value, className = 'text-on-surface' }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className}`}>
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )
}

function PaymentSummaryCard({ cuota, onPay, onAssignBenefit, activeReceipt, onEditPaidReceipt }) {
  const paid = isPaid(cuota)
  const pending = Number(cuota.saldo_pendiente ?? 0)
  const payable = !paid && pending > 0
  const totalOriginal = Number(cuota.monto_total ?? 0)
  const ncDiscount = Number(cuota.monto_nota_credito ?? 0)
  const netTotal = cuota.monto_neto != null ? Number(cuota.monto_neto) : Math.max(0, totalOriginal - ncDiscount)
  const hasNcDiscount = ncDiscount > 0 && netTotal < totalOriginal

  return (
    <div className={`${CARD_CLASS} flex flex-col gap-3 p-4`} role="region" aria-label="Resumen de pago">
      <h4 className={CARD_TITLE_CLASS}>Resumen de pago</h4>
      <div className="flex flex-col gap-1.5 text-base">
        <SummaryRow label={hasNcDiscount ? 'Total original cuota' : 'Total cuota'} value={formatAmount(totalOriginal)} />
        {hasNcDiscount && (
          <>
            <SummaryRow label="Nota de Crédito (NC-X)" value={`− ${formatAmount(ncDiscount)}`} className="text-emerald-700 font-medium" />
            <SummaryRow label="Total neto final" value={formatAmount(netTotal)} className="font-bold text-on-surface" />
          </>
        )}
        <SummaryRow label="Pagado" value={formatAmount(Number(cuota.monto_pagado ?? 0))} />
        <div className="pt-2 mt-0.5 border-t border-outline-variant/30">
          {payable ? (
            <SummaryRow label="Pendiente" value={formatAmount(pending)} className="font-bold text-error" />
          ) : (
            <p className="flex items-center gap-1.5 font-semibold text-emerald-700">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">task_alt</span>
              Cuota pagada
            </p>
          )}
        </div>
      </div>
      {(onPay || onAssignBenefit || (paid && activeReceipt && onEditPaidReceipt)) && (
        <div className="flex flex-col gap-2 [&>button]:justify-center">
          {onPay && payable && (
            <PrimaryButton icon="payments" onClick={() => onPay(cuota)}>
              {`Pagar · ${formatAmount(pending)}`}
            </PrimaryButton>
          )}
          {paid && activeReceipt && onEditPaidReceipt && (
            <SecondaryButton icon="edit_note" onClick={() => onEditPaidReceipt(activeReceipt)}>
              Editar pago / cuota
            </SecondaryButton>
          )}
          {onAssignBenefit && (
            <SecondaryButton icon="sell" onClick={() => onAssignBenefit(cuota)} disabled={paid} title={paid ? PAID_HINT : undefined}>
              Agregar descuento
            </SecondaryButton>
          )}
        </div>
      )}
    </div>
  )
}

function ReceiptsCard({ receipts, creditNotes = [], onOpen, onEdit, onOpenCreditNote }) {
  const hasItems = (receipts.items?.length ?? 0) > 0 || creditNotes.length > 0
  return (
    <div className={`${CARD_CLASS} flex flex-col gap-2 p-4 min-w-0`} role="region" aria-label="Comprobantes asociados">
      <h4 className={CARD_TITLE_CLASS}>Comprobantes asociados</h4>
      {receipts.loading && (
        <p className="flex items-center gap-2 text-base text-on-surface-variant" role="status">
          <span className="material-symbols-outlined text-[20px] animate-spin" aria-hidden="true">progress_activity</span>
          Cargando comprobantes...
        </p>
      )}
      {receipts.error && <p className="text-sm text-error" role="alert">{receipts.error}</p>}
      {!receipts.loading && !receipts.error && (hasItems ? (
        <ul className="flex flex-col divide-y divide-outline-variant/20">
          {receipts.items.map((comprobante) => (
            <ReceiptRow
              key={comprobante.comprobante_id}
              comprobante={comprobante}
              onOpen={onOpen}
              onEdit={onEdit}
            />
          ))}
          {creditNotes.map((nc) => (
            <CreditNoteRow
              key={nc.movimiento_cuenta_id}
              creditNote={nc}
              onOpen={onOpenCreditNote}
            />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-base text-on-surface-variant">
          <span className="material-symbols-outlined text-[20px] text-outline" aria-hidden="true">receipt</span>
          Sin comprobantes
        </p>
      ))}
    </div>
  )
}

function CuotaDetailPanel({ cuota, colSpan, onPay, onAssignBenefit, onChanged }) {
  const [receipts, setReceipts] = useState({ loading: true, error: '', items: [] })
  const [selected, setSelected] = useState(null)
  const [selectedCreditNote, setSelectedCreditNote] = useState(null)
  const [openInEditMode, setOpenInEditMode] = useState(false)
  const [detail, setDetail] = useState({ loading: false, error: null, data: null })
  const [removing, setRemoving] = useState(null)

  const loadReceipts = async () => {
    setReceipts((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      const items = await getComprobantesByCuota(cuota.cuota_id)
      setReceipts({ loading: false, error: '', items: items ?? [] })
    } catch {
      setReceipts({ loading: false, error: 'No se pudieron cargar los comprobantes.', items: [] })
    }
  }

  useEffect(() => {
    let active = true
    getComprobantesByCuota(cuota.cuota_id)
      .then((items) => active && setReceipts({ loading: false, error: '', items: items ?? [] }))
      .catch(() => active && setReceipts({ loading: false, error: 'No se pudieron cargar los comprobantes.', items: [] }))
    return () => { active = false }
  }, [cuota.cuota_id])

  const openReceipt = async (comprobante, editMode = false) => {
    setSelected(comprobante)
    setOpenInEditMode(editMode)
    setDetail({ loading: true, error: null, data: null })
    try {
      setDetail({ loading: false, error: null, data: await getComprobante(comprobante.comprobante_id) })
    } catch {
      setDetail({ loading: false, error: 'No se pudo cargar el detalle.', data: null })
    }
  }

  const activeReceipt = receipts.items.find((item) => !isAnnulled(item)) ?? null

  return (
    <tr className="bg-surface-container-low/60">
      <td colSpan={colSpan} className="px-4 py-4 border-l-4 border-primary">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 min-w-0">
            <ConceptsCard cuota={cuota} onRemove={onChanged ? setRemoving : undefined} />
          </div>
          <div className="flex flex-col gap-4 min-w-0">
            <ReceiptsCard
              receipts={receipts}
              creditNotes={cuota.notas_credito ?? []}
              onOpen={(comp) => openReceipt(comp, false)}
              onEdit={(comp) => openReceipt(comp, true)}
              onOpenCreditNote={(nc) => setSelectedCreditNote({ ...nc, socio: cuota.socio })}
            />
            <PaymentSummaryCard
              cuota={cuota}
              onPay={onPay}
              onAssignBenefit={onAssignBenefit}
              activeReceipt={activeReceipt}
              onEditPaidReceipt={(comp) => openReceipt(comp, true)}
            />
          </div>
        </div>

        <ComprobanteDetailModal
          comprobante={selected}
          detalle={detail.data}
          loading={detail.loading}
          error={detail.error}
          opened={Boolean(selected)}
          initialEditMode={openInEditMode}
          onClose={() => {
            setSelected(null)
            setOpenInEditMode(false)
          }}
          onAmended={async ({ replacementComprobante } = {}) => {
            await loadReceipts()
            onChanged?.()
            const target = replacementComprobante ?? selected
            if (target?.comprobante_id) {
              try {
                const updated = await getComprobante(target.comprobante_id)
                setSelected((prev) => (replacementComprobante ? { ...prev, ...replacementComprobante } : prev))
                setDetail({ loading: false, error: null, data: updated })
              } catch {
                // Keep current detail if reload fails
              }
            }
          }}
        />
        <RemoveCuotaItemModal cuota={removing ? cuota : null} item={removing} onClose={() => setRemoving(null)} onRemoved={onChanged} />

        {selectedCreditNote && (
          <MovimientoManualDetailModal
            movimiento={selectedCreditNote}
            opened={Boolean(selectedCreditNote)}
            onClose={() => setSelectedCreditNote(null)}
          />
        )}
      </td>
    </tr>
  )
}

export default CuotaDetailPanel
