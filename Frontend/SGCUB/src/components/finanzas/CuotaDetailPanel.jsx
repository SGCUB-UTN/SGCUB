import { useEffect, useState } from 'react'
import { descargarComprobantePdf, getComprobante, getComprobantesByCuota } from '../../api/comprobantes'
import { formatAmount, formatDate } from '../personas/format'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import ComprobanteDetailModal from './ComprobanteDetailModal'
import { SUMMARY_GROUP_CLASS } from './formParts'
import { isPaid } from './accountStatement'

const ICON_BUTTON_CLASS = 'w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

const isAnnulled = (comprobante) => comprobante.estado === 'Anulado'

const PAID_HINT = 'La cuota ya está paga'

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
    <li className="flex flex-col gap-1 p-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest">
      <div className="flex items-center gap-3">
        <span className={`material-symbols-outlined text-[24px] shrink-0 ${annulled ? 'text-outline' : 'text-primary'}`} aria-hidden="true">receipt_long</span>
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-base font-semibold ${annulled ? 'text-on-surface-variant line-through' : 'text-on-surface'}`}>Comprobante #{comprobante.numero}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-bold border ${annulled ? 'bg-error-container text-on-error-container border-error/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {comprobante.estado ?? 'Vigente'}
            </span>
          </div>
          <span className="text-sm text-on-surface-variant">Emitido el {formatDate(comprobante.fecha_emision)}</span>
        </div>
        <div className="text-right shrink-0">
          <span className="block text-xs text-on-surface-variant">Total del comprobante</span>
          <span className="text-base font-bold text-on-surface">{formatAmount(comprobante.monto_total)}</span>
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

const SURCHARGE_CONCEPT = 'Mora'

const itemLabel = (item) => (item.concepto === SURCHARGE_CONCEPT ? 'Recargo por mora' : item.concepto_nombre ?? item.concepto)

const itemTone = (item) => {
  if (item.es_descuento) return { className: 'text-emerald-700', sign: '− ' }
  if (item.concepto === SURCHARGE_CONCEPT) return { className: 'text-error', sign: '+ ' }
  return { className: 'text-on-surface', sign: '' }
}

function DetailLine({ label, value, className = 'text-on-surface', strong = false }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${className} ${strong ? 'font-bold' : ''}`}>
      <span>{label}</span>
      <span className="tabular-nums whitespace-nowrap">{value}</span>
    </div>
  )
}

function CuotaBreakdown({ cuota }) {
  return (
    <section className="flex flex-col gap-3 h-full" aria-label="Detalle de la cuota">
      <h4 className={SUMMARY_GROUP_CLASS}>Detalle de la cuota</h4>
      <div className="flex flex-col gap-1.5 text-base">
        <DetailLine label="1° vencimiento" value={formatDate(cuota.fecha_venc1)} className="text-on-surface-variant" />
        <DetailLine label="2° vencimiento" value={formatDate(cuota.fecha_venc2)} className="text-on-surface-variant" />
      </div>
      <div className="flex flex-col flex-1 gap-1.5 pt-3 border-t border-outline-variant/30 text-base">
        {(cuota.items ?? []).map((item) => {
          const tone = itemTone(item)
          return (
            <DetailLine
              key={item.item_cuota_id}
              label={itemLabel(item)}
              value={`${tone.sign}${formatAmount(Number(item.monto ?? 0))}`}
              className={tone.className}
            />
          )
        })}
        <div className="pt-2 mt-auto border-t border-outline-variant/30">
          <DetailLine label="Total" value={formatAmount(Number(cuota.monto_total ?? 0))} strong />
        </div>
      </div>
    </section>
  )
}

function PaymentSummary({ cuota }) {
  const pending = Number(cuota.saldo_pendiente ?? 0)
  return (
    <section className="flex flex-col gap-1.5 mt-auto text-base" aria-label="Resumen de pago">
      <h4 className={SUMMARY_GROUP_CLASS}>Resumen</h4>
      <DetailLine label="Total de la cuota" value={formatAmount(Number(cuota.monto_total ?? 0))} />
      <DetailLine label="Pagado" value={formatAmount(Number(cuota.monto_pagado ?? 0))} />
      {isPaid(cuota) || pending <= 0 ? (
        <p className="flex items-center gap-1.5 pt-2 mt-1 border-t border-outline-variant/30 font-semibold text-emerald-700">
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">task_alt</span>
          Cuota paga
        </p>
      ) : (
        <div className="pt-2 mt-1 border-t border-outline-variant/30">
          <DetailLine label="Pendiente" value={formatAmount(pending)} className="text-error" strong />
        </div>
      )}
    </section>
  )
}

// Content of the row that opens below a cuota: its breakdown, receipts and payment summary
function CuotaActions({ cuota, onPay, onAssignBenefit }) {
  const paid = isPaid(cuota)
  const payable = !paid && Number(cuota.saldo_pendiente ?? 0) > 0
  return (
    <div className="flex flex-col sm:flex-row gap-2 [&>button]:justify-center">
      {onPay && (
        <PrimaryButton icon="payments" onClick={() => onPay(cuota)} disabled={!payable} title={payable ? undefined : PAID_HINT}>
          {payable ? `Pagar · ${formatAmount(Number(cuota.saldo_pendiente ?? 0))}` : 'Pagar'}
        </PrimaryButton>
      )}
      {onAssignBenefit && (
        <SecondaryButton icon="sell" onClick={() => onAssignBenefit(cuota)} disabled={paid} title={paid ? PAID_HINT : undefined}>
          Asignar beca o descuento
        </SecondaryButton>
      )}
    </div>
  )
}

function CuotaDetailPanel({ cuota, colSpan, onPay, onAssignBenefit }) {
  const [receipts, setReceipts] = useState({ loading: true, error: '', items: [] })
  const [selected, setSelected] = useState(null)
  const [detail, setDetail] = useState({ loading: false, error: null, data: null })

  useEffect(() => {
    let active = true
    getComprobantesByCuota(cuota.cuota_id)
      .then((items) => active && setReceipts({ loading: false, error: '', items: items ?? [] }))
      .catch(() => active && setReceipts({ loading: false, error: 'No se pudieron cargar los comprobantes.', items: [] }))
    return () => { active = false }
  }, [cuota.cuota_id])

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CuotaBreakdown cuota={cuota} />
          <div className="flex flex-col gap-6 min-w-0">
            <section className="min-w-0 flex flex-col gap-2" aria-label="Comprobantes asociados">
              <h4 className={SUMMARY_GROUP_CLASS}>Comprobantes asociados</h4>
              {receipts.loading && (
                <p className="flex items-center gap-2 text-base text-on-surface-variant" role="status">
                  <span className="material-symbols-outlined text-[20px] animate-spin" aria-hidden="true">progress_activity</span>
                  Cargando comprobantes...
                </p>
              )}
              {receipts.error && <p className="text-sm text-error" role="alert">{receipts.error}</p>}
              {!receipts.loading && !receipts.error && (receipts.items.length ? (
                <ul className="flex flex-col gap-2">
                  {receipts.items.map((comprobante) => (
                    <ReceiptRow key={comprobante.comprobante_id} comprobante={comprobante} onOpen={openReceipt} />
                  ))}
                </ul>
              ) : (
                <p className="text-base text-on-surface-variant py-4 text-center border border-dashed border-outline-variant/40 rounded-lg">
                  Sin comprobantes asociados.
                </p>
              ))}
            </section>
            {(onPay || onAssignBenefit) && <CuotaActions cuota={cuota} onPay={onPay} onAssignBenefit={onAssignBenefit} />}
            <PaymentSummary cuota={cuota} />
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
      </td>
    </tr>
  )
}

export default CuotaDetailPanel
