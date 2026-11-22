export const DOCUMENTATION_SEVERITY = ['vencido', 'faltante', 'por_vencer', 'vigente']

export const documentationSeverity = (documentacion) => {
  const index = DOCUMENTATION_SEVERITY.indexOf(documentacion?.estado)
  return index === -1 ? null : index
}
