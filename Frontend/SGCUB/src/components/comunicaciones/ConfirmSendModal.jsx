import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'

export default function ConfirmSendModal({
  isOpen,
  onClose,
  onConfirm,
  isSending,
  asunto,
  canales,
  validCount,
  scopeText,
  remitente,
  copiaSecretaria,
}) {
  if (!isOpen) return null

  const activeChannels = [
    canales?.email ? 'Correo electrónico (SMTP)' : null,
    canales?.whatsapp ? 'WhatsApp' : null,
  ]
    .filter(Boolean)
    .join(' y ')

  const emailRemitente = remitente?.email_remitente || ''

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-send-modal-title"
    >
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
              send
            </span>
            <h2 id="confirm-send-modal-title" className="text-base font-bold text-on-surface">
              Confirmar envío de comunicado
            </h2>
          </div>
          <button
            type="button"
            disabled={isSending}
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Cerrar confirmación"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <p className="text-on-surface-variant text-xs leading-relaxed">
            Revisá el resumen antes de despachar la notificación. Los correos electrónicos se enviarán de inmediato utilizando la configuración SMTP activa.
          </p>

          <dl className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/40 space-y-2.5 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Alcance:</dt>
              <dd className="font-semibold text-on-surface text-right">{scopeText}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Destinatarios alcanzables:</dt>
              <dd className="font-semibold text-primary tabular-nums">
                {validCount} {validCount === 1 ? 'persona' : 'personas'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-on-surface-variant">Canales:</dt>
              <dd className="font-semibold text-on-surface text-right">{activeChannels}</dd>
            </div>
            {canales?.email && emailRemitente && (
              <div className="flex justify-between gap-3">
                <dt className="text-on-surface-variant">Remitente SMTP:</dt>
                <dd className="font-mono text-on-surface text-right truncate">{emailRemitente}</dd>
              </div>
            )}
            {copiaSecretaria && (
              <div className="flex justify-between gap-3">
                <dt className="text-on-surface-variant">Copia a secretaría:</dt>
                <dd className="font-semibold text-on-surface text-right">Sí</dd>
              </div>
            )}
            <div className="pt-2 border-t border-outline-variant/30">
              <dt className="text-on-surface-variant mb-0.5">Asunto:</dt>
              <dd className="font-semibold text-on-surface wrap-break-word">{asunto}</dd>
            </div>
          </dl>
        </div>

        <div className="px-6 py-3.5 border-t border-outline-variant/40 bg-surface-container-low flex items-center justify-end gap-2.5">
          <SecondaryButton type="button" disabled={isSending} onClick={onClose}>
            Cancelar
          </SecondaryButton>
          <PrimaryButton
            type="button"
            icon="send"
            disabled={isSending}
            onClick={onConfirm}
          >
            {isSending ? 'Enviando...' : 'Confirmar y enviar'}
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
