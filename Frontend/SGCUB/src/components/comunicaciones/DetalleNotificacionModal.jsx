export default function DetalleNotificacionModal({ isOpen, onClose, notificacion }) {
  if (!isOpen || !notificacion) return null

  const envios = notificacion.envios || []
  const enviosExitosos = envios.filter((e) => e.estado === 'ENVIADA' || e.estado === 'RECIBIDO' || e.estado === 'LEIDO').length
  const enviosFallidos = envios.filter((e) => e.estado === 'FALLIDA').length
  const enviosProgramados = envios.filter((e) => e.estado === 'PROGRAMADA').length

  const getCanalBadge = (canal) => {
    const c = (canal || '').toUpperCase()
    if (c === 'WHATSAPP') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
          <span className="material-symbols-outlined text-[14px]">chat</span>
          WhatsApp
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-700 border border-sky-500/20">
        <span className="material-symbols-outlined text-[14px]">mail</span>
        Email
      </span>
    )
  }

  const getEstadoBadge = (estado) => {
    const est = (estado || '').toUpperCase()
    if (est === 'ENVIADA') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 border border-emerald-500/20">
          <span className="material-symbols-outlined text-[13px]">check_circle</span>
          Enviada
        </span>
      )
    }
    if (est === 'FALLIDA') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-error/10 text-error border border-error/20">
          <span className="material-symbols-outlined text-[13px]">error</span>
          Fallida
        </span>
      )
    }
    if (est === 'PROGRAMADA') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/20">
          <span className="material-symbols-outlined text-[13px]">schedule</span>
          Programada
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-container text-on-surface border border-outline-variant/30">
        {estado}
      </span>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl max-w-3xl w-full p-6 shadow-xl flex flex-col gap-5 max-h-[90vh] overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">mark_email_read</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-on-surface">
                  {notificacion.titulo || notificacion.asunto || 'Notificación oficial'}
                </h3>
                {getEstadoBadge(notificacion.estado)}
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Despachado el{' '}
                {notificacion.fecha_creacion
                  ? new Date(notificacion.fecha_creacion).toLocaleString('es-AR')
                  : 'Fecha no registrada'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer p-1"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Resumen de Métricas del Envío */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-container-low rounded-lg p-3 flex flex-col">
            <span className="text-xs font-medium text-on-surface-variant uppercase">Destinatarios</span>
            <span className="text-xl font-bold text-on-surface mt-1">{envios.length || 1}</span>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-lg p-3 flex flex-col">
            <span className="text-xs font-medium text-emerald-700 uppercase">Entregados / Enviados</span>
            <span className="text-xl font-bold text-emerald-700 mt-1">{enviosExitosos || envios.length}</span>
          </div>
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-3 flex flex-col">
            <span className="text-xs font-medium text-amber-700 uppercase">Programados</span>
            <span className="text-xl font-bold text-amber-700 mt-1">{enviosProgramados}</span>
          </div>
          <div className="bg-error/5 border border-error/15 rounded-lg p-3 flex flex-col">
            <span className="text-xs font-medium text-error uppercase">Fallidos</span>
            <span className="text-xl font-bold text-error mt-1">{enviosFallidos}</span>
          </div>
        </div>

        {/* Contenido del Mensaje */}
        <div className="flex flex-col gap-1.5 bg-surface-container-low/60 rounded-lg p-4 border border-outline-variant/20">
          <div className="flex items-center justify-between text-xs font-semibold text-on-surface-variant">
            <span>Asunto: {notificacion.asunto || notificacion.titulo || 'Sin asunto'}</span>
          </div>
          <p className="text-sm text-on-surface whitespace-pre-wrap mt-1 leading-relaxed">
            {notificacion.contenido || 'Sin contenido de mensaje.'}
          </p>
        </div>

        {/* Tabla de Estados de Cada Envío Individual */}
        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <h4 className="text-sm font-bold text-on-surface flex items-center justify-between">
            <span>Detalle de envíos individuales ({envios.length})</span>
            {enviosFallidos > 0 && (
              <span className="text-xs text-error font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                {enviosFallidos} fallos registrados
              </span>
            )}
          </h4>

          <div className="comunicaciones-table-scroll overflow-auto border border-outline-variant/30 rounded-lg max-h-[300px]">
            {envios.length === 0 ? (
              <p className="p-4 text-center text-xs text-on-surface-variant">
                No se registraron detalles individuales para este envío masivo.
              </p>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container border-b border-outline-variant/20 text-on-surface-variant sticky top-0 font-medium">
                  <tr>
                    <th className="py-2.5 px-3">Canal</th>
                    <th className="py-2.5 px-3">Contacto / Destinatario</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/15">
                  {envios.map((envio) => (
                    <tr key={envio.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-2.5 px-3">{getCanalBadge(envio.canal)}</td>
                      <td className="py-2.5 px-3 font-mono font-medium text-on-surface">
                        {envio.destinatario_contacto}
                      </td>
                      <td className="py-2.5 px-3">{getEstadoBadge(envio.estado)}</td>
                      <td className="py-2.5 px-3 text-on-surface-variant">
                        {envio.fecha_envio
                          ? new Date(envio.fecha_envio).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3 text-on-surface-variant">
                        {envio.detalle_fallo ? (
                          <span className="text-error font-medium">{envio.detalle_fallo}</span>
                        ) : (
                          <span className="text-on-surface-variant/70">Correcto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
