const countByStatus = (documents, status) => documents.filter((d) => d.status === status).length

export const buildDocumentBadges = (documents = [], missingCount = 0) => {
  const vencidos = countByStatus(documents, 'vencido')
  const porVencer = countByStatus(documents, 'por_vencer')

  const badges = []
  if (missingCount > 0) badges.push({ label: missingCount, tono: 'error', icon: 'assignment_late', title: 'Faltantes' })
  if (vencidos > 0) badges.push({ label: vencidos, tono: 'error', icon: 'error', title: 'Vencidos' })
  if (porVencer > 0) badges.push({ label: porVencer, tono: 'alerta', icon: 'schedule', title: 'Por vencer' })
  return badges.length > 0 ? badges : undefined
}
