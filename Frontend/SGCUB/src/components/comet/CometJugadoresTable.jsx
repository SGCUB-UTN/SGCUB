import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'

const COLUMN_COUNT = 4

const SORT_VALUES = {
  apellido: (j) => j.apellidos ?? '',
  nombre: (j) => j.nombres ?? '',
  documento: (j) => j.documento ?? '',
}

const INITIAL_SORT = { columna: 'apellido', direccion: 'asc' }

export default function CometJugadoresTable({ data, isLoading, error }) {
  const [search, setSearch] = useState('')
  const jugadores = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    if (!text) return jugadores
    return jugadores.filter((j) =>
      [j.nombres, j.apellidos, j.documento]
        .some((field) => String(field ?? '').toLowerCase().includes(text)),
    )
  }, [jugadores, search])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Buscar por nombre, apellido o DNI..."
          label="Filtrar jugadores COMET"
        />
      </div>

      <DataTable
        tableClassName="text-base"
        bodyClassName="text-sm"
        headers={(
          <>
            <SortableHeader className="py-3 px-4" etiqueta="Apellido" columna="apellido" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Nombre" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Documento" columna="documento" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">ID COMET</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando jugadores de COMET..."
          errorText="No se pudieron cargar los jugadores."
          emptyText="No hay jugadores para mostrar."
        />

        {!isLoading && visibleRows.map((j) => (
          <tr key={j.id} className="hover:bg-surface-container-low/80 transition-colors">
            <td className="py-3 px-4 pl-6 font-medium text-on-surface">{j.apellidos || '—'}</td>
            <td className="py-3 px-4 text-on-surface">{j.nombres || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant font-mono text-sm">{j.documento || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant font-mono text-xs">{j.id || '—'}</td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="comet-jugadores-rows-per-page" {...paginationProps} />
    </div>
  )
}