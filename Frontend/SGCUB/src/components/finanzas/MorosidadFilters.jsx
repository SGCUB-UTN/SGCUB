import FilterSelect from '../shared/FilterSelect'
import { getGeneroLabel } from '../categorias/categoriaFormat'
import { formatDni } from '../personas/format'
import SocioPicker from './SocioPicker'
import { AFFILIATIONS, PERIOD_TYPES, SCOPES, referenceOptions } from './delinquencyFilters'

const FILTER_CLASS = 'bg-surface-container-lowest border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const GROUP_CLASS = 'flex flex-wrap items-center gap-2 sm:pl-4 sm:border-l sm:border-outline-variant/40 sm:first:pl-0 sm:first:border-l-0'

const categoryLabel = (categoria) => (
  categoria.genero ? `${categoria.nombre} (${getGeneroLabel(categoria.genero)})` : categoria.nombre
)

function SelectedSocio({ socio, onClear }) {
  return (
    <span className="inline-flex items-center gap-2 h-10 pl-3 pr-1 bg-surface-container-lowest border border-outline-variant/40 rounded text-sm">
      <span className="font-semibold text-on-surface">{socio.apellido}, {socio.nombre}</span>
      {socio.es_jugador && (
        <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
          Jugador
        </span>
      )}
      <span className="text-on-surface-variant">DNI {formatDni(socio.dni)}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label="Cambiar socio"
        title="Cambiar socio"
        className="inline-flex items-center justify-center w-8 h-8 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low cursor-pointer"
      >
        <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">close</span>
      </button>
    </span>
  )
}

function MorosidadFilters({ filters, onChange, categorias, socio, onSocioChange }) {
  const set = (field) => (event) => onChange({ [field]: event.target.value })

  return (
    <div className="flex flex-wrap items-center gap-4" role="group" aria-label="Filtros del reporte">
      <div className={GROUP_CLASS}>
        <FilterSelect etiqueta="Período:" className={FILTER_CLASS} value={filters.periodo} onChange={set('periodo')}>
          {PERIOD_TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </FilterSelect>
        {filters.periodo === 'mensual' ? (
          <input
            type="month"
            value={filters.referencia}
            onChange={(event) => event.target.value && onChange({ referencia: event.target.value })}
            aria-label="Mes del reporte"
            className={`h-10 px-3 ${FILTER_CLASS}`}
          />
        ) : (
          <FilterSelect className={FILTER_CLASS} value={filters.referencia} onChange={set('referencia')} aria-label="Referencia del período">
            {referenceOptions(filters.periodo).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </FilterSelect>
        )}
      </div>

      <div className={GROUP_CLASS}>
        <FilterSelect etiqueta="Alcance:" className={FILTER_CLASS} value={filters.alcance} onChange={set('alcance')}>
          {SCOPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </FilterSelect>
        {filters.alcance === 'categoria' && (
          <FilterSelect className={FILTER_CLASS} value={filters.categoriaId} onChange={set('categoriaId')} aria-label="Categoría">
            <option value="">Elegí una categoría</option>
            {categorias.map((categoria) => (
              <option key={categoria.categoria_id} value={categoria.categoria_id}>{categoryLabel(categoria)}</option>
            ))}
          </FilterSelect>
        )}
        {filters.alcance === 'socio' && (
          socio
            ? <SelectedSocio socio={socio} onClear={() => onSocioChange(null)} />
            : (
              <div className="w-full sm:w-80">
                <SocioPicker compact placeholder="Buscar socio o jugador..." onSelect={onSocioChange} />
              </div>
            )
        )}
      </div>

      <div className={GROUP_CLASS}>
        <FilterSelect etiqueta="Tipo:" className={FILTER_CLASS} value={filters.tipo} onChange={set('tipo')}>
          {AFFILIATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </FilterSelect>
      </div>
    </div>
  )
}

export default MorosidadFilters
