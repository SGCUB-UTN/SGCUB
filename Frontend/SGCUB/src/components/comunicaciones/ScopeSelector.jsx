export default function ScopeSelector({ scope, onChange }) {
  const isIndividual = scope === 'individual'
  const isSegmentada = scope === 'segmentada'

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
        Alcance de Difusión
      </legend>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Opción Individual */}
        <label
          onClick={() => onChange('individual')}
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            isIndividual
              ? 'border-primary bg-primary/5 shadow-xs'
              : 'border-outline-variant/40 hover:bg-surface-container-low'
          }`}
        >
          <input
            type="radio"
            name="scope_type"
            value="individual"
            checked={isIndividual}
            onChange={() => onChange('individual')}
            className="mt-1 accent-primary cursor-pointer w-4 h-4"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className={`material-symbols-outlined text-[20px] ${
                  isIndividual ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                person
              </span>
              <span
                className={`font-semibold text-base ${
                  isIndividual ? 'text-primary' : 'text-on-surface'
                }`}
              >
                Individual
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Envío directo a jugador y sus responsables familiares asociados.
            </p>
          </div>
        </label>

        {/* Opción Masiva / Segmentada */}
        <label
          onClick={() => onChange('segmentada')}
          className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
            isSegmentada
              ? 'border-primary bg-primary/5 shadow-xs'
              : 'border-outline-variant/40 hover:bg-surface-container-low'
          }`}
        >
          <input
            type="radio"
            name="scope_type"
            value="segmentada"
            checked={isSegmentada}
            onChange={() => onChange('segmentada')}
            className="mt-1 accent-primary cursor-pointer w-4 h-4"
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className={`material-symbols-outlined text-[20px] ${
                  isSegmentada ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                groups
              </span>
              <span
                className={`font-semibold text-base ${
                  isSegmentada ? 'text-primary' : 'text-on-surface'
                }`}
              >
                Masiva / Segmentada
              </span>
            </div>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Difusión por planteles, divisiones y categorías deportivas del club.
            </p>
          </div>
        </label>
      </div>
    </fieldset>
  )
}
