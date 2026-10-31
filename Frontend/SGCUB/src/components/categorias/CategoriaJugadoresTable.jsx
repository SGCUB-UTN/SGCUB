import { useNavigate } from 'react-router-dom'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import DataTable from '../shared/DataTable'
import { formatDni, isActiveStatus } from '../personas/format'

function CategoriaJugadoresTable({ jugadores, categoriaId }) {
  const navigate = useNavigate()

  return (
    <DataTable
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm"
      headerCase="title"
      headers={(
        <>
          <th className="py-3 px-4 pl-6 w-28 whitespace-nowrap" scope="col">N° Socio</th>
          <th className="py-3 px-4" scope="col">Nombre y Apellido</th>
          <th className="py-3 px-4" scope="col">DNI</th>
          <th className="py-3 px-4" scope="col">Categoría</th>
          <th className="py-3 px-4" scope="col">Estado</th>
        </>
      )}
    >
      {jugadores.map((jugador) => {
        const isMain = jugador.categoria?.categoria_id === categoriaId
        return (
          <tr
            key={jugador.jugador_id}
            onClick={() => navigate(`/padron/jugadores/${jugador.jugador_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
          >
            <td className="py-3 px-4 pl-6 font-bold text-primary text-base">
              {jugador.socio?.numero_socio ? `#${jugador.socio.numero_socio}` : '—'}
            </td>
            <td className="py-3 px-4 font-medium text-base">
              {jugador.socio?.nombre} {jugador.socio?.apellido}
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDni(jugador.socio?.dni)}</td>
            <td className="py-3 px-4">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${isMain ? 'bg-primary-fixed/30 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                {isMain ? 'Principal' : 'Secundaria'}
              </span>
            </td>
            <td className="py-3 px-4">
              <ActiveStatusBadge
                isActive={isActiveStatus(jugador.estado?.nombre)}
                label={jugador.estado?.nombre ?? 'Sin estado'}
              />
            </td>
          </tr>
        )
      })}
    </DataTable>
  )
}

export default CategoriaJugadoresTable
