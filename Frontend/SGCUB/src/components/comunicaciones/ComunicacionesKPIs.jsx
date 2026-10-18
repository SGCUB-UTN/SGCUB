import StatCard from '../shared/StatCard'

export default function ComunicacionesKPIs({ kpis }) {
  const data = kpis || {
    envios_mes: 34,
    mensajes_entregados: 1420,
    tasa_entrega: 98.4,
    canales_activos_texto: 'Email corporativo y WhatsApp',
    sin_contacto: 14,
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 xl:gap-6">
      <StatCard
        size="lg"
        eyebrow="Envíos del Mes"
        label="Campañas activadas"
        value={data.envios_mes}
        caption={`mensajes enviados con éxito`}
        icon="outbox"
        tone="neutral"
        wrapContent
      />
      <StatCard
        size="lg"
        eyebrow="Tasa de Entrega"
        label="Efectividad global"
        value={`${data.tasa_entrega}%`}
        caption={data.canales_activos_texto}
        icon="verified"
        tone="warning"
        wrapContent
      />
      <StatCard
        size="lg"
        eyebrow="Atención Requerida"
        label="Sin Contacto Validado"
        value={data.sin_contacto}
        caption="requieren actualizar datos de contacto"
        icon="phonelink_erase"
        tone="error"
        wrapContent
      />
    </div>
  )
}
