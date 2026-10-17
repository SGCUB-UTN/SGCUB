import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'

const COLUMN_COUNT = 5

const SORT_VALUES = {
  nombre: (c) => c.nombre ?? '',
  temporada: (c) => c.temporada ?? '',
  estado: (c) => c.estado ?? '',
}

const INITIAL_SORT = { columna: 'nombre', direccion: 'asc' }

export default function CompeticionesTable({ data, isLoading, error }) {
  const [search, setSearch] = useState('')
  const competiciones = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    if (!text) return competiciones
    return competiciones.filter((c) =>
      [c.nombre, c.temporada, c.categoria, c.estado]
        .some((field) => String(field ?? '').toLowerCase().includes(text)),
    )
  }, [competiciones, search])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Buscar por nombre, temporada..."
          label="Filtrar competiciones"
        />
      </div>

      <DataTable
        tableClassName="text-base"
        bodyClassName="text-sm"
        headers={(
          <>
            <SortableHeader className="py-3 px-4" etiqueta="Competición" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">Temporada</th>
            <th className="py-3 px-4" scope="col">Categoría</th>
            <th className="py-3 px-4" scope="col">Fechas</th>
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="estado" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando competiciones de COMET..."
          errorText="No se pudieron cargar las competiciones."
          emptyText="No hay competiciones para mostrar."
        />

        {!isLoading && visibleRows.map((c) => (
          <tr key={c.id} className="hover:bg-surface-container-low/80 transition-colors">
            <td className="py-3 px-4 pl-6 font-medium text-on-surface">{c.nombre || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant">{c.temporada || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant">{c.categoria || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant text-sm">
              {c.fecha_inicio && c.fecha_fin ? `${c.fecha_inicio} → ${c.fecha_fin}` : '—'}
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{c.estado || '—'}</td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="comet-competiciones-rows-per-page" {...paginationProps} />
    </div>
  )
}