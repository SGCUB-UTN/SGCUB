import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import { formatDate } from '../personas/format'
import { parseDueDate } from './dueDate'
import { matchesSearch } from '../shared/search'

const STATUS_LABELS = {
  vigente: { label: 'Vigente / Aprobado', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-600' },
  por_vencer: { label: 'Por vencer', badge: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-600' },
  vencido: { label: 'Vencido', badge: 'bg-error-container text-error border border-error/20', dot: 'bg-error' },
}
const STATUS_ORDER = { vencido: 0, por_vencer: 1, vigente: 2 }

const SORT_VALUES = {
  type: (doc) => doc.typeName,
  issueDate: (doc) => doc.fecha_emision || null,
  dueDate: (doc) => (doc.daysFromToday === null ? null : Math.abs(doc.daysFromToday)),
  status: (doc) => STATUS_ORDER[doc.status] ?? null,
}
const INITIAL_SORT = { columna: 'dueDate', direccion: 'asc' }
const COLUMN_COUNT = 5

const ALL = 'all'
const HEADER_CLASS = 'py-3 px-4'
const SELECT_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const PRIMARY_ACTION_CLASS = 'text-primary hover:bg-primary-fixed/30'
const DANGER_ACTION_CLASS = 'text-error hover:bg-error-container/60'
const FILE_MISSING_MESSAGE = 'El archivo físico ya no existe o fue eliminado del servidor.'
const compareText = new Intl.Collator('es', { sensitivity: 'base' }).compare

const getMediaUrl = (path) => {
  if (path.startsWith('http')) return path
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'
  return `${baseUrl.replace(/\/api\/?$/, '')}${path}`
}

const openFile = async (path) => {
  const url = getMediaUrl(path)
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok) window.open(url, '_blank')
    else alert(FILE_MISSING_MESSAGE)
  } catch {
    alert(FILE_MISSING_MESSAGE)
  }
}

function ActionButton({ icon, label, className, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer ${className}`}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
    </button>
  )
}

export default function PersonaDocumentsTable({ title, documents, getTypeName, onEdit, onDelete, isHistory = false }) {
  const [search, setSearch] = useState('')
  const [docType, setDocType] = useState(ALL)
  const [status, setStatus] = useState(ALL)

  const rows = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return documents.map(doc => ({
      ...doc,
      typeName: getTypeName(doc.tipo_documento),
      daysFromToday: doc.fecha_vencimiento ? parseDueDate(doc, today).daysFromToday : null,
    }))
  }, [documents, getTypeName])

  const typeOptions = useMemo(() =>
    [...new Map(rows.map(doc => [String(doc.tipo_documento), doc.typeName])).entries()]
      .sort((a, b) => compareText(a[1], b[1])),
  [rows])

  const filteredRows = useMemo(() => {
    return rows.filter(doc =>
      matchesSearch(search, [doc.typeName]) &&
      (docType === ALL || String(doc.tipo_documento) === docType) &&
      (status === ALL || doc.status === status))
  }, [rows, search, docType, status])

  const { ordenadas: sortedRows, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filteredRows, SORT_VALUES, INITIAL_SORT)

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      {title && (
        <div className="px-6 py-4 border-b border-outline-variant/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">history</span>
          <h3 className="text-lg font-semibold text-on-surface">{title}</h3>
          <span className="ml-auto text-sm text-on-surface-variant">{rows.length} documentos</span>
        </div>
      )}
      <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
        <TableSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filtrar por tipo de documento..."
          label="Filtrar documentos"
        />
        <FilterSelect className={SELECT_CLASS} value={docType} onChange={e => setDocType(e.target.value)} aria-label="Filtrar por tipo de documento">
          <option value={ALL}>Tipo: Todos</option>
          {typeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </FilterSelect>
        {!isHistory && (
          <FilterSelect className={SELECT_CLASS} value={status} onChange={e => setStatus(e.target.value)} aria-label="Filtrar por estado">
            <option value={ALL}>Estado: Todos</option>
            {Object.entries(STATUS_LABELS).map(([key, { label }]) => <option key={key} value={key}>{label}</option>)}
          </FilterSelect>
        )}
      </div>
      <DataTable
        headers={(
          <>
            <SortableHeader className={`${HEADER_CLASS} pl-6`} etiqueta="Documento" columna="type" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Emisión" columna="issueDate" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Vencimiento" columna="dueDate" orden={sort} onOrdenar={sortBy} />
            {isHistory
              ? <th className={HEADER_CLASS} scope="col">Estado</th>
              : <SortableHeader className={HEADER_CLASS} etiqueta="Estado" columna="status" orden={sort} onOrdenar={sortBy} />}
            <th className={`${HEADER_CLASS} pr-6 text-right`} scope="col">Acciones</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isEmpty={sortedRows.length === 0}
          emptyText="No hay documentos que coincidan con los filtros."
        />
        {sortedRows.map(doc => {
          const statusStyle = STATUS_LABELS[doc.status]
          return (
            <tr key={doc.id_documento} className={`hover:bg-surface-container-low/80 transition-colors ${isHistory ? 'opacity-75' : ''}`}>
              <td className="py-3 px-4 pl-6 font-medium text-base">{doc.typeName}</td>
              <td className="py-3 px-4 text-on-surface-variant">{formatDate(doc.fecha_emision)}</td>
              <td className="py-3 px-4 text-on-surface-variant">{doc.fecha_vencimiento ? formatDate(doc.fecha_vencimiento) : 'Sin vencimiento'}</td>
              <td className="py-3 px-4">
                {isHistory ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-surface-container-high text-on-surface-variant border border-outline-variant/30">Histórico</span>
                ) : (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-semibold ${statusStyle?.badge ?? ''}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle?.dot ?? ''}`} />
                    {statusStyle?.label ?? 'Desconocido'}
                  </span>
                )}
              </td>
              <td className="py-3 px-4 pr-6">
                <div className="flex items-center justify-end gap-1">
                  {doc.archivoUrl && (
                    <ActionButton icon="download" label={`Descargar ${doc.typeName}`} className={PRIMARY_ACTION_CLASS} onClick={() => openFile(doc.archivoUrl)} />
                  )}
                  {!isHistory && (
                    <ActionButton icon="edit" label={`Editar ${doc.typeName}`} className={PRIMARY_ACTION_CLASS} onClick={() => onEdit(doc)} />
                  )}
                  <ActionButton icon="delete" label={`Eliminar ${doc.typeName}`} className={DANGER_ACTION_CLASS} onClick={() => onDelete(doc)} />
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}
