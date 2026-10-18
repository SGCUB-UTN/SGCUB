export default function MessageComposer({
  asunto,
  cuerpo,
  copiaSecretaria,
  onAsuntoChange,
  onCuerpoChange,
  onCopiaSecretariaChange,
  onDiscard,
  onPreview,
  onSubmit,
}) {
  const maxChars = 500
  const charCount = cuerpo.length

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado Bloque 2 */}
      <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-surface-container text-primary flex items-center justify-center text-xs font-bold">
          2
        </span>
        Contenido del Mensaje
      </h3>

      <div className="flex flex-col gap-4">
        {/* Asunto */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="msg-subject"
              className="text-sm font-semibold text-on-surface"
            >
              Asunto / Título institucional <span className="text-error">*</span>
            </label>
            <span className="text-xs text-on-surface-variant">
              Visible en el encabezado del correo y mensaje de WhatsApp
            </span>
          </div>
          <input
            id="msg-subject"
            type="text"
            value={asunto}
            onChange={(e) => onAsuntoChange(e.target.value)}
            placeholder="Ingrese el asunto oficial..."
            className="w-full h-10 px-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
        </div>

        {/* Cuerpo del mensaje */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="msg-body"
              className="text-sm font-semibold text-on-surface"
            >
              Cuerpo del mensaje <span className="text-error">*</span>
            </label>
            <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <span className="material-symbols-outlined text-[16px]">short_text</span>
              <span
                id="char-counter"
                className={`font-semibold ${
                  charCount > maxChars ? 'text-error' : 'text-on-surface'
                }`}
              >
                {charCount}
              </span>
              <span>/ {maxChars} caracteres (WhatsApp / Email)</span>
            </div>
          </div>
          <textarea
            id="msg-body"
            rows={5}
            value={cuerpo}
            onChange={(e) => onCuerpoChange(e.target.value)}
            placeholder="Redacte aquí el texto oficial de la comunicación..."
            className="w-full p-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors resize-y leading-relaxed"
          />
          <div className="flex items-start gap-1.5 text-xs text-on-surface-variant mt-1">
            <span className="material-symbols-outlined text-[16px] text-primary shrink-0 mt-0.5">
              info
            </span>
            <span>
              El mensaje se enviará automáticamente por correo electrónico o WhatsApp según los datos de
              contacto disponibles y validados en el legajo de cada destinatario.
            </span>
          </div>
        </div>

        {/* Opciones de Envío Complementarias */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg border border-outline-variant/30 bg-surface-container-low/50">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={copiaSecretaria}
                onChange={(e) => onCopiaSecretariaChange(e.target.checked)}
                className="w-4 h-4 rounded border-outline-variant/50 text-primary accent-primary cursor-pointer"
              />
              <span className="text-sm text-on-surface font-medium">
                Enviar copia de respaldo a Secretaría
              </span>
            </label>
          </div>
          <div className="flex items-center gap-1.5 text-on-surface-variant text-xs">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            <span>Programación: Envío inmediato</span>
          </div>
        </div>
      </div>

      {/* Barra de Acciones Inferior */}
      <div className="flex items-center justify-between pt-4 border-t border-outline-variant/20">
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">delete_outline</span>
          <span>Descartar borrador</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-sm font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">visibility</span>
            <span>Vista previa</span>
          </button>
          <button
            type="button"
            id="btn-submit-send"
            onClick={onSubmit}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            <span>Revisar y enviar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
