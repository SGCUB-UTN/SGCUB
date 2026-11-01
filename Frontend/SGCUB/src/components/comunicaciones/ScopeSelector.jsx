const OPTIONS = [
  {
    value: 'individual',
    icon: 'person',
    label: 'Individual',
    description: 'Envío directo a jugador y sus responsables familiares asociados.',
  },
  {
    value: 'segmentada',
    icon: 'groups',
    label: 'Masiva / Segmentada',
    description: 'Difusión por planteles, divisiones y categorías deportivas del club.',
  },
  {
    value: 'lista',
    icon: 'checklist',
    label: 'Morosos del reporte',
    description: 'Envío a los socios con deuda vencida del reporte de morosidad.',
  },
]

export default function ScopeSelector({ scope, onChange, showList = false }) {
  const options = OPTIONS.filter((option) => showList || option.value !== 'lista')

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
        Alcance de Difusión
      </legend>
      <div className={`grid grid-cols-1 gap-3 ${showList ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
        {options.map((option) => {
          const isSelected = scope === option.value
          return (
            <label
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                isSelected
                  ? 'border-primary bg-primary/5 shadow-xs'
                  : 'border-outline-variant/40 hover:bg-surface-container-low'
              }`}
            >
              <input
                type="radio"
                name="scope_type"
                value={option.value}
                checked={isSelected}
                onChange={() => onChange(option.value)}
                className="mt-1 accent-primary cursor-pointer w-4 h-4"
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`material-symbols-outlined text-[20px] ${
                      isSelected ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {option.icon}
                  </span>
                  <span
                    className={`font-semibold text-base ${
                      isSelected ? 'text-primary' : 'text-on-surface'
                    }`}
                  >
                    {option.label}
                  </span>
                </div>
                <p className="text-sm text-on-surface-variant mt-0.5">
                  {option.description}
                </p>
              </div>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
