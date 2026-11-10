import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'

const PLANTILLAS_CLUB = [
  {
    id: 'deportivo',
    label: 'Citación deportiva',
    icon: 'sports_soccer',
    asunto: 'Información de entrenamientos y jornada deportiva',
    cuerpo:
      'Estimados jugadores y familias:\n\nLes informamos los horarios y detalles correspondientes a la próxima jornada deportiva.\n\n• Día y horario: \n• Lugar: Predio deportivo\n• Indumentaria: concurrir con ropa oficial e hidratación.\n\nAnte cualquier eventualidad, dar aviso al cuerpo técnico.',
  },
  {
    id: 'cuota',
    label: 'Recordatorio de cuota',
    icon: 'receipt_long',
    asunto: 'Aviso de vencimiento de cuota social',
    cuerpo:
      'Estimado/a socio/a:\n\nLe recordamos que se encuentra al cobro la cuota social correspondiente al período en curso.\n\nPuede acercarse a la secretaría en los horarios habituales de atención para regularizar su estado de cuenta o realizar consultas.',
  },
  {
    id: 'documentacion',
    label: 'Documentación pendiente',
    icon: 'assignment_ind',
    asunto: 'Solicitud de documentación deportiva',
    cuerpo:
      'Estimado/a socio/a y familia:\n\nLes solicitamos acercar a secretaría la documentación pendiente (DNI y/o certificado de aptitud física vigente) a fin de mantener al día la habilitación deportiva.',
  },
  {
    id: 'institucional',
    label: 'Comunicado general',
    icon: 'campaign',
    asunto: 'Comunicado para socios y familias',
    cuerpo:
      'Estimados socios y familias:\n\nPor medio del presente nos dirigimos a ustedes para informarles las próximas novedades y disposiciones de la institución.',
  },
]

export default function MessageComposer({
  asunto,
  setAsunto,
  cuerpo,
  setCuerpo,
  copiaSecretaria,
  setCopiaSecretaria,
  remitente,
  validationError,
  onOpenPreview,
  onOpenConfirm,
}) {
  const clubNombre = remitente?.club_nombre || 'Club Universitario de Berisso'
  const emailSecretaria = remitente?.email_secretaria || remitente?.email_remitente || ''

  const aplicarPlantilla = (plantilla) => {
    setAsunto(plantilla.asunto)
    setCuerpo(plantilla.cuerpo)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Plantillas sugeridas
          </span>
          <span className="text-xs text-on-surface-variant">
            Seleccioná una base o redactá el comunicado directamente
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PLANTILLAS_CLUB.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => aplicarPlantilla(p)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-low hover:bg-surface-container text-xs font-medium text-on-surface transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant" aria-hidden="true">
                {p.icon}
              </span>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comunicacion-asunto" className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
          Asunto <span className="text-error">*</span>
        </label>
        <input
          id="comunicacion-asunto"
          type="text"
          value={asunto}
          onChange={(e) => setAsunto(e.target.value)}
          placeholder="Ej: Información de entrenamientos, Aviso de secretaría..."
          className="w-full h-10 px-3.5 text-sm rounded-lg border border-outline-variant/60 bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="comunicacion-cuerpo" className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            Cuerpo del comunicado <span className="text-error">*</span>
          </label>
          <span className="text-xs text-on-surface-variant tabular-nums">
            {cuerpo.length} caracteres
          </span>
        </div>

        <div className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest overflow-hidden focus-within:border-primary transition-colors">
          <div className="px-4 py-2.5 bg-slate-900 text-slate-100 flex items-center gap-3">
            <img
              src="/escudo-sin-fondo.png"
              alt="Escudo C.U.B."
              className="w-7 h-7 object-contain shrink-0"
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-white leading-tight truncate">{clubNombre}</p>
              <p className="text-[11px] text-slate-400 leading-tight">Comunicado institucional</p>
            </div>
          </div>

          <textarea
            id="comunicacion-cuerpo"
            rows={7}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            placeholder="Estimados socios y familias:..."
            className="w-full p-3.5 text-sm bg-transparent text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none resize-y leading-relaxed"
          />

          <div className="px-4 py-2 bg-surface-container-low/70 border-t border-outline-variant/30 text-xs text-on-surface-variant flex items-center justify-between gap-2">
            <span>
              Firma al pie: <strong className="text-on-surface font-medium">Atentamente, Secretaría y Comisión Directiva</strong>
            </span>
          </div>
        </div>
      </div>

      {validationError && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-error-container/40 border border-error/25 flex items-center gap-2 text-xs text-on-error-container"
        >
          <span className="material-symbols-outlined text-[18px] text-error shrink-0" aria-hidden="true">
            error
          </span>
          <span>{validationError}</span>
        </div>
      )}

      <div className="pt-3 border-t border-outline-variant/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <label className="inline-flex items-center gap-2.5 text-xs text-on-surface cursor-pointer select-none">
          <input
            type="checkbox"
            checked={copiaSecretaria}
            onChange={(e) => setCopiaSecretaria(e.target.checked)}
            className="w-4 h-4 rounded accent-primary cursor-pointer"
          />
          <span>
            Enviar copia de respaldo a secretaría
            {emailSecretaria ? (
              <span className="text-on-surface-variant"> ({emailSecretaria})</span>
            ) : null}
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-end gap-2.5">
          <SecondaryButton type="button" icon="visibility" onClick={onOpenPreview}>
            Vista previa
          </SecondaryButton>
          <PrimaryButton type="button" icon="send" onClick={onOpenConfirm}>
            Revisar y enviar
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}
