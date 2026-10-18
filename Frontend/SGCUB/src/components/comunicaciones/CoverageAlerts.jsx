export default function CoverageAlerts({
  validCount = 157,
  totalCount = 162,
  categoriesCount = 3,
  excludedCount = 5,
  onOpenExcluidos,
}) {
  const coveragePercent =
    totalCount > 0 ? ((validCount / totalCount) * 100).toFixed(1) : 0

  return (
    <div className="flex flex-col gap-2.5 mt-1">
      {/* Notificación de Cobertura / Destinatarios Habilitados */}
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary text-[22px] shrink-0">
            send
          </span>
          <div>
            <p className="text-sm font-semibold text-on-surface">
              {validCount} destinatarios con datos de contacto válidos de {totalCount} jugadores en{' '}
              {categoriesCount === 1 ? 'la categoría seleccionada' : `las ${categoriesCount} categorías seleccionadas`}.
            </p>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Se computan correos electrónicos verificados de deportistas y tutores declarados.
            </p>
          </div>
        </div>
        <span className="bg-primary/15 text-primary text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap border border-primary/20">
          {coveragePercent}% Cobertura
        </span>
      </div>

      {/* Alerta preventiva secundaria */}
      {excludedCount > 0 && (
        <div className="p-4 bg-error-container/20 border border-error/30 rounded-lg flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-error text-[22px] shrink-0">
              contact_phone
            </span>
            <div>
              <p className="text-sm font-semibold text-on-surface">
                {excludedCount} jugadores sin datos de contacto válidos (correo/teléfono), no recibirán este mensaje.
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Revise la lista de excluidos antes del envío para regularizar el legajo en Secretaría.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenExcluidos}
            className="text-xs text-primary hover:underline font-bold whitespace-nowrap cursor-pointer shrink-0"
          >
            Ver lista de excluidos
          </button>
        </div>
      )}
    </div>
  )
}
