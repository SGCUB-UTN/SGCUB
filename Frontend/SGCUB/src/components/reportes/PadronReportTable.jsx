import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { formatDni } from '../personas/format'
import DataTable from '../shared/DataTable'
import { PANEL_CLASS, PANEL_HEADING_CLASS } from '../shared/panel'
import { matchesSearch } from '../shared/search'
import SectionHeading from '../shared/SectionHeading'
import SortableHeader from '../shared/SortableHeader'
import StatusBadge from '../shared/StatusBadge'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { formatCount } from '../cuota/cuotaPeriod'
import { peopleLabel } from './reportCharts'

const COLUMN_COUNT = 8
const CELL_CLASS = 'py-3 px-4'
const NOT_APPLICABLE = 'No aplica'
const ROLE_LABELS = {
  socios: 'Socio',
  jugadores: 'Jugador',
  baja_parcial: 'Jugador de baja parcial',
  docentes: 'Docente',
  docentes_socios: 'Docente y socio',
}
const VACCINATION_BADGES = {
  al_dia: { label: 'Al día', tono: 'ok' },
  pendiente: { label: 'Vacunas pendientes', tono: 'alerta' },
  sin_datos: { label: 'Sin datos', tono: 'neutro' },
}
const VACCINATION_ORDER = { al_dia: 0, pendiente: 1, sin_datos: 2 }

const fullName = (row) => `${row.last_name}, ${row.first_name}`

const healthInsuranceOf = (row) => {
  if (row.coverage === null) return null
  return row.health_insurance ?? 'Sin obra social'
}

const SORT_VALUES = {
  name: fullName,
  dni: (row) => Number(row.dni) || row.dni,
  role: (row) => ROLE_LABELS[row.role],
  age: (row) => row.age,
  locality: (row) => row.locality,
  vaccination: (row) => VACCINATION_ORDER[row.vaccination],
  health_insurance: healthInsuranceOf,
}

const muted = (text) => <span className="text-on-surface-variant">{text}</span>

export default function PadronReportTable({ people }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const filtered = useMemo(
    () => people.filter((row) => matchesSearch(query, [row.first_name, row.last_name, row.dni])),
    [people, query],
  )
  const { ordenadas, orden, ordenarPor } = useOrdenTabla(filtered, SORT_VALUES, { columna: 'name', direccion: 'asc' })
  const { visibleRows, withPageReset, paginationProps } = usePagination(ordenadas)
  const sortAndReset = withPageReset(ordenarPor)

  const header = (label, column, className = '') => (
    <SortableHeader className={`${CELL_CLASS} ${className}`} etiqueta={label} columna={column} orden={orden} onOrdenar={sortAndReset} />
  )

  return (
    <section className={PANEL_CLASS} aria-labelledby="padron-report-list-title">
      <SectionHeading
        id="padron-report-list-title"
        icon="list_alt"
        title="Listado"
        className={PANEL_HEADING_CLASS}
        actions={<span className="text-sm text-on-surface-variant tabular-nums">{peopleLabel(people.length)}</span>}
      />
      <div className="px-4 sm:px-5 py-3 flex flex-wrap items-center gap-3">
        <TableSearchInput
          value={query}
          onChange={withPageReset(setQuery)}
          placeholder="Buscar por nombre, apellido o DNI"
          label="Buscar en el listado"
        />
        {query && (
          <span className="text-sm text-on-surface-variant tabular-nums">
            {formatCount(filtered.length)} de {formatCount(people.length)}
          </span>
        )}
      </div>

      <DataTable
        headers={(
          <>
            {header('Nombre', 'name', 'pl-4 sm:pl-5')}
            {header('DNI', 'dni')}
            {header('Rol', 'role')}
            {header('Edad', 'age', 'text-right')}
            {header('Localidad', 'locality')}
            {header('Vacunación', 'vaccination')}
            {header('Obra social', 'health_insurance')}
            <th className={`${CELL_CLASS} pr-4 sm:pr-5 text-right`} scope="col"><span className="sr-only">Acciones</span></th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isEmpty={visibleRows.length === 0}
          emptyText="No hay personas que coincidan con la búsqueda."
        />
        {visibleRows.map((row) => {
          const healthInsurance = healthInsuranceOf(row)
          return (
            <tr
              key={row.persona_id}
              onClick={() => navigate(row.profile_url)}
              className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
            >
              <td className={`${CELL_CLASS} pl-4 sm:pl-5`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-on-surface text-base">{fullName(row)}</span>
                  {!row.active && <StatusBadge badge={{ label: 'Inactivo', tono: 'neutro' }} />}
                </div>
              </td>
              <td className={`${CELL_CLASS} text-on-surface-variant whitespace-nowrap`}>{formatDni(row.dni)}</td>
              <td className={CELL_CLASS}>{ROLE_LABELS[row.role]}</td>
              <td className={`${CELL_CLASS} text-right`}>{row.age ?? muted('—')}</td>
              <td className={CELL_CLASS}>{row.locality ?? muted('Sin datos')}</td>
              <td className={CELL_CLASS}>
                {row.vaccination ? <StatusBadge badge={VACCINATION_BADGES[row.vaccination]} /> : muted(NOT_APPLICABLE)}
              </td>
              <td className={CELL_CLASS}>{healthInsurance === null ? muted(NOT_APPLICABLE) : healthInsurance}</td>
              <td className={`${CELL_CLASS} pr-4 sm:pr-5 text-right`}>
                <Link
                  to={row.profile_url}
                  onClick={(event) => event.stopPropagation()}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold text-primary whitespace-nowrap hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  Ver perfil
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">chevron_right</span>
                </Link>
              </td>
            </tr>
          )
        })}
      </DataTable>

      <TablePagination id="padron-report-rows-per-page" {...paginationProps} />
    </section>
  )
}
