import { useMemo } from 'react'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import useOrdenTabla from '../../hooks/useOrdenTabla'

const COLUMN_COUNT = 9

const SORT_VALUES = {
  equipo: (f) => f.equipo ?? '',
  pj: (f) => Number(f.pj ?? 0),
  pg: (f) => Number(f.pg ?? 0),
  pe: (f) => Number(f.pe ?? 0),
  pp: (f) => Number(f.pp ?? 0),
  gf: (f) => Number(f.gf ?? 0),
  gc: (f) => Number(f.gc ?? 0),
  dg: (f) => Number(f.gf ?? 0) - Number(f.gc ?? 0),
  puntos: (f) => Number(f.puntos ?? 0),
}

// Por defecto: ordenado por puntos de mayor a menor
const INITIAL_SORT = { columna: 'puntos', direccion: 'desc' }

// Resalta visualmente los primeros puestos
const claseFila = (posicion) => {
  if (posicion <= 1) return 'bg-[#e6f4ea]/40'
  if (posicion <= 3) return 'bg-primary-container/10'
  return ''
}

export default function TablasPosiciones({ data, isLoading, error }) {
  const filas = useMemo(() => data ?? [], [data])

  const { ordenadas, orden, ordenarPor } = useOrdenTabla(filas, SORT_VALUES, INITIAL_SORT)

  // La posición se calcula DESPUÉS de ordenar, según la posición en el listado
  const conPosicion = useMemo(
    () => ordenadas.map((fila, i) => ({ ...fila, _posicion: i + 1 })),
    [ordenadas],
  )

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20">
        <p className="text-sm text-on-surface-variant">
          Ordená las columnas haciendo click en los encabezados. Por defecto se muestra por puntos.
        </p>
      </div>

      <DataTable
        tableClassName="text-base"
        bodyClassName="text-sm"
        headers={(
          <>
            <th className="py-3 px-4 w-12 text-center" scope="col">#</th>
            <SortableHeader className="py-3 px-4" etiqueta="Equipo" columna="equipo" orden={orden} onOrdenar={ordenarPor} />
            <SortableHeader className="py-3 px-3 text-center" etiqueta="PJ" columna="pj" orden={orden} onOrdenar={ordenarPor} />
            <SortableHeader className="py-3 px-3 text-center" etiqueta="PG" columna="pg" orden={orden} onOrdenar={ordenarPor} />
            <SortableHeader className="py-3 px-3 text-center" etiqueta="PE" columna="pe" orden={orden} onOrdenar={ordenarPor} />
            <SortableHeader className="py-3 px-3 text-center" etiqueta="PP" columna="pp" orden={orden} onOrdenar={ordenarPor} />
            <SortableHeader className="py-3 px-3 text-center" etiqueta="GF" columna="gf" orden={orden} onOrdenar={ordenarPor} />
            <SortableHeader className="py-3 px-3 text-center" etiqueta="GC" columna="gc" orden={orden} onOrdenar={ordenarPor} />
            <SortableHeader className="py-3 px-3 text-center" etiqueta="Pts" columna="puntos" orden={orden} onOrdenar={ordenarPor} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={conPosicion.length === 0}
          error={error}
          loadingText="Cargando tabla de posiciones..."
          errorText="No se pudo cargar la tabla."
          emptyText="No hay posiciones para mostrar."
        />

        {!isLoading && conPosicion.map((fila) => {
          const dg = Number(fila.gf ?? 0) - Number(fila.gc ?? 0)
          return (
            <tr key={`${fila._posicion}-${fila.equipo}`} className={`hover:bg-surface-container-low/60 transition-colors ${claseFila(fila._posicion)}`}>
              <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{fila._posicion}</td>
              <td className="py-3 px-4 font-semibold text-on-surface">{fila.equipo || '—'}</td>
              <td className="py-3 px-3 text-center text-on-surface-variant">{fila.pj ?? '—'}</td>
              <td className="py-3 px-3 text-center text-on-surface-variant">{fila.pg ?? '—'}</td>
              <td className="py-3 px-3 text-center text-on-surface-variant">{fila.pe ?? '—'}</td>
              <td className="py-3 px-3 text-center text-on-surface-variant">{fila.pp ?? '—'}</td>
              <td className="py-3 px-3 text-center text-on-surface-variant">{fila.gf ?? '—'}</td>
              <td className="py-3 px-3 text-center text-on-surface-variant">{fila.gc ?? '—'}</td>
              <td className="py-3 px-3 text-center font-bold text-primary">
                {fila.puntos ?? '—'}
                {dg !== 0 && (
                  <span className="block text-xs font-normal text-on-surface-variant">
                    {dg > 0 ? `+${dg}` : dg} DG
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}