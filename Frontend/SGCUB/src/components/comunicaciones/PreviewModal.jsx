export default function PreviewModal({
  isOpen,
  onClose,
  asunto,
  cuerpo,
  canales = new Set(['email', 'whatsapp']),
}) {
  if (!isOpen) return null

  const showEmail = canales.has('email')
  const showWhatsApp = canales.has('whatsapp')

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl max-w-xl w-full p-6 shadow-xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">visibility</span>
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-on-surface">
                Vista Previa del Comunicado
              </h3>
              <p className="text-xs text-on-surface-variant">
                Previsualización del formato que recibirán los socios y familias.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Canales: Email y WhatsApp */}
        <div className="overflow-y-auto flex-1 flex flex-col gap-4 pr-1">
          {/* Email mockup */}
          {showEmail && (
            <div className="border border-outline-variant/40 rounded-lg overflow-hidden bg-surface-container-lowest shadow-xs">
              <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant/30 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  <span>Canal Email</span>
                </div>
                <span className="text-xs text-on-surface-variant font-mono">
                  secretaria@clubunivberisso.org
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2">
                <span className="text-base font-bold text-on-surface">
                  {asunto || 'Sin asunto'}
                </span>
                <p className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
                  {cuerpo || 'Sin contenido'}
                </p>
                <div className="pt-3 mt-2 border-t border-outline-variant/20 flex items-center justify-between text-xs text-on-surface-variant">
                  <span>Club Universitario de Berisso</span>
                  <span className="font-medium text-primary">Firma oficial validada</span>
                </div>
              </div>
            </div>
          )}

          {/* WhatsApp mockup */}
          {showWhatsApp && (
            <div className="border border-outline-variant/40 rounded-lg overflow-hidden bg-surface-container-lowest shadow-xs">
              <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant/30 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-medium">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">chat</span>
                  <span className="font-semibold text-emerald-700">Canal WhatsApp</span>
                </div>
                <span className="text-xs text-on-surface-variant font-medium">
                  Club Universitario de Berisso
                </span>
              </div>
              <div className="p-4 flex flex-col gap-2 bg-[#efeae2]/40">
                <div className="bg-[#d9fdd3] text-[#111b21] border border-[#d1ebd0] p-3 rounded-lg rounded-tl-none max-w-md self-start text-sm whitespace-pre-wrap shadow-xs">
                  {asunto && <p className="font-bold mb-1">{asunto}</p>}
                  <p>{cuerpo || 'Sin contenido'}</p>
                  <span className="block text-right text-[10px] text-gray-500 mt-1">✓✓</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-sm font-medium transition-colors cursor-pointer"
          >
            Volver a la edición
          </button>
        </div>
      </div>
    </div>
  )
}
