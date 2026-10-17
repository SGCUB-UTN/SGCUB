const MODOS = {
  mock: { label: 'Modo prueba', tono: 'alerta', icon: 'science', ayuda: 'Los datos son simulados, no vienen de COMET real.' },
  sandbox: { label: 'Modo sandbox', tono: 'info', icon: 'cloud', ayuda: 'Datos del ambiente de prueba de COMET.' },
  production: { label: 'Producción', tono: 'positivo', icon: 'cloud_done', ayuda: 'Datos reales de COMET.' },
}

const TONO_CLASES = {
  alerta: 'bg-warning-container/40 text-on-warning-container border-warning/40',
  info: 'bg-primary-container/30 text-on-primary-container border-primary/30',
  positivo: 'bg-[#e6f4ea] text-[#0d652d] border-[#0d652d]/30',
}

export default function CometModoBadge({ modo = 'mock', compacto = false }) {
  const info = MODOS[modo] ?? MODOS.mock
  return (
    <span
      title={info.ayuda}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-sm font-medium ${TONO_CLASES[info.tono]}`}
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">{info.icon}</span>
      {!compacto && <span>{info.label}</span>}
    </span>
  )
}