import FilterSelect from '../shared/FilterSelect'
import { getGeneroLabel } from '../categorias/categoriaFormat'
import { AFFILIATIONS, PERIOD_TYPES, SCOPES, referenceOptions } from './delinquencyFilters'

const FILTER_CLASS = 'bg-surface-container-lowest border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const GROUP_CLASS = 'flex flex-wrap items-center gap-2 sm:pl-4 sm:border-l sm:border-outline-variant/40 sm:first:pl-0 sm:first:border-l-0'

const categoryLabel = (categoria) => (
  categoria.genero ? `${categoria.nombre} (${getGeneroLabel(categoria.genero)})` : categoria.nombre
)

function MorosidadFilters({ filters, onChange, categorias }) {
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
