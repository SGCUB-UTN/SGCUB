import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import useOrdenTabla from '../../hooks/useOrdenTabla'

const SORT_VALUES = {
  name: (liga) => liga.nombre,
  abbreviation: (liga) => liga.abreviatura,
  jugadores: (liga) => liga.cantidad_jugadores,
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }
const COLUMN_COUNT = 3

function LigasListTable({ ligas, isLoading, error, emptyText }) {
  const navigate = useNavigate()
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(ligas, SORT_VALUES, INITIAL_SORT)

  return (
    <DataTable
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm"
      headerCase="title"
      tableClassName="table-fixed min-w-[520px]"
      headers={(
        <>
          <SortableHeader className="py-3 px-4 pl-6" etiqueta="Liga" columna="name" orden={sort} onOrdenar={sortBy} />
          <SortableHeader className="py-3 px-4 w-40" etiqueta="Abreviatura" columna="abbreviation" orden={sort} onOrdenar={sortBy} />
          <SortableHeader className="py-3 px-4 w-32 text-center" etiqueta="Jugadores" columna="jugadores" orden={sort} onOrdenar={sortBy} />
        </>
      )}
    >
      <TableMessageRow
        colSpan={COLUMN_COUNT}
        isLoading={isLoading}
        isEmpty={sorted.length === 0}
        error={error}
        loadingText="Cargando ligas..."
        errorText="No se pudieron cargar las ligas."
        emptyText={emptyText}
      />

      {!isLoading && sorted.map((liga) => (
        <tr
          key={liga.liga_id}
          onClick={() => navigate(`/padron/ligas/${liga.liga_id}`)}
          className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
        >
          <td className="py-3 px-4 pl-6 font-medium text-on-surface text-base">{liga.nombre}</td>
          <td className="py-3 px-4 text-on-surface-variant">{liga.abreviatura}</td>
          <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{liga.cantidad_jugadores ?? '—'}</td>
        </tr>
      ))}
    </DataTable>
  )
}

export default LigasListTable
