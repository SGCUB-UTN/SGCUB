import { useMemo } from 'react'
import FilterSelect from '../shared/FilterSelect'
import CategoryFilter from '../cuota/CategoryFilter'
import { ALL_CATEGORIES } from '../cuota/cuotaCategories'
import {
  AFFILIATIONS,
  PERIOD_TYPES,
  PLAYERS,
  QUARTERS,
  lastQuarterOf,
  parseQuarterReference,
  quarterReference,
  yearOptions,
} from './delinquencyFilters'

const FILTER_CLASS = 'bg-surface-container-lowest border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const GROUP_CLASS = 'flex flex-wrap items-center gap-2 sm:pl-4 sm:border-l sm:border-outline-variant/40 sm:first:pl-0 sm:first:border-l-0'

function MorosidadFilters({ filters, onChange, categorias }) {
  const set = (field) => (event) => onChange({ [field]: event.target.value })
  const quarter = parseQuarterReference(filters.referencia)
  const categoryOptions = useMemo(
    () => categorias
      .map((categoria) => ({ value: String(categoria.categoria_id), name: categoria.nombre, gender: categoria.genero ?? '' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true })),
    [categorias],
  )

  const handleCategoryChange = (value) => {
    if (value && value !== ALL_CATEGORIES) {
      onChange({ tipo: PLAYERS, categoriaId: value })
    } else {
      onChange({ categoriaId: '' })
    }
  }

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
        ) : filters.periodo === 'trimestral' ? (
          <>
            <FilterSelect
              className={FILTER_CLASS}
              value={quarter.quarter}
              onChange={(event) => onChange({ referencia: quarterReference(quarter.year, Number(event.target.value)) })}
              aria-label="Trimestre"
            >
              {QUARTERS.map((option) => (
                <option key={option.value} value={option.value} disabled={option.value > lastQuarterOf(quarter.year)}>
                  {option.label}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              className={FILTER_CLASS}
              value={quarter.year}
              onChange={(event) => onChange({ referencia: quarterReference(event.target.value, quarter.quarter) })}
              aria-label="Año del trimestre"
            >
              {yearOptions().map((year) => <option key={year} value={year}>{year}</option>)}
            </FilterSelect>
          </>
        ) : (
          <FilterSelect className={FILTER_CLASS} value={filters.referencia} onChange={set('referencia')} aria-label="Año del reporte">
            {yearOptions().map((year) => <option key={year} value={year}>{year}</option>)}
          </FilterSelect>
        )}
      </div>

      <div className={GROUP_CLASS}>
        <FilterSelect
          etiqueta="Padrón:"
          className={FILTER_CLASS}
          value={filters.tipo}
          onChange={(event) => onChange({ tipo: event.target.value, categoriaId: '' })}
        >
          {AFFILIATIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </FilterSelect>
        {filters.tipo !== 'socios' && (
          <CategoryFilter
            value={filters.categoriaId || ALL_CATEGORIES}
            categories={categoryOptions}
            hasUncategorized={false}
            genderGroups
            onChange={handleCategoryChange}
          />
        )}
      </div>
    </div>
  )
}

export default MorosidadFilters
