// Amounts are whole pesos: cents are not used by the club

// '20000', 20000 or '20000.00' -> '20.000'
export const formatThousands = (value) => {
  if (value === '' || value === null || value === undefined) return ''
  const number = Math.trunc(Number(value))
  return Number.isNaN(number) ? '' : number.toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

// '20000.00' -> '$ 20.000'
export const formatMoney = (value) => `$ ${formatThousands(value) || '0'}`

// '12.50' -> '12,5%'
export const formatPercent = (value) => `${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`

// '30123456789' or '30-12345678-9' -> '30-12345678-9', as far as the digits typed go
export const formatCuit = (value) => {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 11)
  return [digits.slice(0, 2), digits.slice(2, 10), digits.slice(10)].filter(Boolean).join('-')
}
