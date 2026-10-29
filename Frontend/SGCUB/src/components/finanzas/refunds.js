const roundCents = (value) => Math.round(value * 100) / 100

// Money of a receipt not given back yet with credit notes
export const availableToRefund = (comprobante) => roundCents(Number(comprobante?.monto_total ?? 0) - Number(comprobante?.monto_devuelto ?? 0))

// What a reverted payment brought in, to charge it again: its receipt, the money left and how it was paid
export const reversalOf = (detalle) => ({
  comprobanteId: detalle.comprobante_id,
  codigo: detalle.codigo,
  total: availableToRefund(detalle),
  medios: (detalle.pago_detalle?.items_pago ?? []).map((item) => ({ medio: item.medio_de_pago, monto: Number(item.monto) })),
})
