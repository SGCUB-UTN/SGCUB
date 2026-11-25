import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DocumentationStatus from '../documental/DocumentationStatus'
import AccountStatus from '../finanzas/AccountStatus'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import ClearFiltersButton from '../shared/ClearFiltersButton'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import TableMessageRow from '../shared/TableMessageRow'
import { ALL, FILTER_CLASS } from '../shared/listFilters'
import { formatDni, isActiveStatus } from '../personas/format'

const NO_LEAGUE = 'sin_liga'
const COLUMN_COUNT = 7

const leagueOptions = (jugadores) => {
  const leagues = new Map()
  jugadores.forEach((jugador) => (jugador.ligas ?? []).forEach((liga) => leagues.set(String(liga.liga_id), liga)))
  return [...leagues.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

const matchesLeague = (jugador, value) => {
  if (value === ALL) return true
  const ligas = jugador.ligas ?? []
  if (value === NO_LEAGUE) return ligas.length === 0
  return ligas.some((liga) => String(liga.liga_id) === value)
}

function LeaguesText({ ligas = [] }) {
  if (ligas.length === 0) return <span className="text-on-surface-variant">—</span>
  return <span title={ligas.map((liga) => liga.nombre).join(', ')}>{ligas.map((liga) => liga.abreviatura).join(', ')}</span>
}

function CategoriaJugadoresTable({ jugadores }) {
  const navigate = useNavigate()
  const [league, setLeague] = useState(ALL)

  const leagues = useMemo(() => leagueOptions(jugadores), [jugadores])
  const hasPlayersWithoutLeague = jugadores.some((jugador) => !jugador.ligas?.length)
  const filtered = useMemo(() => jugadores.filter((jugador) => matchesLeague(jugador, league)), [jugadores, league])

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center gap-2">
        <FilterSelect
          className={FILTER_CLASS}
          width="sm:w-56"
          value={league}
          onChange={(event) => setLeague(event.target.value)}
          aria-label="Filtrar por liga"
        >
          <option value={ALL}>Todas las ligas</option>
          {leagues.map((liga) => <option key={liga.liga_id} value={String(liga.liga_id)}>{liga.nombre}</option>)}
          {hasPlayersWithoutLeague && <option value={NO_LEAGUE}>Sin liga</option>}
        </FilterSelect>
        <ClearFiltersButton onClick={() => setLeague(ALL)} visible={league !== ALL} />
      </div>

      <DataTable
        headerCase="title"
        headers={(
          <>
            <th className="py-3 px-4 pl-6 w-28 whitespace-nowrap" scope="col">N° Socio</th>
            <th className="py-3 px-4" scope="col">Nombre y Apellido</th>
            <th className="py-3 px-4" scope="col">DNI</th>
            <th className="py-3 px-4" scope="col">Ligas</th>
            <th className="py-3 px-4 whitespace-nowrap" scope="col">Documentación</th>
            <th className="py-3 px-4 whitespace-nowrap text-right" scope="col">Financiero</th>
            <th className="py-3 px-4" scope="col">Estado</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isEmpty={filtered.length === 0}
          emptyText="Ningún jugador de la categoría está en esa liga."
          onClearFilters={() => setLeague(ALL)}
        />

        {filtered.map((jugador) => (
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
              <td className="py-3 px-4 text-base text-on-surface"><LeaguesText ligas={jugador.ligas} /></td>
              <td className="py-3 px-4"><DocumentationStatus documentacion={jugador.documentacion} /></td>
              <td className="py-3 px-4 text-right whitespace-nowrap"><AccountStatus cuenta={jugador.socio?.cuenta} /></td>
              <td className="py-3 px-4">
                <ActiveStatusBadge
                  isActive={isActiveStatus(jugador.estado?.nombre)}
                  label={jugador.estado?.nombre ?? 'Sin estado'}
                />
              </td>
            </tr>
        ))}
      </DataTable>
    </div>
  )
}

export default CategoriaJugadoresTable
