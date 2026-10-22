import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import useOrdenTabla from '../../hooks/useOrdenTabla'

const PAGE_SIZE = 5

// Distance to today works for both tables: days left for upcoming, overdue days for expired.
const SORT_VALUES = {
  person: (doc) => doc.persona_nombre_completo || '',
  dueDate: (doc) => Math.abs(doc.daysFromToday),
}
const INITIAL_SORT = { columna: 'dueDate', direccion: 'asc' }
const HEADER_CLASS = 'py-3 px-4'
const COLUMN_COUNT = 3
const SELECT_CLASS = 'bg-surface-container-low text-on-surface font-body-sm text-sm font-medium rounded-lg focus:outline-none focus:bg-surface-container-lowest cursor-pointer'
const ALL = 'all'
const compareText = new Intl.Collator('es', { sensitivity: 'base' }).compare

const TONES = {
  warning: {
    icon: 'bg-secondary-fixed text-on-secondary-fixed',
    count: 'bg-secondary-fixed text-on-secondary-fixed',
    row: 'hover:bg-surface-container-low focus:bg-surface-container-low',
    name: 'group-hover:text-primary',
    document: 'text-on-surface',
    badge: 'bg-secondary-fixed text-on-secondary-fixed',
    loadMore: 'text-primary',
  },
  error: {
    icon: 'bg-error-container text-error',
    count: 'bg-error text-on-error',
    row: 'hover:bg-error-container/20 focus:bg-error-container/20',
    name: 'group-hover:text-error',
    document: 'text-error',
    badge: 'bg-error-container text-error',
    loadMore: 'text-error',
  },
}

const matchesSearch = (doc, search, getTypeName) => {
  const text = search.toLowerCase()
  return (doc.persona_nombre_completo || '').toLowerCase().includes(text) ||
    getTypeName(doc.tipo_documento).toLowerCase().includes(text)
}

const matchesFilters = (doc, category, docType) =>
  (category === ALL || doc.categoria_nombre === category) &&
  (docType === ALL || String(doc.tipo_documento) === docType)

const getCategoryOptions = (rows) =>
  [...new Set(rows.map(doc => doc.categoria_nombre).filter(Boolean))].sort(compareText)

const getTypeOptions = (rows, getTypeName) =>
  [...new Set(rows.map(doc => String(doc.tipo_documento)))]
    .map(id => ({ id, name: getTypeName(id) }))
    .sort((a, b) => compareText(a.name, b.name))

export default function DocumentAlertTable({ title, icon, tone = 'warning', documentHeader, dateHeader, rows, getBadgeLabel, getTypeName, emptyMessage }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState(ALL)
  const [docType, setDocType] = useState(ALL)
  const [limit, setLimit] = useState(PAGE_SIZE)
  const style = TONES[tone] ?? TONES.warning

  const filteredRows = rows.filter(doc => matchesSearch(doc, search, getTypeName) && matchesFilters(doc, category, docType))
  const { ordenadas: sortedRows, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filteredRows, SORT_VALUES, INITIAL_SORT)
  const visibleRows = sortedRows.slice(0, limit)
  const openProfile = (doc) => navigate(`${doc.url_perfil}?tab=documentacion`)

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-sm flex flex-col overflow-hidden">
      <div className="p-space-lg bg-surface-container-lowest flex flex-col gap-space-md border-b border-surface-container">
        <div className="flex items-center gap-space-sm">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${style.icon}`}>
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
          </div>
          <h2 className="text-lg font-semibold text-on-surface">{title}</h2>
          <span className={`ml-auto text-sm px-2.5 py-0.5 rounded-full font-semibold ${style.count}`}>{rows.length}</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
            <input
              className="w-full h-10 pl-9 pr-4 bg-surface-container-low text-on-surface placeholder:text-outline font-body-sm text-sm rounded-lg focus:outline-none focus:bg-surface-container-lowest transition-all"
              placeholder="Filtrar por jugador o documento..."
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <FilterSelect className={SELECT_CLASS} value={category} onChange={e => setCategory(e.target.value)} aria-label="Filtrar por categoría">
              <option value={ALL}>Categoría: Todas</option>
              {getCategoryOptions(rows).map(name => <option key={name} value={name}>{name}</option>)}
            </FilterSelect>
            <FilterSelect className={SELECT_CLASS} value={docType} onChange={e => setDocType(e.target.value)} aria-label="Filtrar por tipo de documento">
              <option value={ALL}>Tipo: Todos</option>
              {getTypeOptions(rows, getTypeName).map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </FilterSelect>
          </div>
        </div>
      </div>
      <DataTable
        headers={(
          <>
            <SortableHeader className={HEADER_CLASS} etiqueta="Persona / Categoría" columna="person" orden={sort} onOrdenar={sortBy} />
            <th className={HEADER_CLASS} scope="col">{documentHeader}</th>
            <SortableHeader className={HEADER_CLASS} etiqueta={dateHeader} columna="dueDate" orden={sort} onOrdenar={sortBy} />
          </>
        )}
      >
        {visibleRows.map(doc => (
          <tr
            key={doc.id_documento}
            onClick={() => openProfile(doc)}
            onKeyDown={(e) => e.key === 'Enter' && openProfile(doc)}
            tabIndex={0}
            className={`transition-colors cursor-pointer group focus:outline-none ${style.row}`}
          >
            <td className="py-3 px-4">
              <div className="flex flex-col min-w-0">
                <span className={`font-medium text-base text-on-surface truncate transition-colors ${style.name}`}>{doc.persona_nombre_completo || 'Desconocido'}</span>
                <span className="text-sm text-on-surface-variant truncate">{doc.categoria_nombre || ''}</span>
              </div>
            </td>
            <td className="py-3 px-4">
              <span className={`font-medium ${style.document}`}>{getTypeName(doc.tipo_documento)}</span>
            </td>
            <td className="py-3 px-4 whitespace-nowrap">
              <span className="block font-medium text-on-surface">{doc.dueDateLabel}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold mt-1 ${style.badge}`}>
                {getBadgeLabel(doc)}
              </span>
            </td>
          </tr>
        ))}
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isEmpty={visibleRows.length === 0}
          emptyText={rows.length === 0 ? emptyMessage : 'No hay documentos que coincidan con los filtros'}
        />
      </DataTable>
      {filteredRows.length > limit && (
        <div className="p-space-md bg-surface-container-low flex items-center justify-between">
          <span className="text-sm text-on-surface-variant">Mostrando {limit} de {filteredRows.length}</span>
          <button
            onClick={() => setLimit(limit + PAGE_SIZE)}
            className={`text-sm font-semibold hover:underline cursor-pointer ${style.loadMore}`}
          >
            Cargar más ↓
          </button>
        </div>
      )}
    </div>
  )
}
