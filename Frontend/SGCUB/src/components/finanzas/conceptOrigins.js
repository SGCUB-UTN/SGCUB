// Origins of the concepts of incomes and manual refunds (ConceptoMovimiento.origen)
export const INCOME = 'Ingreso'
export const MANUAL_REFUND = 'DevolucionManual'

export const CONCEPT_ORIGINS = [
  { value: INCOME, label: 'Ingresos', singular: 'Ingreso', placeholder: 'Ej: Rifa anual' },
  { value: MANUAL_REFUND, label: 'Devoluciones manuales', singular: 'Devolución manual', placeholder: 'Ej: Transferencia duplicada' },
]

export const PROTECTED_CONCEPTS = ['Otro ingreso', 'Otra devolución']

export const isOtherConcept = (name) => PROTECTED_CONCEPTS.includes(name)
