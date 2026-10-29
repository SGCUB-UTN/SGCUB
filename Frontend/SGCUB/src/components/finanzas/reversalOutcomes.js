// What is done with the money of a reverted payment of cuotas (backend DesenlaceReversionChoices)
export const OTHER_SOCIO = 'OtroSocio'
export const CHARGE_AGAIN = 'CobrarNuevamente'
export const FULL_CREDIT_NOTE = 'NotaCreditoTotal'
export const NEVER_RECEIVED = 'NuncaIngreso'

export const REVERSAL_OUTCOMES = [
  {
    value: OTHER_SOCIO,
    icon: 'person_search',
    title: 'Registrar pago a otro socio',
    description: 'El pago se cargó en el socio equivocado: se registra en el correcto con el mismo dinero.',
  },
  {
    value: CHARGE_AGAIN,
    icon: 'payments',
    title: 'Registrar pago nuevamente',
    description: 'Se vuelve a cobrar a este socio. Si sobra dinero, queda como pago parcial o se devuelve con nota de crédito.',
  },
  {
    value: FULL_CREDIT_NOTE,
    icon: 'currency_exchange',
    title: 'Nota de crédito por el total',
    description: 'Se le devuelve al socio todo el dinero del pago.',
  },
  {
    value: NEVER_RECEIVED,
    icon: 'block',
    title: 'El pago nunca ingresó',
    description: 'El dinero no se recibió: se anula el ingreso, sin devolución.',
  },
]

export const opensPayment = (outcome) => outcome === OTHER_SOCIO || outcome === CHARGE_AGAIN
