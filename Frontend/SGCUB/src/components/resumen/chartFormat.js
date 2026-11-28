const compactMoney = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', notation: 'compact', maximumFractionDigits: 1 })

export const formatCompactMoney = (amount) => compactMoney.format(Number(amount ?? 0))
