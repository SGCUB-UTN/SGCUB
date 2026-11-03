import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import { PANEL_CLASS } from '../shared/panel'
import SectionHeading from '../shared/SectionHeading'
import SortableHeader from '../shared/SortableHeader'
import StatusBadge from '../shared/StatusBadge'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import TableTabs from '../shared/TableTabs'

const ESTADO_BADGES = {
  ENVIADA: { label: 'Enviada', tono: 'exito', icon: 'check_circle' },
  PROGRAMADA: { label: 'Programada', tono: 'alerta', icon: 'schedule' },
  FALLIDA: { label: 'Fallida', tono: 'error', icon: 'error' },
}

const CANAL_OPTIONS = [
  { value: '', label: 'Todos los canales' },
  { value: 'MAIL', label: 'Correo electrónico' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
]

function formatFechaHora(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    const fecha = d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const hora = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
    return `${fecha} · ${hora}`
  } catch {
    return iso
  }
}

export default function HistorialComunicacionesTable({ notificaciones = [], onViewDetail }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('TODAS')
  const [canalFilter, setCanalFilter] = useState('')
  const [orden, setOrden] = useState({ columna: 'fecha_creacion', direccion: 'desc' })
  const [page, setPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(25)

  const counts = useMemo(() => {
    const enviadas = notificaciones.filter((n) => n.estado === 'ENVIADA').length
    const fallidas = notificaciones.filter((n) => n.estado === 'FALLIDA').length
    return {
      TODAS: notificaciones.length,
      ENVIADA: enviadas,
      FALLIDA: fallidas,
    }
  }, [notificaciones])

  const tabOptions = useMemo(
    () => [
      { value: 'TODAS', label: 'Todas', count: counts.TODAS },
      { value: 'ENVIADA', label: 'Enviadas', count: counts.ENVIADA },
      { value: 'FALLIDA', label: 'Fallidas', count: counts.FALLIDA },
    ],
    [counts]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notificaciones.filter((notif) => {
      if (statusFilter !== 'TODAS' && notif.estado !== statusFilter) {
        return false
      }
      const envios = notif.envios || []
      if (canalFilter && !envios.some((e) => e.canal === canalFilter)) {
        return false
      }
      if (!query) return true
      const matchText =
        (notif.titulo || '').toLowerCase().includes(query) ||
        (notif.asunto || '').toLowerCase().includes(query) ||
        (notif.contenido || '').toLowerCase().includes(query) ||
        envios.some(
          (e) =>
            (e.socio_nombre || '').toLowerCase().includes(query) ||
            (e.socio_dni || '').toLowerCase().includes(query) ||
            (e.destinatario_contacto || '').toLowerCase().includes(query)
        )
      return matchText
    })
  }, [notificaciones, search, statusFilter, canalFilter])

  const sorted = useMemo(() => {
    const copy = [...filtered]
    const factor = orden.direccion === 'asc' ? 1 : -1
    copy.sort((a, b) => {
      if (orden.columna === 'fecha_creacion') {
        return (new Date(a.fecha_creacion || 0) - new Date(b.fecha_creacion || 0)) * factor
      }
      if (orden.columna === 'asunto') {
        const textA = (a.asunto || a.titulo || '').toLowerCase()
        const textB = (b.asunto || b.titulo || '').toLowerCase()
        return textA.localeCompare(textB, 'es') * factor
      }
      if (orden.columna === 'destinatarios') {
        return ((a.envios?.length || 0) - (b.envios?.length || 0)) * factor
      }
      if (orden.columna === 'estado') {
        return (a.estado || '').localeCompare(b.estado || '', 'es') * factor
      }
      return 0
    })
    return copy
  }, [filtered, orden])

  const totalPages = Math.max(1, Math.ceil(sorted.length / rowsPerPage))
  const currentPage = Math.min(page, totalPages)
  const paginated = sorted.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handleSort = (columna) => {
    setOrden((current) => ({
      columna,
      direccion: current.columna === columna && current.direccion === 'asc' ? 'desc' : 'asc',
    }))
    setPage(1)
  }

  return (
    <section className={PANEL_CLASS} aria-labelledby="historial-comunicaciones-title">
      <SectionHeading
        id="historial-comunicaciones-title"
        icon="history"
        title="Historial de notificaciones"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterSelect
              etiqueta="Canal:"
              value={canalFilter}
              onChange={(event) => {
                setCanalFilter(event.target.value)
                setPage(1)
              }}
              className="bg-surface-container-low border border-outline-variant/40 rounded text-sm text-on-surface"
            >
              {CANAL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </FilterSelect>
            <TableSearchInput
              value={search}
              onChange={(val) => {
                setSearch(val)
                setPage(1)
              }}
              label="Buscar en historial de notificaciones"
              placeholder="Buscar por asunto, socio o contacto..."
              className="w-64 sm:w-72"
            />
          </div>
        }
      />

      <TableTabs
        id="historial-comunicaciones-tabs"
        label="Filtrar notificaciones por estado"
        options={tabOptions}
        value={statusFilter}
        onChange={(id) => {
          setStatusFilter(id)
          setPage(1)
        }}
      />

      <DataTable
        headers={
          <>
            <SortableHeader className="py-3 px-4" etiqueta="Fecha y hora" columna="fecha_creacion" orden={orden} onOrdenar={handleSort} />
            <SortableHeader className="py-3 px-4" etiqueta="Asunto y mensaje" columna="asunto" orden={orden} onOrdenar={handleSort} />
            <th scope="col" className="py-3 px-4">Canales</th>
            <SortableHeader className="py-3 px-4" etiqueta="Destinatarios" columna="destinatarios" orden={orden} onOrdenar={handleSort} />
            <SortableHeader className="py-3 px-4" etiqueta="Estado" columna="estado" orden={orden} onOrdenar={handleSort} />
            <th scope="col" className="py-3 px-4 text-right">Acciones</th>
          </>
        }
      >
        <TableMessageRow
          colSpan={6}
          isEmpty={paginated.length === 0}
          emptyText={
            notificaciones.length === 0
              ? 'Todavía no se registraron notificaciones enviadas.'
              : 'No se encontraron notificaciones con los filtros aplicados.'
          }
        />
        {paginated.map((notif) => {
          const envios = notif.envios || []
          const total = envios.length
          const exitosos = envios.filter((e) => e.estado === 'ENVIADA').length
          const fallidos = envios.filter((e) => e.estado === 'FALLIDA').length
          const canales = [...new Set(envios.map((e) => e.canal))]
          const badge = ESTADO_BADGES[notif.estado] || {
            label: notif.estado || 'Enviada',
            tono: 'neutral',
            icon: 'info',
          }

          return (
            <tr
              key={notif.id}
              onClick={() => onViewDetail?.(notif)}
              className="hover:bg-surface-container-low/50 transition-colors cursor-pointer"
            >
              <td className="py-3.5 px-4 whitespace-nowrap text-xs text-on-surface-variant tabular-nums">
                {formatFechaHora(notif.fecha_creacion)}
              </td>
              <td className="py-3.5 px-4 max-w-md">
                <p className="font-semibold text-on-surface truncate">
                  {notif.asunto || notif.titulo || 'Sin asunto'}
                </p>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  {notif.contenido || '—'}
                </p>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <div className="flex flex-wrap items-center gap-1.5">
                  {canales.length === 0 && <span className="text-xs text-on-surface-variant">—</span>}
                  {canales.includes('MAIL') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">mail</span>
                      Email
                    </span>
                  )}
                  {canales.includes('WHATSAPP') && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success/10 text-success text-xs font-medium">
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">chat</span>
                      WhatsApp
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-on-surface tabular-nums">
                    {total} {total === 1 ? 'envío' : 'envíos'}
                  </span>
                  {total > 0 && (
                    <span className="text-on-surface-variant tabular-nums">
                      ({exitosos} ok{fallidos > 0 ? ` · ${fallidos} fallido${fallidos === 1 ? '' : 's'}` : ''})
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3.5 px-4 whitespace-nowrap">
                <StatusBadge badge={badge} />
              </td>
              <td className="py-2.5 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => onViewDetail?.(notif)}
                  title="Ver detalle"
                  aria-label="Ver detalle del comunicado"
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-on-surface-variant hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    visibility
                  </span>
                </button>
              </td>
            </tr>
          )
        })}
      </DataTable>

      {sorted.length > 0 && (
        <TablePagination
          page={currentPage}
          totalPages={totalPages}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={(newSize) => {
            setRowsPerPage(newSize)
            setPage(1)
          }}
        />
      )}
    </section>
  )
}
