export default function ScopeSelector({ scope, setScope, hasListSelection = false }) {
  const options = [
    ...(hasListSelection
      ? [
          {
            id: 'lista',
            label: 'Selección de listado',
            description: 'Destinatarios seleccionados desde otro módulo',
            icon: 'checklist',
          },
        ]
      : []),
    {
      id: 'individual',
      label: 'Socio individual',
      description: 'Enviar a una persona puntual del padrón',
      icon: 'person',
    },
    {
      id: 'segmentada',
      label: 'Por categorías',
      description: 'Jugadores activos de una o más categorías',
      icon: 'sports_soccer',
    },
    {
      id: 'padron',
      label: 'Todo el padrón activo',
      description: 'Comunicado general a todos los socios activos',
      icon: 'groups',
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        Alcance del envío
      </span>
      <div
        role="radiogroup"
        aria-label="Alcance del envío"
        className={`grid grid-cols-1 ${options.length === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3'} gap-3`}
      >
        {options.map((opt) => {
          const active = scope === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setScope(opt.id)}
              className={`flex items-start gap-3 p-3.5 rounded-lg border text-left transition-colors cursor-pointer ${
                active
                  ? 'border-primary bg-primary/8 text-on-surface shadow-2xs'
                  : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface'
              }`}
            >
              <span
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                  {opt.icon}
                </span>
              </span>
              <div className="min-w-0">
                <p className={`text-sm font-semibold ${active ? 'text-primary' : 'text-on-surface'}`}>
                  {opt.label}
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-snug">
                  {opt.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
