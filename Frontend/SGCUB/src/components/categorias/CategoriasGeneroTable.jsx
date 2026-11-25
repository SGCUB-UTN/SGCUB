import { Link, useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import { ROW_LINK_CLASS, stopRowClick } from '../shared/rowLink'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import { formatRangoEdad } from './categoriaFormat'

const SORT_VALUES = {
  name: (categoria) => categoria.nombre,
  maxAge: (categoria) => categoria.edad_maxima,
  jugadores: (categoria) => categoria.cantidad_jugadores,
  docentes: (categoria) => categoria.cantidad_docentes,
}
const INITIAL_SORT = { columna: 'maxAge', direccion: 'desc' }
const COLUMN_COUNT = 4

function CategoriasGeneroTable({ categorias, isLoading, error, showGenero = false, emptyText, onRetry, onClearFilters }) {
  const navigate = useNavigate()
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(categorias, SORT_VALUES, INITIAL_SORT)

  return (
    <div className="min-w-0">
      <DataTable
        headerCase="title"
        tableClassName="table-fixed min-w-[560px]"
        headers={(
          <>
            <SortableHeader className="py-3 px-4 pl-6" etiqueta="Nombre" columna="name" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-40" etiqueta="Edad" columna="maxAge" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-32 text-center" etiqueta="Jugadores" columna="jugadores" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-32 text-center" etiqueta="Docentes" columna="docentes" orden={sort} onOrdenar={sortBy} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={sorted.length === 0}
          error={error}
          loadingText="Cargando categorías..."
          errorText="No se pudieron cargar las categorías."
          emptyText={emptyText}
          onRetry={onRetry}
          onClearFilters={onClearFilters}
        />

        {!isLoading && !error && sorted.map((categoria) => (
          <tr
            key={categoria.categoria_id}
            onClick={() => navigate(`/padron/categorias/${categoria.categoria_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
          >
            <td className="py-3 px-4 pl-6 font-medium text-on-surface text-base">
              <Link
                to={`/padron/categorias/${categoria.categoria_id}`}
                onClick={stopRowClick}
                className={ROW_LINK_CLASS}
              >
                {categoria.nombre}
              </Link>
              {showGenero && categoria.genero && (
                <span className="ml-1.5 font-normal text-on-surface-variant">({categoria.genero})</span>
              )}
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatRangoEdad(categoria)}</td>
            <td className="py-3 px-4 text-center font-medium text-on-surface tabular-nums">{categoria.cantidad_jugadores ?? '—'}</td>
            <td className="py-3 px-4 text-center font-medium text-on-surface tabular-nums">{categoria.cantidad_docentes ?? '—'}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}

export default CategoriasGeneroTable
