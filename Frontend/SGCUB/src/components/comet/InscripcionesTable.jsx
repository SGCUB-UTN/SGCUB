import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { matchesSearch } from '../shared/search'

const COLUMN_COUNT = 4

const SORT_VALUES = {
  jugador: (i) => i.jugador_id ?? '',
  competicion: (i) => i.competicion_id ?? '',
  estado: (i) => i.estado ?? '',
  fecha: (i) => i.fecha_inscripcion ?? '',
}

const INITIAL_SORT = { columna: 'fecha', direccion: 'desc' }

const ETIQUETA_ESTADO = {
  en_proceso: { label: 'En proceso', tono: 'alerta' },
  finalizada: { label: 'Finalizada', tono: 'positivo' },
  rechazada: { label: 'Rechazada', tono: 'error' },
  pendiente: { label: 'Pendiente', tono: 'info' },
}

const TONO_CLASES = {
  info: 'bg-primary-container/30 text-on-primary-container',
  alerta: 'bg-warning-container/40 text-on-warning-container',
  positivo: 'bg-[#e6f4ea] text-[#0d652d]',
  error: 'bg-error-container/40 text-on-error-container',
}

function EstadoInscripcion({ estado }) {
  if (!estado) return <span className="text-on-surface-variant">—</span>
  const info = ETIQUETA_ESTADO[estado] ?? { label: estado, tono: 'info' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TONO_CLASES[info.tono]}`}>
      {info.label}
    </span>
  )
}

export default function InscripcionesTable({ data, isLoading, error }) {
  const [search, setSearch] = useState('')
  const inscripciones = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim()
    if (!text) return inscripciones
    return inscripciones.filter((i) =>
      matchesSearch(text, [i.jugador_id, i.competicion_id, i.estado]),
    )
  }, [inscripciones, search])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Buscar por ID, estado..."
          label="Filtrar inscripciones"
        />
      </div>

      <DataTable
        headers={(
          <>
            <SortableHeader className="py-3 px-4" etiqueta="Jugador (ID COMET)" columna="jugador" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Competición (ID COMET)" columna="competicion" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="estado" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Fecha" columna="fecha" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando inscripciones..."
          errorText="No se pudieron cargar las inscripciones."
          emptyText="No hay inscripciones para mostrar."
        />

        {!isLoading && visibleRows.map((i) => (
          <tr key={i.id} className="hover:bg-surface-container-low/80 transition-colors">
            <td className="py-3 px-4 pl-6 text-on-surface">{i.jugador_id || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant">{i.competicion_id || '—'}</td>
            <td className="py-3 px-4"><EstadoInscripcion estado={i.estado} /></td>
            <td className="py-3 px-4 text-on-surface-variant">{i.fecha_inscripcion || '—'}</td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="comet-inscripciones-rows-per-page" {...paginationProps} />
    </div>
  )
}