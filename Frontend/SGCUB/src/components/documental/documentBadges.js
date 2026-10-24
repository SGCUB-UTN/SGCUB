const countByStatus = (documents, status) => documents.filter((d) => d.status === status).length

export const buildDocumentBadges = (documents = []) => {
  const vencidos = countByStatus(documents, 'vencido')
  const porVencer = countByStatus(documents, 'por_vencer')

  const badges = []
  if (vencidos > 0) badges.push({ label: vencidos, tono: 'error', icon: 'error', hideDot: true, title: 'Vencidos' })
  if (porVencer > 0) badges.push({ label: porVencer, tono: 'alerta', icon: 'schedule', hideDot: true, title: 'Por vencer' })
  return badges.length > 0 ? badges : undefined
}
