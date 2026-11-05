import { useEffect, useMemo, useState } from 'react'
import { getObrasSociales } from '../../api/personasConfig'
import useCategorias from '../../hooks/useCategorias'
import useGeneros from '../../hooks/useGeneros'
import useLocalidades from '../../hooks/useLocalidades'
import { GENDERS } from '../shared/categoryFilters'
import SegmentedControl from '../shared/SegmentedControl'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import AgeFilter from './AgeFilter'
import MultiFilter, { SingleFilter } from './MultiFilter'
import {
  COVERAGE_OPTIONS,
  DOCUMENTATION_OPTIONS,
  EDUCATION_OPTIONS,
  ENTITY_OPTIONS,
  INITIAL_FILTERS,
  SENIORITY_OPTIONS,
  STATUS_OPTIONS,
  VACCINATION_OPTIONS,
} from './reportFilters'

const COVERAGE_PREFIX = 'coverage:'
const NAME_PREFIX = 'name:'
const NO_GENDER_GROUP = 'Sin género'

const byLabel = (first, second) => first.label.localeCompare(second.label, 'es', { numeric: true })

const categoryOptionsOf = (categorias) => {
  const groups = [...GENDERS.map((gender) => gender.value), '']
  return categorias
    .map((categoria) => ({
      value: String(categoria.categoria_id),
      label: categoria.nombre,
      group: GENDERS.find((gender) => gender.value === categoria.genero)?.label ?? NO_GENDER_GROUP,
      order: groups.indexOf(categoria.genero ?? ''),
    }))
    .sort((first, second) => first.order - second.order || byLabel(first, second))
}

const healthInsuranceOptionsOf = (obrasSociales) => [
  ...COVERAGE_OPTIONS.map((option) => ({ value: `${COVERAGE_PREFIX}${option.value}`, label: option.label, group: 'Cobertura' })),
  ...obrasSociales
    .map((obra) => ({ value: `${NAME_PREFIX}${obra.nombre.toLowerCase()}`, label: obra.nombre, group: 'Obras sociales' }))
    .sort(byLabel),
]

const withoutPrefix = (values, prefix) => values.filter((value) => value.startsWith(prefix)).map((value) => value.slice(prefix.length))

function FilterGroup({ icon, title, children }) {
  return (
    <div role="group" aria-label={title} className="flex flex-col gap-2 min-w-0 p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low/40">
      <p className="flex items-center gap-2 pb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
        <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }} aria-hidden="true">{icon}</span>
        {title}
      </p>
      {children}
    </div>
  )
}

function useObrasSociales() {
  const [obrasSociales, setObrasSociales] = useState([])
  useEffect(() => {
    let active = true
    getObrasSociales()
      .then((received) => active && setObrasSociales(received))
      .catch(() => active && setObrasSociales([]))
    return () => { active = false }
  }, [])
  return obrasSociales
}

export default function PadronReportFilters({ filters, onChange, onApply, onClear, canApply, canClear }) {
  const { localidades } = useLocalidades()
  const { generos } = useGeneros()
  const { categorias } = useCategorias()
  const obrasSociales = useObrasSociales()

  const localityOptions = useMemo(
    () => localidades.map((localidad) => ({ value: String(localidad.localidad_id), label: localidad.nombre })).sort(byLabel),
    [localidades],
  )
  const genderOptions = useMemo(
    () => generos.map((genero) => ({ value: String(genero.genero_id), label: genero.nombre })),
    [generos],
  )
  const categoryOptions = useMemo(() => categoryOptionsOf(categorias), [categorias])
  const healthInsuranceOptions = useMemo(() => healthInsuranceOptionsOf(obrasSociales), [obrasSociales])
  const healthInsuranceValue = [
    ...filters.coverage.map((value) => `${COVERAGE_PREFIX}${value}`),
    ...filters.health_insurance.map((value) => `${NAME_PREFIX}${value}`),
  ]
  const invalidAges = filters.age_min !== '' && filters.age_max !== '' && Number(filters.age_min) > Number(filters.age_max)

  const multi = (name, label, options, allLabel) => (
    <MultiFilter label={label} options={options} value={filters[name]} onChange={(value) => onChange({ [name]: value })} allLabel={allLabel} />
  )

  return (
    <form
      className="flex flex-col gap-4"
      aria-label="Filtros del reporte"
      onSubmit={(event) => {
        event.preventDefault()
        if (canApply && !invalidAges) onApply()
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-on-surface-variant">Mostrar:</span>
        <SegmentedControl
          label="Entidad"
          options={ENTITY_OPTIONS}
          value={filters.entity}
          onChange={(entity) => onChange({ entity })}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FilterGroup icon="person" title="Datos personales">
          <AgeFilter filters={filters} onChange={onChange} />
          {multi('gender', 'Género', genderOptions)}
          {multi('education', 'Nivel educativo', EDUCATION_OPTIONS)}
          {multi('locality', 'Localidad', localityOptions, 'Todas')}
        </FilterGroup>

        <FilterGroup icon="medical_services" title="Salud">
          <MultiFilter
            label="Obra social"
            options={healthInsuranceOptions}
            value={healthInsuranceValue}
            onChange={(value) => onChange({ coverage: withoutPrefix(value, COVERAGE_PREFIX), health_insurance: withoutPrefix(value, NAME_PREFIX) })}
            allLabel="Todas"
            width={300}
          />
          {multi('vaccination', 'Vacunación', VACCINATION_OPTIONS)}
        </FilterGroup>

        <FilterGroup icon="badge" title="Administrativos">
          <SingleFilter
            label="Estado"
            options={STATUS_OPTIONS}
            value={filters.status}
            defaultValue={INITIAL_FILTERS.status}
            onChange={(status) => onChange({ status })}
          />
          {multi('seniority', 'Antigüedad', SENIORITY_OPTIONS, 'Todas')}
          {multi('documentation', 'Documentación', DOCUMENTATION_OPTIONS)}
        </FilterGroup>

        <FilterGroup icon="sports_soccer" title="Deportivos">
          {multi('category', 'Categoría', categoryOptions, 'Todas')}
        </FilterGroup>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-outline-variant/30">
        <SecondaryButton icon="filter_alt_off" onClick={onClear} disabled={!canClear}>Limpiar</SecondaryButton>
        <PrimaryButton type="submit" icon="filter_alt" disabled={!canApply || invalidAges}>Aplicar filtros</PrimaryButton>
      </div>
    </form>
  )
}
