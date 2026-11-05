import { useMemo, useState } from 'react'
import { formatDni, formatPhone } from '../personas/format'
import { SecondaryButton } from '../personas/tabs/parts'
import StatusBadge from '../shared/StatusBadge'
import TableSearchInput from '../shared/TableSearchInput'
import TableTabs from '../shared/TableTabs'

const ESTADO_BADGES = {
  ENVIADA: { label: 'Enviada', tono: 'exito', icon: 'check_circle' },
  PROGRAMADA: { label: 'Programada', tono: 'alerta', icon: 'schedule' },
  FALLIDA: { label: 'Fallida', tono: 'error', icon: 'error' },
}

export default function DetalleNotificacionModal({ isOpen, onClose, notificacion }) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState('TODOS')

  const envios = useMemo(() => notificacion?.envios || [], [notificacion])

  const counts = useMemo(() => {
    const exitosos = envios.filter((e) => e.estado === 'ENVIADA').length
    const fallidos = envios.filter((e) => e.estado === 'FALLIDA').length
    return {
      TODOS: envios.length,
      ENVIADA: exitosos,
      FALLIDA: fallidos,
    }
  }, [envios])

  const filteredEnvios = useMemo(() => {
    const q = search.trim().toLowerCase()
    return envios.filter((e) => {
      if (tab !== 'TODOS' && e.estado !== tab) return false
      if (!q) return true
      return (
        (e.socio_nombre || '').toLowerCase().includes(q) ||
        (e.socio_dni || '').toLowerCase().includes(q) ||
        (e.destinatario_contacto || '').toLowerCase().includes(q) ||
        (e.canal || '').toLowerCase().includes(q)
      )
    })
  }, [envios, tab, search])

  if (!isOpen || !notificacion) return null

  const badge = ESTADO_BADGES[notificacion.estado] || {
    label: notificacion.estado || 'Enviada',
    tono: 'neutral',
    icon: 'info',
  }

  let fechaStr = '—'
  if (notificacion.fecha_creacion) {
    try {
      const d = new Date(notificacion.fecha_creacion)
      fechaStr = `${d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })} a las ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
    } catch {
      fechaStr = notificacion.fecha_creacion
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalle-notif-modal-title"
    >
      <div className="bg-surface-container-lowest border border-outline-variant/50 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface-container-low flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <StatusBadge badge={badge} />
              <span className="text-xs text-on-surface-variant tabular-nums">{fechaStr}</span>
            </div>
            <h2 id="detalle-notif-modal-title" className="text-lg font-bold text-on-surface truncate">
              {notificacion.asunto || notificacion.titulo || 'Detalle de notificación'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors cursor-pointer shrink-0"
            aria-label="Cerrar detalle"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-5">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
              Mensaje enviado
            </h3>
            <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/40 text-sm text-on-surface whitespace-pre-wrap leading-relaxed">
              {notificacion.contenido || '—'}
            </div>
          </div>

          <div className="border border-outline-variant/40 rounded-lg overflow-hidden bg-surface-container-lowest">
            <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/40 flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm font-semibold text-on-surface">
                Destinatarios y envíos ({envios.length})
              </span>
              <TableSearchInput
                value={search}
                onChange={setSearch}
                label="Filtrar destinatario"
                placeholder="Filtrar destinatario..."
                className="w-56"
              />
            </div>

            <TableTabs
              id="detalle-notificacion-tabs"
              label="Filtrar destinatarios por resultado"
              options={[
                { value: 'TODOS', label: 'Todos', count: counts.TODOS },
                { value: 'ENVIADA', label: 'Entregados', count: counts.ENVIADA },
                { value: 'FALLIDA', label: 'Fallidos', count: counts.FALLIDA },
              ]}
              value={tab}
              onChange={setTab}
            />

            <div className="max-h-72 overflow-y-auto">
              {filteredEnvios.length === 0 ? (
                <p className="p-8 text-center text-sm text-on-surface-variant">
                  No hay envíos para mostrar con el filtro seleccionado.
                </p>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-surface-container-low/60 border-b border-outline-variant/30 text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
                      <th scope="col" className="py-2.5 px-4">Destinatario</th>
                      <th scope="col" className="py-2.5 px-4">Canal</th>
                      <th scope="col" className="py-2.5 px-4">Contacto</th>
                      <th scope="col" className="py-2.5 px-4">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {filteredEnvios.map((envio) => {
                      const isMail = envio.canal === 'MAIL'
                      const contactoRaw = envio.destinatario_contacto || ''
                      const contactoDisplay = isMail
                        ? contactoRaw || 'Sin correo'
                        : formatPhone(contactoRaw) || 'Sin teléfono'
                      const envioBadge = ESTADO_BADGES[envio.estado] || {
                        label: envio.estado || 'Enviado',
                        tono: 'neutral',
                        icon: 'info',
                      }

                      return (
                        <tr key={envio.id}>
                          <td className="py-2.5 px-4">
                            <p className="font-semibold text-on-surface">
                              {envio.socio_nombre || `Socio #${envio.socio}`}
                            </p>
                            {envio.socio_dni && (
                              <p className="text-xs text-on-surface-variant tabular-nums">
                                DNI {formatDni(envio.socio_dni)}
                              </p>
                            )}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            {isMail ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">mail</span>
                                Email
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-success/10 text-success text-xs font-medium">
                                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">chat</span>
                                WhatsApp
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-xs text-on-surface font-mono break-all">
                            {contactoDisplay}
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="flex flex-col items-start gap-1">
                              <StatusBadge badge={envioBadge} />
                              {envio.detalle_fallo && (
                                <span className="text-[11px] text-error leading-snug max-w-xs">
                                  {envio.detalle_fallo}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-outline-variant/40 bg-surface-container-low flex justify-end">
          <SecondaryButton type="button" onClick={onClose}>
            Cerrar
          </SecondaryButton>
        </div>
      </div>
    </div>
  )
}
