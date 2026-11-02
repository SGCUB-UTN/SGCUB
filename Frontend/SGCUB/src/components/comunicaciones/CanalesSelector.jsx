export default function CanalesSelector({ canales, setCanales, remitente }) {
  const toggleEmail = () => {
    setCanales((prev) => ({ ...prev, email: !prev.email, whatsapp: false }))
  }

  const emailRemitente = remitente?.email_remitente || ''

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        Canales de envío
      </span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label
          className={`flex items-center justify-between gap-3 p-3.5 rounded-lg border transition-colors cursor-pointer select-none ${
            canales.email
              ? 'border-primary bg-primary/8 text-on-surface shadow-2xs'
              : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="checkbox"
              checked={canales.email}
              onChange={toggleEmail}
              className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface">Correo electrónico (SMTP)</p>
              <p className="text-xs text-on-surface-variant truncate">
                {emailRemitente ? `Desde ${emailRemitente}` : 'Envío institucional por correo electrónico'}
              </p>
            </div>
          </div>
          <span
            className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
              canales.email ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              mail
            </span>
          </span>
        </label>

        <div
          aria-disabled="true"
          className="flex items-center justify-between gap-3 p-3.5 rounded-lg border border-outline-variant/30 bg-surface-container/50 opacity-65 cursor-not-allowed select-none"
        >
          <div className="flex items-center gap-3 min-w-0">
            <input
              type="checkbox"
              disabled
              checked={false}
              readOnly
              className="w-4 h-4 rounded cursor-not-allowed shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-on-surface-variant">WhatsApp</p>
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-[10px] font-semibold uppercase tracking-wide text-on-surface-variant">
                  No configurado
                </span>
              </div>
              <p className="text-xs text-on-surface-variant truncate">
                Servicio de mensajería no vinculado en el servidor
              </p>
            </div>
          </div>
          <span className="w-8 h-8 rounded-md bg-surface-container-high text-on-surface-variant flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              chat
            </span>
          </span>
        </div>
      </div>
    </div>
  )
}
