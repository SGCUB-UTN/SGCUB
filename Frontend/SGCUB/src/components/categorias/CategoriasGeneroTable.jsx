import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import { formatRangoEdad, GENERO_TAB_TONES } from './categoriaFormat'

const SORT_VALUES = {
  name: (categoria) => categoria.nombre,
  maxAge: (categoria) => categoria.edad_maxima,
  jugadores: (categoria) => categoria.cantidad_jugadores,
  docentes: (categoria) => categoria.cantidad_docentes,
}
const INITIAL_SORT = { columna: 'maxAge', direccion: 'desc' }
const COLUMN_COUNT = 4

function CategoriasGeneroTable({ categorias, isLoading, error, showGenero = false }) {
  const navigate = useNavigate()
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(categorias, SORT_VALUES, INITIAL_SORT)

  return (
    <div className="min-w-0">
      <DataTable
        headerCase="title"
        tableClassName="table-fixed min-w-[640px]"
        headers={(
          <>
            <SortableHeader className="py-3 px-4 w-48" etiqueta="Edad" columna="maxAge" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 pl-6" etiqueta="Nombre" columna="name" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-36 text-center" etiqueta="Jugadores" columna="jugadores" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-36 text-center" etiqueta="Docentes" columna="docentes" orden={sort} onOrdenar={sortBy} />
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
          emptyText="No hay categorías que coincidan con el filtro."
        />

        {!isLoading && sorted.map((categoria) => (
          <tr
            key={categoria.categoria_id}
            onClick={() => navigate(`/padron/categorias/${categoria.categoria_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
          >
            <td className="py-3 px-4 text-on-surface-variant">{formatRangoEdad(categoria)}</td>
            <td className="py-3 px-4 pl-6 font-medium text-on-surface text-base">
              {categoria.nombre}
              {showGenero && GENERO_TAB_TONES[categoria.genero] && (
                <span className={`ml-1.5 font-semibold ${GENERO_TAB_TONES[categoria.genero].text}`}>({categoria.genero})</span>
              )}
            </td>
            <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{categoria.cantidad_jugadores ?? '—'}</td>
            <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{categoria.cantidad_docentes ?? '—'}</td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}

export default CategoriasGeneroTable
