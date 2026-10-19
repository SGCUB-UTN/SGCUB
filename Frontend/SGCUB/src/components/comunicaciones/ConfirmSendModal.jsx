export default function ConfirmSendModal({
  isOpen,
  onClose,
  onConfirm,
  destinatariosCount,
  canalesTexto = 'Email y WhatsApp',
  asunto,
  cuerpo,
  isSending,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl max-w-lg w-full p-6 shadow-xl flex flex-col gap-4">
        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <div className="w-10 h-10 rounded-full bg-surface-container text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">forward_to_inbox</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Título y descripción */}
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-on-surface">
            Confirmar Difusión de Mensaje
          </h3>
          <p className="text-sm text-on-surface-variant">
            Está a punto de enviar la siguiente notificación institucional con firma oficial de SCUB.
          </p>
        </div>

        {/* Resumen del envío */}
        <div className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-2">
          <div className="flex justify-between text-xs">
            <span className="text-on-surface-variant">Destinatarios efectivos:</span>
            <span className="font-bold text-primary">{destinatariosCount} contactos</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-on-surface-variant">Canales activos:</span>
            <span className="font-semibold text-on-surface">{canalesTexto}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-on-surface-variant">Remitente institucional:</span>
            <span className="font-semibold text-on-surface">Club Universitario de Berisso</span>
          </div>
          {asunto && (
            <div className="flex justify-between text-xs pt-1.5 border-t border-outline-variant/30">
              <span className="text-on-surface-variant">Asunto:</span>
              <span className="font-semibold text-on-surface truncate max-w-xs">{asunto}</span>
            </div>
          )}
          <div className="pt-2 mt-1 text-xs text-on-surface line-clamp-3 italic bg-surface-container-lowest p-2.5 rounded border border-outline-variant/20">
            "{cuerpo || 'Sin contenido'}"
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            disabled={isSending}
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-sm font-medium transition-colors cursor-pointer"
          >
            Volver a editar
          </button>
          <button
            type="button"
            disabled={isSending}
            onClick={onConfirm}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              {isSending ? 'sync' : 'done'}
            </span>
            <span>{isSending ? 'Despachando...' : 'Confirmar y despachar'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
