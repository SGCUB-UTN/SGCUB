import { formatDni, formatPhone } from '../personas/format'

export default function ListRecipientsSummary({
  recipients = [],
  scopeLabel,
  missingSocioCount = 0,
  onClearList,
}) {
  return (
    <div className="border border-outline-variant/40 rounded-lg bg-surface-container-lowest overflow-hidden">
      <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
            Destinatarios preseleccionados
          </span>
          <h4 className="text-sm font-bold text-on-surface">
            {recipients.length} {recipients.length === 1 ? 'persona seleccionada' : 'personas seleccionadas'}
            {scopeLabel ? ` · ${scopeLabel}` : ''}
          </h4>
        </div>
        {onClearList && (
          <button
            type="button"
            onClick={onClearList}
            className="text-xs font-semibold text-on-surface-variant hover:text-on-surface cursor-pointer"
          >
            Cambiar selección manualmente
          </button>
        )}
      </div>

      {missingSocioCount > 0 && (
        <div className="px-4 py-2.5 bg-warning-container/40 border-b border-warning/25 text-xs text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-warning shrink-0" aria-hidden="true">
            info
          </span>
          <span>
            {missingSocioCount} {missingSocioCount === 1 ? 'persona seleccionada no registra' : 'personas seleccionadas no registran'}{' '}
            ficha de socio y no puede asociarse a un envío.
          </span>
        </div>
      )}

      <ul className="divide-y divide-outline-variant/30 max-h-56 overflow-y-auto">
        {recipients.map((socio) => {
          const hasEmail = Boolean(socio.email && socio.email.includes('@'))
          const hasPhone = Boolean(socio.telefono && String(socio.telefono).trim().length > 0)
          return (
            <li key={socio.socio_id || socio.dni} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
              <div className="min-w-0">
                <span className="font-semibold text-on-surface">
                  {socio.nombre} {socio.apellido}
                </span>
                <span className="text-on-surface-variant ml-2 tabular-nums">
                  DNI {formatDni(socio.dni)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
                <span>{hasEmail ? socio.email : 'Sin email'}</span>
                <span>·</span>
                <span className="tabular-nums">{hasPhone ? formatPhone(socio.telefono) : 'Sin teléfono'}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
