import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const COLUMN_COUNT = 6

const SORT_VALUES = {
  fecha: (l) => l.fecha ?? '',
  operacion: (l) => l.operacion ?? '',
  exitoso: (l) => (l.exitoso ? 0 : 1),
  jugador: (l) => l.jugador_nombre ?? '',
}

const INITIAL_SORT = { columna: 'fecha', direccion: 'desc' }

const OPCIONES_OPERACION = [
  { value: 'todas', label: 'Operación: Todas' },
  { value: 'exportar_jugador', label: 'Exportar jugador' },
  { value: 'inscribir_jugador', label: 'Inscribir jugador' },
  { value: 'actualizar_inscripcion', label: 'Actualizar inscripción' },
  { value: 'finalizar_inscripcion', label: 'Finalizar inscripción' },
  { value: 'gestionar_roster', label: 'Gestionar roster' },
  { value: 'solicitar_participacion', label: 'Solicitar participación' },
  { value: 'cargar_alineacion', label: 'Cargar alineación' },
]

function EstadoBadge({ exitoso }) {
  return exitoso ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#e6f4ea] text-[#0d652d]">
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">check_circle</span>
      OK
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-error-container/40 text-on-error-container">
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">error</span>
      Error
    </span>
  )
}

function formatearFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function JsonBlock({ label, value }) {
  if (!value) return <p className="text-sm text-on-surface-variant">{label}: —</p>
  return (
    <div>
      <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
      <pre className="text-xs bg-surface-container-low border border-outline-variant/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function FilaDetalle({ log }) {
  return (
    <tr className="bg-surface-container-low/50">
      <td colSpan={COLUMN_COUNT} className="px-6 py-4">
        <div className="flex flex-col gap-3 max-w-4xl">
          <JsonBlock label="Payload enviado" value={log.payload_enviado} />
          <JsonBlock label="Respuesta de COMET" value={log.respuesta} />
          {log.mensaje && (
            <div>
              <p className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-1">Mensaje</p>
              <p className="text-sm text-on-surface">{log.mensaje}</p>
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function CometLogsTable({ data, isLoading, error }) {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [operacion, setOperacion] = useState('todas')
  const [estado, setEstado] = useState('todos')
  const [expandido, setExpandido] = useState(null)

  const logs = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    return logs.filter((log) => {
      if (operacion !== 'todas' && log.operacion !== operacion) return false
      if (estado === 'ok' && !log.exitoso) return false
      if (estado === 'error' && log.exitoso) return false
      if (!text) return true
      return [log.jugador_nombre, log.operacion_nombre, log.mensaje, log.exportado_por]
        .some((field) => String(field ?? '').toLowerCase().includes(text))
    })
  }, [logs, search, operacion, estado])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Buscar por jugador, mensaje..."
            label="Filtrar logs"
          />
          <FilterSelect
            className={FILTER_CLASS}
            value={operacion}
            onChange={(event) => withPageReset(setOperacion)(event.target.value)}
            aria-label="Filtrar por operación"
          >
            {OPCIONES_OPERACION.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
          </FilterSelect>
          <FilterSelect
            className={FILTER_CLASS}
            value={estado}
            onChange={(event) => withPageReset(setEstado)(event.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="todos">Estado: Todos</option>
            <option value="ok">Solo exitosos</option>
            <option value="error">Solo con error</option>
          </FilterSelect>
        </div>
      </div>

      <DataTable
        tableClassName="text-base"
        bodyClassName="text-sm"
        headers={(
          <>
            <th className="py-3 px-2 w-10" scope="col"></th>
            <SortableHeader className="py-3 px-4" etiqueta="Fecha" columna="fecha" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Operación" columna="operacion" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Jugador" columna="jugador" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4" scope="col">Usuario</th>
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="exitoso" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando historial..."
          errorText="No se pudo cargar el historial."
          emptyText="No hay operaciones registradas con este filtro."
        />

        {!isLoading && visibleRows.map((log) => {
          const abierto = expandido === log.log_id
          return (
            <>
              <tr
                key={log.log_id}
                onClick={() => setExpandido(abierto ? null : log.log_id)}
                className="hover:bg-surface-container-low/60 transition-colors cursor-pointer"
              >
                <td className="py-3 px-2 text-center">
                  <span className={`material-symbols-outlined text-[18px] text-on-surface-variant transition-transform ${abierto ? 'rotate-90' : ''}`} aria-hidden="true">
                    chevron_right
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-sm text-on-surface">{formatearFecha(log.fecha)}</td>
                <td className="py-3 px-4 font-medium text-on-surface">{log.operacion_nombre || log.operacion}</td>
                <td className="py-3 px-4">
                  {log.jugador ? (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); navigate(`/padron/jugadores/${log.jugador}`) }}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      {log.jugador_nombre || `#${log.jugador}`}
                    </button>
                  ) : <span className="text-on-surface-variant">—</span>}
                </td>
                <td className="py-3 px-4 text-on-surface-variant text-sm">{log.exportado_por || '—'}</td>
                <td className="py-3 px-4"><EstadoBadge exitoso={log.exitoso} /></td>
              </tr>
              {abierto && <FilaDetalle key={`${log.log_id}-detalle`} log={log} />}
            </>
          )
        })}
      </DataTable>

      <TablePagination id="comet-logs-rows-per-page" {...paginationProps} />
    </div>
  )
}