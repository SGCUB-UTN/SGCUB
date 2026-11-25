import { useNavigate } from 'react-router-dom'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import { formatDni, isActiveStatus } from '../personas/format'

const fullName = (jugador) => `${jugador.socio?.apellido ?? ''}, ${jugador.socio?.nombre ?? ''}`

const SORT_VALUES = {
  number: (jugador) => Number(jugador.socio?.numero_socio ?? 0),
  name: fullName,
  category: (jugador) => jugador.categoria?.nombre ?? '',
  state: (jugador) => jugador.estado?.nombre ?? '',
}
const INITIAL_SORT = { columna: 'name', direccion: 'asc' }

function LigaJugadoresTable({ jugadores }) {
  const navigate = useNavigate()
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(jugadores, SORT_VALUES, INITIAL_SORT)

  return (
    <DataTable
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm"
      headerCase="title"
      headers={(
        <>
          <SortableHeader className="py-3 px-4 pl-6 w-28 whitespace-nowrap" etiqueta="N° Socio" columna="number" orden={sort} onOrdenar={sortBy} />
          <SortableHeader className="py-3 px-4" etiqueta="Apellido y nombre" columna="name" orden={sort} onOrdenar={sortBy} />
          <th className="py-3 px-4" scope="col">DNI</th>
          <SortableHeader className="py-3 px-4" etiqueta="Categoría" columna="category" orden={sort} onOrdenar={sortBy} />
          <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="state" orden={sort} onOrdenar={sortBy} />
        </>
      )}
    >
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
            <td className="py-3 px-4">
              <ActiveStatusBadge isActive={active} label={active ? jugador.estado?.nombre : 'Baja parcial'} />
            </td>
          </tr>
        )
      })}
    </DataTable>
  )
}

export default LigaJugadoresTable
