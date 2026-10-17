import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'

const COLUMN_COUNT = 3

const SORT_VALUES = {
  nombre: (e) => e.nombre ?? '',
  categoria: (e) => e.categoria ?? '',
}

const INITIAL_SORT = { columna: 'nombre', direccion: 'asc' }

export default function EquiposTable({ data, isLoading, error }) {
  const [search, setSearch] = useState('')
  const equipos = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    if (!text) return equipos
    return equipos.filter((e) =>
      [e.nombre, e.categoria].some((field) => String(field ?? '').toLowerCase().includes(text)),
    )
  }, [equipos, search])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Buscar por nombre o categoría..."
          label="Filtrar equipos"
        />
      </div>

      <DataTable
        tableClassName="text-base"
        bodyClassName="text-sm"
        headers={(
          <>
            <SortableHeader className="py-3 px-4" etiqueta="Equipo" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Categoría" columna="categoria" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">Competición</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando equipos de COMET..."
          errorText="No se pudieron cargar los equipos."
          emptyText="No hay equipos para mostrar."
        />

        {!isLoading && visibleRows.map((e) => (
          <tr key={e.id} className="hover:bg-surface-container-low/80 transition-colors">
            <td className="py-3 px-4 pl-6 font-medium text-on-surface">{e.nombre || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant">{e.categoria || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant">{e.competicion_id || '—'}</td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="comet-equipos-rows-per-page" {...paginationProps} />
    </div>
  )
}