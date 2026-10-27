import { useEffect, useState } from 'react'
import { descargarComprobantePdf, getComprobante, getComprobantesByCuota } from '../../api/comprobantes'
import { formatAmount, formatDate } from '../personas/format'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import ComprobanteDetailModal from './ComprobanteDetailModal'
import RemoveCuotaItemModal, { RemoveItemButton } from './CuotaItemRemoval'
import { SUMMARY_GROUP_CLASS } from './formParts'
import { isPaid } from './accountStatement'
import { isAdjustment, itemLabel, itemTone, removalBlocker } from './cuotaItems'

const CARD_CLASS = 'rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm'

const LAYOUTS = {
  cards: {
    grid: 'grid grid-cols-1 lg:grid-cols-3 gap-4',
    main: 'lg:col-span-2 min-w-0',
    side: 'flex flex-col gap-4 min-w-0',
    concepts: `${CARD_CLASS} p-4`,
    receipts: `${CARD_CLASS} p-4`,
    summary: `${CARD_CLASS} p-4`,
  },
  flat: {
    grid: 'grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-outline-variant/30',
    main: 'lg:col-span-2 min-w-0 pb-4 lg:pb-0 lg:pr-6',
    side: 'flex flex-col divide-y divide-outline-variant/30 min-w-0 pt-4 lg:pt-0 lg:pl-6',
    concepts: '',
    receipts: 'pb-4',
    summary: 'pt-4',
  },
}

const CARD_TITLE_CLASS = `${SUMMARY_GROUP_CLASS} mb-0`

const ICON_BUTTON_CLASS = 'w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

const isAnnulled = (comprobante) => comprobante.estado === 'Anulado'

const PAID_HINT = 'La cuota ya está paga'

const sumItems = (items) => items.reduce((total, item) => total + Number(item.monto ?? 0) * (item.es_descuento ? -1 : 1), 0)

function ReceiptRow({ comprobante, onOpen }) {
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
          <button type="button" onClick={download} disabled={downloading} title="Descargar PDF" aria-label={`Descargar comprobante ${comprobante.numero}`} className={ICON_BUTTON_CLASS}>
            <span className={`material-symbols-outlined text-[20px] ${downloading ? 'animate-spin' : ''}`} aria-hidden="true">{downloading ? 'progress_activity' : 'download'}</span>
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

function ConceptsCard({ cuota, onRemove, className }) {
  const items = cuota.items ?? []
  const charges = items.filter((item) => !isAdjustment(item))
  const adjustments = items.filter(isAdjustment)

  return (
    <div className={`${className} flex flex-col gap-3 h-full`} role="region" aria-label="Detalle de conceptos">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h4 className={CARD_TITLE_CLASS}>Detalle de conceptos</h4>
        <DueDatesBar cuota={cuota} />
      </div>
      <div className="flex flex-col text-base">
        {charges.map((item) => (
          <ConceptLine key={item.item_cuota_id} label={itemLabel(item)} value={formatAmount(Number(item.monto ?? 0))} />
        ))}
        {adjustments.length > 0 && (
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
          </>
        )}
      </div>
      <div className="mt-auto flex items-baseline justify-between gap-3 pt-1 text-base font-bold text-on-surface">
        <span className="uppercase tracking-wider text-sm">Total calculado</span>
        <span className="tabular-nums whitespace-nowrap pr-[30px]">{formatAmount(Number(cuota.monto_total ?? 0))}</span>
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

function PaymentSummaryCard({ cuota, onPay, onAssignBenefit, extraActions, className }) {
  const paid = isPaid(cuota)
  const pending = Number(cuota.saldo_pendiente ?? 0)
  const payable = !paid && pending > 0
  return (
    <div className={`${className} flex flex-col gap-3`} role="region" aria-label="Resumen de pago">
      <h4 className={CARD_TITLE_CLASS}>Resumen de pago</h4>
      <div className="flex flex-col gap-1.5 text-base">
        <SummaryRow label="Total cuota" value={formatAmount(Number(cuota.monto_total ?? 0))} />
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
      {(onPay || onAssignBenefit || extraActions) && (
        <div className="flex flex-col gap-2 [&>button]:justify-center">
          {onPay && payable && (
            <PrimaryButton icon="payments" onClick={() => onPay(cuota)}>
              {`Pagar · ${formatAmount(pending)}`}
            </PrimaryButton>
          )}
          {onAssignBenefit && (
            <SecondaryButton icon="sell" onClick={() => onAssignBenefit(cuota)} disabled={paid} title={paid ? PAID_HINT : undefined}>
              Agregar descuento
            </SecondaryButton>
          )}
          {extraActions}
        </div>
      )}
    </div>
  )
}

function ReceiptsCard({ cuotaId, onOpen, className }) {
  const [receipts, setReceipts] = useState({ loading: true, error: '', items: [] })

  useEffect(() => {
    let active = true
    getComprobantesByCuota(cuotaId)
      .then((items) => active && setReceipts({ loading: false, error: '', items: items ?? [] }))
      .catch(() => active && setReceipts({ loading: false, error: 'No se pudieron cargar los comprobantes.', items: [] }))
    return () => { active = false }
  }, [cuotaId])

  return (
    <div className={`${className} flex flex-col gap-2 min-w-0`} role="region" aria-label="Comprobantes asociados">
      <h4 className={CARD_TITLE_CLASS}>Comprobantes asociados</h4>
      {receipts.loading && (
        <p className="flex items-center gap-2 text-base text-on-surface-variant" role="status">
          <span className="material-symbols-outlined text-[20px] animate-spin" aria-hidden="true">progress_activity</span>
          Cargando comprobantes...
        </p>
      )}
      {receipts.error && <p className="text-sm text-error" role="alert">{receipts.error}</p>}
      {!receipts.loading && !receipts.error && (receipts.items.length ? (
        <ul className="flex flex-col divide-y divide-outline-variant/20">
          {receipts.items.map((comprobante) => (
            <ReceiptRow key={comprobante.comprobante_id} comprobante={comprobante} onOpen={onOpen} />
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

function CuotaDetailPanel({ cuota, colSpan, onPay, onAssignBenefit, onChanged, extraActions, flat = false }) {
  const layout = flat ? LAYOUTS.flat : LAYOUTS.cards
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState({ loading: false, error: null, data: null })
  const [removing, setRemoving] = useState(null)

  const openReceipt = async (comprobante) => {
    setSelected(comprobante)
    setDetail({ loading: true, error: null, data: null })
    try {
      setDetail({ loading: false, error: null, data: await getComprobante(comprobante.comprobante_id) })
    } catch {
      setDetail({ loading: false, error: 'No se pudo cargar el detalle.', data: null })
    }
  }

  return (
    <tr className="bg-surface-container-low/60">
      <td colSpan={colSpan} className="px-4 py-4 border-l-4 border-primary">
        <div className={layout.grid}>
          <div className={layout.main}>
            <ConceptsCard cuota={cuota} onRemove={onChanged ? setRemoving : undefined} className={layout.concepts} />
          </div>
          <div className={layout.side}>
            <ReceiptsCard cuotaId={cuota.cuota_id} onOpen={openReceipt} className={layout.receipts} />
            <PaymentSummaryCard cuota={cuota} onPay={onPay} onAssignBenefit={onAssignBenefit} extraActions={extraActions} className={layout.summary} />
          </div>
        </div>

        <ComprobanteDetailModal
          comprobante={selected}
          detalle={detail.data}
          loading={detail.loading}
          error={detail.error}
          opened={Boolean(selected)}
          onClose={() => setSelected(null)}
        />
        <RemoveCuotaItemModal cuota={removing ? cuota : null} item={removing} onClose={() => setRemoving(null)} onRemoved={onChanged} />
      </td>
    </tr>
  )
}

export default CuotaDetailPanel
