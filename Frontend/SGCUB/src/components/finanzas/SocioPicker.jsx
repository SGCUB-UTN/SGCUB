import { useEffect, useMemo, useRef, useState } from 'react'
import useSocio from '../../hooks/useSocio'
import { formatDni, formatNumber, isActiveStatus } from '../personas/format'
import { matchesSearch } from '../shared/search'

const MAX_RESULTS = 8

function ResultsList({ results, onSelect, className = '' }) {
  return (
    <ul className={`border border-outline-variant/30 rounded-lg divide-y divide-outline-variant/20 bg-surface-container-lowest ${className}`}>
      {results.map((socio) => (
        <li key={socio.socio_id}>
          <button
            type="button"
            onClick={() => onSelect(socio)}
            className="w-full flex items-center justify-between gap-4 p-3 text-left bg-surface-container-lowest hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <strong className="block text-on-surface truncate">{socio.apellido}, {socio.nombre}</strong>
                {socio.es_jugador && (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                    Jugador
                  </span>
                )}
              </span>
              <span className="text-sm text-on-surface-variant">DNI {formatDni(socio.dni)} · Socio {formatNumber(socio.numero_socio)}</span>
            </span>
            <span className="material-symbols-outlined text-on-surface-variant shrink-0" aria-hidden="true">arrow_forward</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Search box limited to active socios: inactive ones can't register payments.
// `compact` drops the heading, uses the full width and floats the results over the content
// below (used as the header of the empty payment form).
// `excludedId` leaves a socio out of the results (e.g. the one a payment was wrongly registered to)
function SocioPicker({
  onSelect,
  compact = false,
  excludedId = null,
  description = 'Buscá por nombre, apellido, DNI o número de socio.',
  placeholder = 'Nombre, DNI o N° de socio',
}) {
  const { socios, isLoading, error } = useSocio()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(true)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleClickOutside)
    return () => document.removeEventListener('pointerdown', handleClickOutside)
  }, [])

  const activeSocios = useMemo(
    () => socios.filter((socio) => isActiveStatus(socio.estado_administrativo_nombre) && socio.socio_id !== excludedId),
    [socios, excludedId],
  )

  const results = useMemo(() => {
    const term = query.trim()
    if (!term) return []
    return activeSocios
      .filter((socio) => matchesSearch(term, [socio.dni, socio.numero_socio, socio.nombre, socio.apellido, `${socio.nombre} ${socio.apellido}`, `${socio.apellido} ${socio.nombre}`]))
      .slice(0, MAX_RESULTS)
  }, [query, activeSocios])

  const noMatches = !isLoading && query.trim() && results.length === 0

  return (
    <section
      ref={containerRef}
      className={`flex flex-col ${compact ? 'gap-2' : 'gap-4'}`}
      aria-labelledby={compact ? undefined : 'socio-picker-title'}
      aria-label={compact ? 'Buscar socio' : undefined}
    >
      {!compact && (
        <div className="flex items-start gap-3 mb-2">
          <span className="material-symbols-outlined text-primary text-2xl mt-0.5" aria-hidden="true">manage_search</span>
          <div>
            <h2 id="socio-picker-title" className="text-2xl font-bold text-on-surface">Buscar socio</h2>
            <p className="text-base text-on-surface-variant">{description}</p>
          </div>
        </div>
      )}

      <div className={`relative ${compact ? 'w-full' : 'max-w-2xl'}`}>
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true">search</span>
        <input
          autoFocus
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setIsOpen(true)
          }}
          className="w-full h-11 pl-10 pr-4 bg-surface-container-low border border-outline-variant/40 rounded-lg text-on-surface focus:outline-none focus:border-primary"
          placeholder={placeholder}
          aria-label={placeholder}
        />
        {compact && isOpen && results.length > 0 && (
          <ResultsList results={results} onSelect={onSelect} className="absolute z-30 left-0 right-0 top-full mt-1 shadow-xl max-h-72 overflow-y-auto" />
        )}
        {compact && isOpen && noMatches && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1 p-3 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-xl text-sm text-on-surface-variant">
            No encontramos socios activos con ese criterio.
          </div>
        )}
      </div>

      {isLoading && <p className="text-sm text-on-surface-variant">Cargando socios...</p>}
      {error && <p className="text-sm text-error" role="alert">No se pudieron cargar los socios.</p>}

      {!compact && results.length > 0 && <ResultsList results={results} onSelect={onSelect} className="max-w-2xl overflow-hidden" />}

      {!compact && noMatches && <p className="text-sm text-on-surface-variant">No encontramos socios activos con ese criterio.</p>}
    </section>
  )
}

export default SocioPicker
