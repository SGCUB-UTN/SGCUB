import { isCancelledRefund } from './refunds'

const ANNULLED = 'Anulado'

const totalOf = (items, amount) => ({
  amount: items.reduce((total, item) => total + Number(amount(item) ?? 0), 0),
  count: items.length,
})

const receiptAmount = (comprobante) => comprobante.monto_total
const refundAmount = (devolucion) => devolucion.monto

export default function cashSummary(comprobantes, devoluciones) {
  const inForce = comprobantes.filter((comprobante) => comprobante.estado !== ANNULLED)
  const annulled = comprobantes.filter((comprobante) => comprobante.estado === ANNULLED)
  const incomeReceipts = inForce.filter((comprobante) => comprobante.es_ingreso)
  const refunds = devoluciones.filter((devolucion) => !isCancelledRefund(devolucion))

  return {
    income: totalOf(inForce, receiptAmount),
    cuotas: totalOf(inForce.filter((comprobante) => !comprobante.es_ingreso), receiptAmount),
    otherIncome: totalOf(incomeReceipts, receiptAmount),
    creditNotes: totalOf(refunds.filter((devolucion) => devolucion.tipo === 'NotaCredito'), refundAmount),
    manualRefunds: totalOf(refunds.filter((devolucion) => devolucion.tipo === 'Manual'), refundAmount),
    annulled: totalOf(annulled, receiptAmount),
  }
}
