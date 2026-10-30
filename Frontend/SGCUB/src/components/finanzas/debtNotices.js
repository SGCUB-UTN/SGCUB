import { formatAmount } from '../personas/format'

const SUBJECT = 'Aviso de deuda pendiente'

export const debtNotice = (row) => ({
  socioId: row.socio_id,
  subject: SUBJECT,
  body: `Hola ${row.nombre}, te recordamos que registrás ${row.cuotas_vencidas} ${row.cuotas_vencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'} por un total de ${formatAmount(row.monto_adeudado)}. Podés regularizar tu situación en la secretaría del club.`,
})

export const bulkDebtNotice = (rows) => ({
  socioIds: rows.map((row) => row.socio_id),
  subject: SUBJECT,
  body: 'Hola, te recordamos que registrás cuotas vencidas con el club. Podés consultar el detalle y regularizar tu situación en la secretaría del club.',
})
