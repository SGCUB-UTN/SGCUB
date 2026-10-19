export default function CanalesSelector({
  canalesSeleccionados,
  onToggleCanal,
}) {
  const hasEmail = canalesSeleccionados.has('email')
  const hasWhatsApp = canalesSeleccionados.has('whatsapp')

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
          Canales de Difusión Masiva
        </label>
        <span className="text-xs text-on-surface-variant">
          Seleccioná uno o ambos canales oficiales
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Opción Email */}
        <label
          className={`flex items-center justify-between p-3.5 border rounded-lg cursor-pointer transition-colors ${
            hasEmail
              ? 'border-primary bg-primary/5 shadow-xs'
              : 'border-outline-variant/40 hover:bg-surface-container-low'
          }`}
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={hasEmail}
              onChange={() => onToggleCanal('email')}
              className="w-4 h-4 rounded text-primary accent-primary cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">
                mail
              </span>
              <span className="text-sm font-semibold text-on-surface">
                Correo Electrónico (Email)
              </span>
            </div>
          </div>
          <span className="text-xs text-on-surface-variant font-medium">
            Avisos formales
          </span>
        </label>

        {/* Opción WhatsApp */}
        <label
          className={`flex items-center justify-between p-3.5 border rounded-lg cursor-pointer transition-colors ${
            hasWhatsApp
              ? 'border-emerald-600 bg-emerald-50/50 shadow-xs'
              : 'border-outline-variant/40 hover:bg-surface-container-low'
          }`}
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={hasWhatsApp}
              onChange={() => onToggleCanal('whatsapp')}
              className="w-4 h-4 rounded text-emerald-600 accent-emerald-600 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-emerald-600">
                chat
              </span>
              <span className="text-sm font-semibold text-on-surface">
                WhatsApp Directo
              </span>
            </div>
          </div>
          <span className="text-xs text-on-surface-variant font-medium">
            Notificación móvil
          </span>
        </label>
      </div>

      {!hasEmail && !hasWhatsApp && (
        <p className="text-xs text-error font-medium">
          ⚠️ Debe seleccionar al menos un canal para realizar la difusión.
        </p>
      )}
    </div>
  )
}

