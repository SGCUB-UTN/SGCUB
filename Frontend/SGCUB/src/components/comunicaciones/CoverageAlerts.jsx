export default function CoverageAlerts({
  validCount = 0,
  totalCount = 0,
  excludedCount = 0,
  emailReachable = 0,
  whatsappReachable = 0,
  canales = { email: true, whatsapp: false },
  onOpenExcluded,
}) {
  if (totalCount === 0) {
    return (
      <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/40 flex items-center gap-2.5 text-xs text-on-surface-variant">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-hidden="true">
          info
        </span>
        <span>Seleccioná al menos una categoría o destinatario para calcular el alcance del envío.</span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="p-3.5 rounded-lg bg-primary/6 border border-primary/25 flex items-start gap-3">
        <span className="material-symbols-outlined text-[20px] text-primary shrink-0 mt-0.5" aria-hidden="true">
          verified
        </span>
        <div className="text-xs leading-relaxed text-on-surface">
          <p className="font-semibold text-on-surface">
            Alcance efectivo: {validCount} de {totalCount}{' '}
            {totalCount === 1 ? 'destinatario seleccionado' : 'destinatarios seleccionados'}
          </p>
          <p className="text-on-surface-variant mt-0.5">
            {[
              canales.email ? `${emailReachable} por correo electrónico` : null,
              canales.whatsapp ? `${whatsappReachable} por WhatsApp` : null,
            ]
              .filter(Boolean)
              .join(' · ') || 'Ningún canal seleccionado'}
          </p>
        </div>
      </div>

      {excludedCount > 0 ? (
        <div className="p-3.5 rounded-lg bg-warning-container/40 border border-warning/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-warning shrink-0 mt-0.5" aria-hidden="true">
              warning
            </span>
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-on-surface">
                {excludedCount} {excludedCount === 1 ? 'persona sin' : 'personas sin'} dato de contacto para el canal elegido
              </p>
              <p className="text-on-surface-variant mt-0.5">
                No recibirán el mensaje por falta de correo o teléfono válido.
              </p>
            </div>
          </div>
          {onOpenExcluded && (
            <button
              type="button"
              onClick={onOpenExcluded}
              className="text-xs font-semibold text-primary hover:underline shrink-0 cursor-pointer"
            >
              Ver excluidos
            </button>
          )}
        </div>
      ) : (
        <div className="p-3.5 rounded-lg bg-success-container/30 border border-success/25 flex items-center gap-2.5 text-xs text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-success shrink-0" aria-hidden="true">
            check_circle
          </span>
          <span>Todos los destinatarios seleccionados cuentan con datos de contacto válidos.</span>
        </div>
      )}
    </div>
  )
}
