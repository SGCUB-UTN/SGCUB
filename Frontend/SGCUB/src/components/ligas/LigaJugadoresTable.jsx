import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentationStatus from '../documental/DocumentationStatus'
import { DOCUMENTATION_LABELS, documentationSeverity } from '../documental/documentationStates'
import AccountStatus from '../finanzas/AccountStatus'
import { accountDebt } from '../finanzas/accountDebt'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import ClearFiltersButton from '../shared/ClearFiltersButton'
import DataTable from '../shared/DataTable'
import ExportMenu from '../shared/ExportMenu'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import { formatExportAmount } from '../shared/listExport'
import {
  ACCOUNT_FILTERS,
  ALL,
  DOCUMENTATION_FILTERS,
  FILTER_CLASS,
  FILTER_WIDTH,
  filterLabel,
  matchesAccountFilter,
  matchesDocumentationFilter,
} from '../shared/listFilters'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import { formatDni, isActiveStatus } from '../personas/format'

const COLUMN_COUNT = 8

const fullName = (jugador) => `${jugador.socio?.apellido ?? ''}, ${jugador.socio?.nombre ?? ''}`
const stateLabel = (jugador) => (isActiveStatus(jugador.estado?.nombre) ? jugador.estado?.nombre : 'Baja parcial')

const SORT_VALUES = {
  number: (jugador) => Number(jugador.socio?.numero_socio ?? 0),
  name: fullName,
  category: (jugador) => jugador.categoria?.nombre ?? '',
  documentation: (jugador) => documentationSeverity(jugador.documentacion),
  account: (jugador) => accountDebt(jugador.socio?.cuenta),
  state: (jugador) => jugador.estado?.nombre ?? '',
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }

const EXPORT_COLUMNS = [
  { header: 'N° socio', value: (jugador) => jugador.socio?.numero_socio },
  { header: 'Apellido y nombre', value: fullName },
  { header: 'DNI', value: (jugador) => formatDni(jugador.socio?.dni) },
  { header: 'Categoría', value: (jugador) => jugador.categoria?.nombre },
  { header: 'Documentación', value: (jugador) => DOCUMENTATION_LABELS[jugador.documentacion?.estado] },
  { header: 'Deuda', value: (jugador) => formatExportAmount(accountDebt(jugador.socio?.cuenta)) },
  { header: 'Cuotas vencidas', value: (jugador) => jugador.socio?.cuenta?.cuotas_vencidas ?? 0 },
  { header: 'Estado', value: stateLabel },
]

const categoryOptions = (jugadores) => {
  const categories = new Map()
  jugadores.forEach((jugador) => {
    if (jugador.categoria?.categoria_id) categories.set(String(jugador.categoria.categoria_id), jugador.categoria)
  })
  return [...categories.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))
}

const matchesCategory = (jugador, value) => value === ALL || String(jugador.categoria?.categoria_id) === value

const categoryLabel = (value, categories) => {
  if (value === ALL) return null
  const category = categories.find((item) => String(item.categoria_id) === value)
  return category ? `Categoría: ${category.nombre}` : null
}

const fileSlug = (text) => String(text ?? '').trim().toLowerCase().replace(/\s+/g, '-')

function LigaJugadoresTable({ jugadores, ligaNombre, onRemove }) {
  const navigate = useNavigate()
  const [category, setCategory] = useState(ALL)
  const [documentation, setDocumentation] = useState(ALL)
  const [account, setAccount] = useState(ALL)

  const categories = useMemo(() => categoryOptions(jugadores), [jugadores])
  const filtered = useMemo(() => jugadores.filter((jugador) => (
    matchesCategory(jugador, category)
    && matchesDocumentationFilter(jugador.documentacion, documentation)
    && matchesAccountFilter(jugador.socio?.cuenta, account)
  )), [jugadores, category, documentation, account])
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)

  const hasFilters = category !== ALL || documentation !== ALL || account !== ALL
  const clearFilters = () => {
    setCategory(ALL)
    setDocumentation(ALL)
    setAccount(ALL)
  }

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2">
          <FilterSelect
            className={FILTER_CLASS}
            width="sm:w-56"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value={ALL}>Todas las categorías</option>
            {categories.map((item) => <option key={item.categoria_id} value={String(item.categoria_id)}>{item.nombre}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
            value={documentation}
            onChange={(event) => setDocumentation(event.target.value)}
            aria-label="Filtrar por documentación"
          >
            {DOCUMENTATION_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            width={FILTER_WIDTH}
            value={account}
            onChange={(event) => setAccount(event.target.value)}
            aria-label="Filtrar por estado de cuenta"
          >
            {ACCOUNT_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </FilterSelect>
          <ClearFiltersButton onClick={clearFilters} visible={hasFilters} />
        </div>
        <ExportMenu
          title={`Jugadores de ${ligaNombre}`}
          filename={`jugadores-${fileSlug(ligaNombre)}`}
          columns={EXPORT_COLUMNS}
          items={sorted}
          filters={[
            categoryLabel(category, categories),
            filterLabel(DOCUMENTATION_FILTERS, documentation, 'Documentación'),
            filterLabel(ACCOUNT_FILTERS, account, 'Cuenta'),
          ]}
        />
      </div>

      <DataTable
        headerCase="title"
        headers={(
          <>
            <SortableHeader className="py-3 px-4 pl-6 w-28 whitespace-nowrap" etiqueta="N° Socio" columna="number" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4" etiqueta="Apellido y nombre" columna="name" orden={sort} onOrdenar={sortBy} />
            <th className="py-3 px-4" scope="col">DNI</th>
            <SortableHeader className="py-3 px-4" etiqueta="Categoría" columna="category" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 whitespace-nowrap" etiqueta="Documentación" columna="documentation" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 whitespace-nowrap text-right" etiqueta="Financiero" columna="account" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="state" orden={sort} onOrdenar={sortBy} />
            <th className="py-3 px-4 pr-6 text-right" scope="col">Acciones</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isEmpty={sorted.length === 0}
          emptyText="Ningún jugador de la liga coincide con los filtros."
          onClearFilters={clearFilters}
        />

        {sorted.map((jugador) => {
          const active = isActiveStatus(jugador.estado?.nombre)
          return (
            <tr
              key={jugador.jugador_id}
              onClick={() => navigate(`/padron/jugadores/${jugador.jugador_id}`)}
              className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
            >
              <td className="py-3 px-4 pl-6 font-bold text-primary text-base">
                {jugador.socio?.numero_socio ? `#${jugador.socio.numero_socio}` : '—'}
              </td>
              <td className="py-3 px-4 font-medium text-base">{fullName(jugador)}</td>
              <td className="py-3 px-4 text-on-surface-variant">{formatDni(jugador.socio?.dni)}</td>
              <td className="py-3 px-4 text-on-surface-variant">{jugador.categoria?.nombre ?? '—'}</td>
              <td className="py-3 px-4"><DocumentationStatus documentacion={jugador.documentacion} /></td>
              <td className="py-3 px-4 text-right whitespace-nowrap"><AccountStatus cuenta={jugador.socio?.cuenta} /></td>
              <td className="py-3 px-4">
                <ActiveStatusBadge isActive={active} label={stateLabel(jugador)} />
              </td>
              <td className="py-3 px-4 pr-6">
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/60 transition-colors cursor-pointer"
                    onClick={(event) => {
                      event.stopPropagation()
                      onRemove(jugador)
                    }}
                    title="Quitar de la liga"
                    aria-label={`Quitar a ${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''} de la liga`}
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person_remove</span>
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}

export default LigaJugadoresTable
