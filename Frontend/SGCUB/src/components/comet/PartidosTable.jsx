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
  fecha: (p) => p.fecha ?? '',
  local: (p) => p.local ?? '',
  estado: (p) => p.estado ?? '',
}

const INITIAL_SORT = { columna: 'fecha', direccion: 'desc' }

const ETIQUETA_ESTADO = {
  programado: { label: 'Programado', tono: 'info' },
  en_juego: { label: 'En juego', tono: 'alerta' },
  finalizado: { label: 'Finalizado', tono: 'positivo' },
  suspendido: { label: 'Suspendido', tono: 'error' },
}

const TONO_CLASES = {
  info: 'bg-primary-container/30 text-on-primary-container',
  alerta: 'bg-warning-container/40 text-on-warning-container',
  positivo: 'bg-[#e6f4ea] text-[#0d652d]',
  error: 'bg-error-container/40 text-on-error-container',
}

function EstadoPartido({ estado }) {
  if (!estado) return <span className="text-on-surface-variant">—</span>
  const info = ETIQUETA_ESTADO[estado] ?? { label: estado, tono: 'info' }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${TONO_CLASES[info.tono]}`}>
      {info.label}
    </span>
  )
}

export default function PartidosTable({ data, isLoading, error }) {
  const [search, setSearch] = useState('')
  const partidos = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    if (!text) return partidos
    return partidos.filter((p) =>
      [p.local, p.visitante, p.estado, p.fecha]
        .some((field) => String(field ?? '').toLowerCase().includes(text)),
    )
  }, [partidos, search])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Buscar por equipo, fecha..."
          label="Filtrar partidos"
        />
      </div>

      <DataTable
        tableClassName="text-base"
        bodyClassName="text-sm"
        headers={(
          <>
            <SortableHeader className="py-3 px-4" etiqueta="Fecha" columna="fecha" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Local" columna="local" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">Visitante</th>
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="estado" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando partidos de COMET..."
          errorText="No se pudieron cargar los partidos."
          emptyText="No hay partidos para mostrar."
        />

        {!isLoading && visibleRows.map((p) => (
          <tr key={p.id} className="hover:bg-surface-container-low/80 transition-colors">
            <td className="py-3 px-4 pl-6 font-mono text-sm text-on-surface">{p.fecha || '—'}{p.hora ? ` ${p.hora}` : ''}</td>
            <td className="py-3 px-4 font-medium text-on-surface">{p.local || '—'}</td>
            <td className="py-3 px-4 text-on-surface-variant">{p.visitante || '—'}</td>
            <td className="py-3 px-4"><EstadoPartido estado={p.estado} /></td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="comet-partidos-rows-per-page" {...paginationProps} />
    </div>
  )
}