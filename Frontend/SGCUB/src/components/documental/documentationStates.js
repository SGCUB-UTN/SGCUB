export const DOCUMENTATION_SEVERITY = ['vencido', 'faltante', 'por_vencer', 'vigente']

export const DOCUMENTATION_LABELS = { vencido: 'Vencida', faltante: 'Incompleta', por_vencer: 'Por vencer', vigente: 'Al día' }

export const documentationSeverity = (documentacion) => {
  const index = DOCUMENTATION_SEVERITY.indexOf(documentacion?.estado)
  return index === -1 ? null : index
}
