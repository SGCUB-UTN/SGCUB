import { useEffect, useState } from 'react'
import { getConfiguracionGeneral } from '../../api/configuracion'
import { formatAmount, formatDate } from '../personas/format'
import { ReceiptLayout, ReceiptSection, ReceiptTotal } from './ReciboComprobante'

const CREDIT_NOTE = 'NotaCredito'

function AmountLine({ label, amount, strong = false }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-2.5 text-sm">
      <span className={strong ? 'font-semibold text-on-surface break-words' : 'text-on-surface-variant break-words'}>{label}</span>
      <strong className="text-on-surface shrink-0">{formatAmount(amount)}</strong>
    </div>
  )
}

export function RefundResponsable({ responsable }) {
  return (
    <div className="flex justify-between gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 text-sm">
      <span className="text-on-surface-variant">Responsable de la devolución</span>
      <strong className="text-on-surface text-right break-words">{responsable || '—'}</strong>
    </div>
  )
}

function ReciboDevolucion({ ref, devolucion }) {
  const [clubConfig, setClubConfig] = useState(null)
  const isCreditNote = devolucion.tipo === CREDIT_NOTE

  useEffect(() => {
    let active = true
    getConfiguracionGeneral()
      .then((cfg) => active && setClubConfig(cfg))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const cancelledReceipt = [
    devolucion.comprobante_anulado_codigo && `Recibo ${devolucion.comprobante_anulado_codigo}`,
    devolucion.comprobante_anulado_fecha && `Emitido el ${formatDate(devolucion.comprobante_anulado_fecha)}`,
  ].filter(Boolean).join(' · ')

  return (
    <ReceiptLayout
      ref={ref}
      clubConfig={clubConfig}
      socio={devolucion.socio ?? {}}
      titulo={isCreditNote ? 'Nota de crédito X' : 'Devolución X'}
      codigo={devolucion.codigo}
      fecha={formatDate(devolucion.fecha)}
      pie="Comprobante de uso interno · Asociación civil sin fines de lucro exenta"
    >
      <ReceiptSection title="Concepto">
        <AmountLine label={devolucion.concepto || '—'} amount={devolucion.monto} strong />
      </ReceiptSection>

      {devolucion.comprobante_anulado && (
        <ReceiptSection title="Comprobante anulado">
          <AmountLine label={cancelledReceipt} amount={devolucion.comprobante_anulado_monto} />
        </ReceiptSection>
      )}

      <ReceiptSection title="Medio de devolución">
        <AmountLine label={devolucion.medio_de_pago_nombre} amount={devolucion.monto} />
        <ReceiptTotal label="Total devuelto" amount={devolucion.monto} tone="text-error" />
      </ReceiptSection>
    </ReceiptLayout>
  )
}

export default ReciboDevolucion
