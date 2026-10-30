const ANNULLED = 'Anulado'

const totalOf = (items, amount) => ({
  amount: items.reduce((total, item) => total + Number(amount(item) ?? 0), 0),
  count: items.length,
})

const receiptAmount = (comprobante) => comprobante.monto_total
const refundAmount = (devolucion) => devolucion.monto

function groupByConcept(receipts) {
  const groups = new Map()
  receipts.forEach((receipt) => {
    const label = String(receipt.concepto ?? '').trim() || 'Sin concepto'
    const key = label.toLocaleLowerCase('es')
    const group = groups.get(key) ?? { key, label, amount: 0, count: 0 }
    group.amount += Number(receipt.monto_total ?? 0)
    group.count += 1
    groups.set(key, group)
  })
  return [...groups.values()].sort((a, b) => b.amount - a.amount)
}

export default function cashSummary(comprobantes, devoluciones) {
  const inForce = comprobantes.filter((comprobante) => comprobante.estado !== ANNULLED)
  const annulled = comprobantes.filter((comprobante) => comprobante.estado === ANNULLED)
  const incomeReceipts = inForce.filter((comprobante) => comprobante.es_ingreso)

  return {
    income: totalOf(inForce, receiptAmount),
    cuotas: totalOf(inForce.filter((comprobante) => !comprobante.es_ingreso), receiptAmount),
    otherIncome: totalOf(incomeReceipts, receiptAmount),
    concepts: groupByConcept(incomeReceipts),
    creditNotes: totalOf(devoluciones.filter((devolucion) => devolucion.tipo === 'NotaCredito'), refundAmount),
    manualRefunds: totalOf(devoluciones.filter((devolucion) => devolucion.tipo === 'Manual'), refundAmount),
    annulled: totalOf(annulled, receiptAmount),
  }
}
