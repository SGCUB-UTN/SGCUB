import { useCometJugadorEstado, useDownloadPlanillaJugador } from '../../hooks/useComet'

export default function CometDescargarButton({ jugadorId }) {
  const { estado, isLoading } = useCometJugadorEstado(jugadorId)
  const { descargar, downloading } = useDownloadPlanillaJugador()

  const aptoVigente = Boolean(estado?.apto_fisico_vigente)

  const handleDescargar = async () => {
    if (!jugadorId || !aptoVigente || downloading) return
    const res = await descargar(jugadorId)
    if (!res.ok && res.error) {
      alert(res.error)
    }
  }

  const tooltip = isLoading
    ? 'Verificando apto físico...'
    : aptoVigente
      ? 'Descargar planilla con datos para COMET / Liga'
      : (estado?.motivo || 'Bloqueado: El jugador no posee Apto Físico vigente. Debe cargar y validar el apto médico para habilitar la planilla.')

  return (
    <button
      type="button"
      onClick={handleDescargar}
      disabled={isLoading || !aptoVigente || downloading}
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center gap-2 h-10 px-4 !mb-1 rounded-lg text-base font-semibold border shadow-sm transition-all select-none ${
        aptoVigente && !isLoading
          ? 'bg-surface-container-low hover:bg-surface-container text-on-surface border-outline-variant/40 cursor-pointer active:scale-[0.98]'
          : 'bg-surface-container-lowest text-outline border-outline-variant/30 cursor-not-allowed opacity-60'
      }`}
    >
      <span
        className={`material-symbols-outlined text-[20px] ${
          downloading || isLoading
            ? 'animate-spin text-primary'
            : aptoVigente
              ? 'text-primary'
              : 'text-error'
        }`}
      >
        {downloading || isLoading ? 'progress_activity' : (aptoVigente ? 'download' : 'block')}
      </span>
      <span>{downloading ? 'Descargando...' : 'Descargar datos'}</span>
    </button>
  )
}

