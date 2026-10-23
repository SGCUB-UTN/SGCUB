import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import ProfileBadge from '../shared/ProfileBadge'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import { formatDni } from '../personas/format'
import { matchesSearch } from '../shared/search'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const COLUMN_COUNT = 6

const isActive = (jugador) => {
  const estado = (jugador.estado?.nombre ?? '').toLowerCase()
  return estado.includes('activo') && !estado.includes('baja') && !estado.includes('inactivo')
}

const statusLabel = (jugador) => {
  if (isActive(jugador)) return 'Activo'
  return jugador.tipo_baja === 'parcial' ? 'Baja temporal' : 'De baja'
}

const secondaryCategoryName = (jugador) => {
  const secundaria = jugador.categoria_secundaria ?? jugador.categoriaSecundaria
  if (secundaria?.nombre) return secundaria.nombre
  if (typeof secundaria === 'string') return secundaria
  if (Array.isArray(jugador.categorias_secundarias)) {
    return jugador.categorias_secundarias.map((categoria) => categoria.nombre ?? categoria).join(', ')
  }
  return '—'
}

const exportCsv = (jugadores) => {
  const headers = ['N° Socio', 'Nombre y apellido', 'DNI', 'Categoría principal', 'Categoría secundaria', 'Estado']
  const rows = jugadores.map((jugador) => [
    jugador.socio?.numero_socio ?? '',
    `${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''}`.trim() ,
    jugador.socio?.dni ?? '',
    jugador.categoria?.nombre ?? '',
    secondaryCategoryName(jugador),
    jugador.estado?.nombre ?? '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
  link.download = `padron-jugadores-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// Value each column is sorted by. Status: active first in ascending order.
const SORT_VALUES = {
  numero: (jugador) => (jugador.socio?.numero_socio ? Number(jugador.socio.numero_socio) : null),
  nombre: (jugador) => `${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''}`.trim(),
  estado: (jugador) => (isActive(jugador) ? 0 : 1),
}
// On load: most recent first.
const INITIAL_SORT = { columna: 'numero', direccion: 'desc' }

function JugadoresTable({ data, categorias = [], isLoading, error, status, onStatusChange }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('todas')

  const jugadores = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim()
    return jugadores.filter((jugador) => {
      if (category !== 'todas' && String(jugador.categoria?.categoria_id) !== category) return false
      if (status === 'activo' && !isActive(jugador)) return false
      if (status === 'baja' && jugador.tipo_baja !== 'completa') return false
      if (status === 'baja_temporal' && jugador.tipo_baja !== 'parcial') return false
      if (!text) return true
      return matchesSearch(text, [jugador.socio?.nombre, jugador.socio?.apellido, jugador.socio?.dni, jugador.categoria?.nombre])
    })
  }, [jugadores, search, category, status])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)
  const [previousStatus, setPreviousStatus] = useState(status)
  if (status !== previousStatus) {
    setPreviousStatus(status)
    resetPage()
  }

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Filtrar por DNI, Nombre o Apellido..."
            label="Filtrar jugadores"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={category}
            onChange={(event) => withPageReset(setCategory)(event.target.value)}
            aria-label="Filtrar por categoría"
          >
            <option value="todas">Categoría: Todas</option>
            {categorias.map((item) => <option key={item.categoria_id} value={item.categoria_id}>{item.nombre}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="activo">Estado: Activo</option>
            <option value="todos">Estado: Todos</option>
            <option value="baja">De baja completa</option>
            <option value="baja_temporal">Baja temporal</option>
          </FilterSelect>
        </div>
        <div className="flex items-center justify-end xl:shrink-0">
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-lg font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">file_download</span>
            <span>Exportar jugadores</span>
          </button>
        </div>
      </div>

      <DataTable
        headers={(
          <>
            <SortableHeader className="py-3 px-4 w-28 whitespace-nowrap" etiqueta="N° Socio" columna="numero" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Nombre y Apellido" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">DNI</th>
            <th className="py-3 px-4" scope="col">Categoría principal</th>
            <th className="py-3 px-4" scope="col">Categoría secundaria</th>
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="estado" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando jugadores..."
          errorText="No se pudieron cargar los jugadores."
          emptyText="No hay jugadores que coincidan con el filtro."
        />

        {!isLoading && visibleRows.map((jugador) => (
          <tr
            key={jugador.jugador_id}
            onClick={() => navigate(`/padron/jugadores/${jugador.jugador_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer group"
          >
            <td className="py-3 px-4 font-bold text-primary text-base pl-6">
              {jugador.socio?.numero_socio ? `#${jugador.socio.numero_socio}` : '—'}
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-on-surface block text-base">{jugador.socio?.nombre} {jugador.socio?.apellido}</span>
                {jugador.socio?.es_ex_jugador && <ProfileBadge>Socio activo</ProfileBadge>}
              </div>
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDni(jugador.socio?.dni)}</td>
            <td className="py-3 px-4 text-on-surface-variant">{jugador.categoria?.nombre ?? '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant">{secondaryCategoryName(jugador)}</td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <ActiveStatusBadge isActive={isActive(jugador)} label={statusLabel(jugador)} />
              </div>
            </td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="jugadores-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default JugadoresTable
