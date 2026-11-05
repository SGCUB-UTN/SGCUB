import { useState } from 'react'
import { SecondaryButton } from '../personas/tabs/parts'

export default function PreviewModal({
  isOpen,
  onClose,
  asunto,
  cuerpo,
  canales,
  remitente,
}) {
  const [activeTab, setActiveTab] = useState(canales?.email ? 'email' : 'whatsapp')

  if (!isOpen) return null

  const currentTab =
    activeTab === 'email' && !canales?.email && canales?.whatsapp
      ? 'whatsapp'
      : activeTab === 'whatsapp' && !canales?.whatsapp && canales?.email
        ? 'email'
        : activeTab

  const clubNombre = remitente?.club_nombre || 'Club Universitario de Berisso'
  const nombreRemitente = remitente?.nombre_remitente || clubNombre
  const emailRemitente = remitente?.email_remitente || 'Sin correo configurado en .env'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
    >
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">
              visibility
            </span>
            <h2 id="preview-modal-title" className="text-base font-bold text-on-surface">
              Vista previa del comunicado
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Cerrar vista previa"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="px-6 pt-3 bg-surface-container-low border-b border-outline-variant/40 flex gap-2">
          {canales?.email && (
            <button
              type="button"
              onClick={() => setActiveTab('email')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'email'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">mail</span>
              Correo electrónico
            </button>
          )}
          {canales?.whatsapp && (
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'whatsapp'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chat</span>
              WhatsApp
            </button>
          )}
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-surface-container/30">
          {currentTab === 'email' ? (
            <div className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest overflow-hidden shadow-xs">
              <div className="px-5 py-2.5 bg-surface-container-low border-b border-outline-variant/40 text-xs text-on-surface-variant space-y-0.5">
                <p>
                  <strong className="text-on-surface">De:</strong> {nombreRemitente} &lt;{emailRemitente}&gt;
                </p>
                <p>
                  <strong className="text-on-surface">Asunto:</strong> [C.U.B.] {asunto || '(Sin asunto)'}
                </p>
              </div>

              <div className="bg-slate-900 px-6 py-4 text-slate-50 flex items-center gap-3.5">
                <img
                  src="/escudo-sin-fondo.png"
                  alt="Escudo C.U.B."
                  className="w-11 h-11 object-contain shrink-0"
                />
                <div>
                  <p className="text-base font-bold text-white leading-snug">{clubNombre}</p>
                  <p className="text-xs text-slate-400">Comunicado institucional</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <h3 className="text-base font-bold text-on-surface pb-3 border-b border-outline-variant/30">
                  {asunto || '(Sin asunto)'}
                </h3>
                <div className="text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
                  {cuerpo || '(El cuerpo del mensaje está vacío)'}
                </div>
                <div className="pt-3.5 mt-4 border-t border-outline-variant/40 text-xs text-on-surface-variant">
                  <p>Atentamente,</p>
                  <p className="text-xs font-bold text-on-surface mt-0.5">
                    Secretaría y Comisión Directiva
                  </p>
                </div>
              </div>

              <div className="px-6 py-3 bg-surface-container-low border-t border-outline-variant/30 text-center text-[11px] text-on-surface-variant">
                <p>Por consultas, comuníquese con secretaría.</p>
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto rounded-xl border border-outline-variant/50 bg-[#efeae2] overflow-hidden shadow-xs">
              <div className="bg-slate-900 px-4 py-3 text-white flex items-center gap-3">
                <img
                  src="/escudo-sin-fondo.png"
                  alt="Escudo C.U.B."
                  className="w-8 h-8 object-contain shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold leading-tight">{clubNombre}</p>
                  <p className="text-[11px] text-slate-300">Secretaría</p>
                </div>
              </div>
              <div className="p-4">
                <div className="bg-white rounded-lg p-3.5 shadow-2xs text-xs text-slate-800 space-y-2">
                  {asunto && <p className="font-bold text-slate-900">*{asunto}*</p>}
                  <p className="whitespace-pre-wrap leading-relaxed">
                    {cuerpo || '(El cuerpo del mensaje está vacío)'}
                  </p>
                  <p className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                    — Secretaría y Comisión Directiva
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-outline-variant/40 bg-surface-container-low flex justify-end">
          <SecondaryButton type="button" onClick={onClose}>
            Cerrar
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
