import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import usePagination from '../../hooks/usePagination'
import DetalleNotificacionModal from './DetalleNotificacionModal'

export default function HistorialComunicacionesTable({
  notificaciones = [],
  isLoading = false,
  error = null,
  onRefresh,
}) {
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('TODOS')
  const [selectedNotificacion, setSelectedNotificacion] = useState(null)
  const [isDetalleOpen, setIsDetalleOpen] = useState(false)

  // Filtrado reactivo por término y estado
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return notificaciones.filter((item) => {
      // Filtro de estado
      if (filtroEstado !== 'TODOS') {
        const est = (item.estado || '').toUpperCase()
        if (filtroEstado === 'ENVIADA' && est !== 'ENVIADA') return false
        if (filtroEstado === 'FALLIDA' && est !== 'FALLIDA') return false
        if (filtroEstado === 'PROGRAMADA' && est !== 'PROGRAMADA') return false
      }

      // Filtro de búsqueda
      if (!query) return true
      const titulo = (item.titulo || '').toLowerCase()
      const asunto = (item.asunto || '').toLowerCase()
      const contenido = (item.contenido || '').toLowerCase()
      return titulo.includes(query) || asunto.includes(query) || contenido.includes(query)
    })
  }, [notificaciones, search, filtroEstado])

  const { visibleRows, withPageReset, paginationProps } = usePagination(filteredRows, 15)

  // Determinar canales involucrados
  const getCanalesInvolucrados = (item) => {
    const envios = item.envios || []
    const canalesSet = new Set(envios.map((e) => (e.canal || '').toUpperCase()))
    if (canalesSet.size === 0) {
      return ['WHATSAPP', 'MAIL']
    }
    return Array.from(canalesSet)
  }

  const getEstadoBadge = (estado) => {
    const est = (estado || '').toUpperCase()
    if (est === 'ENVIADA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
          <span className="material-symbols-outlined text-[13px]">check_circle</span>
          Enviada
        </span>
      )
    }
    if (est === 'FALLIDA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error/10 text-error border border-error/20">
          <span className="material-symbols-outlined text-[13px]">error</span>
          Fallida
        </span>
      )
    }
    if (est === 'PROGRAMADA') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
          <span className="material-symbols-outlined text-[13px]">schedule</span>
          Programada
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-on-surface border border-outline-variant/30">
        {estado || 'ENVIADA'}
      </span>
    )
  }

  const handleOpenDetalle = (item) => {
    setSelectedNotificacion(item)
    setIsDetalleOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Barra de Filtros, Búsqueda y Botón Refrescar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/30 shadow-xs">
        {/* Pills de Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'TODOS', label: 'Todos', count: notificaciones.length },
            {
              id: 'ENVIADA',
              label: 'Enviadas',
              count: notificaciones.filter((n) => (n.estado || '').toUpperCase() === 'ENVIADA').length,
            },
            {
              id: 'PROGRAMADA',
              label: 'Programadas',
              count: notificaciones.filter((n) => (n.estado || '').toUpperCase() === 'PROGRAMADA').length,
            },
            {
              id: 'FALLIDA',
              label: 'Fallidas',
              count: notificaciones.filter((n) => (n.estado || '').toUpperCase() === 'FALLIDA').length,
            },
          ].map((tab) => {
            const isActive = filtroEstado === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => withPageReset(setFiltroEstado)(tab.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-primary text-on-primary shadow-xs'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-on-primary/20 text-on-primary' : 'bg-surface-container-highest text-on-surface'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Input de Búsqueda y Refrescar */}
        <div className="flex items-center gap-2">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Buscar por título o contenido..."
            label="Buscar notificaciones"
            className="sm:w-64"
          />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              title="Refrescar historial"
              className="inline-flex items-center justify-center w-10 h-10 rounded-lg border border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low text-on-surface transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[20px]">refresh</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabla Principal */}
      <section className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm overflow-hidden">
        <DataTable
          className="min-w-full"
          tableClassName="min-w-[800px]"
          headers={(
            <>
              <th className="px-4 py-3 font-semibold text-xs" scope="col">Fecha / Hora</th>
              <th className="px-4 py-3 font-semibold text-xs" scope="col">Título y Asunto</th>
              <th className="px-4 py-3 font-semibold text-xs" scope="col">Canales</th>
              <th className="px-4 py-3 font-semibold text-xs text-center" scope="col">Destinatarios</th>
              <th className="px-4 py-3 font-semibold text-xs" scope="col">Estado</th>
            </>
          )}
        >
          <TableMessageRow
            colSpan={5}
            isLoading={isLoading}
            isEmpty={visibleRows.length === 0}
            error={error}
            loadingText="Cargando historial de notificaciones..."
            errorText="No se pudo obtener el historial de notificaciones desde el backend."
            emptyText="No hay notificaciones enviadas registradas con los filtros seleccionados."
          />

          {!isLoading &&
            !error &&
            visibleRows.map((item) => {
              const canales = getCanalesInvolucrados(item)
              const enviosCount = item.envios?.length || item.destinatarios_count || 1
              const fecha = item.fecha_creacion
                ? new Date(item.fecha_creacion).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Reciente'

              return (
                <tr
                  key={item.id}
                  onClick={() => handleOpenDetalle(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      handleOpenDetalle(item)
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Ver detalle de ${item.titulo || item.asunto || 'notificación oficial'}`}
                  className="cursor-pointer hover:bg-surface-container-low/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors"
                >
                  {/* Fecha */}
                  <td className="px-4 py-3 text-xs text-on-surface-variant font-medium whitespace-nowrap">
                    {fecha}
                  </td>

                  {/* Título y Mensaje */}
                  <td className="px-4 py-3 max-w-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-on-surface line-clamp-1">
                        {item.titulo || item.asunto || 'Notificación oficial'}
                      </span>
                      {item.asunto && item.asunto !== item.titulo && (
                        <span className="text-xs text-on-surface-variant line-clamp-1">
                          Asunto: {item.asunto}
                        </span>
                      )}
                      {item.contenido && (
                        <p className="text-xs text-on-surface-variant/75 line-clamp-1 mt-0.5 font-normal">
                          {item.contenido}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Canales */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {canales.includes('WHATSAPP') && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                          title="Difundido por WhatsApp"
                        >
                          <span className="material-symbols-outlined text-[13px]">chat</span>
                          WhatsApp
                        </span>
                      )}
                      {canales.includes('MAIL') && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/10 text-sky-700 border border-sky-500/20"
                          title="Difundido por Correo Electrónico"
                        >
                          <span className="material-symbols-outlined text-[13px]">mail</span>
                          Email
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Cantidad Destinatarios */}
                  <td className="px-4 py-3 text-center">
                    <div className="inline-flex flex-col items-center">
                      <span className="text-sm font-bold text-primary">{enviosCount}</span>
                      <span className="text-[10px] text-on-surface-variant font-medium">contactos</span>
                    </div>
                  </td>

                  {/* Estado */}
                  <td className="px-4 py-3 whitespace-nowrap">{getEstadoBadge(item.estado)}</td>
                </tr>
              )
            })}
        </DataTable>

        {/* Paginación */}
        {!isLoading && !error && filteredRows.length > 0 && (
          <div className="border-t border-outline-variant/20 p-2">
            <TablePagination id="comunicaciones-rows-per-page" {...paginationProps} />
          </div>
        )}
      </section>

      {/* Modal de Detalle */}
      <DetalleNotificacionModal
        isOpen={isDetalleOpen}
        onClose={() => setIsDetalleOpen(false)}
        notificacion={selectedNotificacion}
      />
    </div>
  )
}
