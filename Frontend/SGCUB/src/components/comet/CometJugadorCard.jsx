import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCometJugadorEstado, useExportarJugadorAComet } from '../../hooks/useComet'
import CometModoBadge from './CometModoBadge'
import { useCometStatus } from '../../hooks/useComet'

function formatearFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function EstadoIcono({ exportado }) {
  return exportado ? (
    <span className="material-symbols-outlined text-[20px] text-[#0d652d]" aria-hidden="true">check_circle</span>
  ) : (
    <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">cloud_off</span>
  )
}

function BadgeEstado({ ultimo }) {
  if (!ultimo) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-surface-container-high text-on-surface-variant">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">circle</span>
        Sin exportar
      </span>
    )
  }
  if (ultimo.exitoso) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-[#e6f4ea] text-[#0d652d]">
        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">check_circle</span>
        Exportado
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-error-container/40 text-on-error-container">
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">error</span>
      Último intento falló
    </span>
  )
}

function ModalConfirmacion({ jugador, onConfirm, onCancel, exporting }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface-container-lowest rounded-lg shadow-xl border border-outline-variant/30 max-w-md w-full p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">cloud_upload</span>
          </div>
          <h3 className="text-lg font-semibold text-on-surface">Exportar a COMET</h3>
        </div>
        <p className="text-sm text-on-surface-variant">
          ¿Confirmás que querés exportar a <strong className="text-on-surface">{jugador?.socio?.nombre} {jugador?.socio?.apellido}</strong> a COMET? Esta operación envía los datos del jugador al sistema oficial.
        </p>
        <div className="flex items-center justify-end gap-2 mt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={exporting}
            className="px-4 py-2 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low border border-outline-variant/40 transition-colors disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {exporting && <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">progress_activity</span>}
            <span>{exporting ? 'Exportando...' : 'Exportar'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CometJugadorCard({ jugador }) {
  const { estado, isLoading, error, recargar } = useCometJugadorEstado(jugador?.jugador_id)
  const { exportar, exporting, resultado } = useExportarJugadorAComet()
  const { status: cometStatus } = useCometStatus()

  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false)

  const handleExportar = async () => {
    setMostrarConfirmacion(false)
    await exportar(jugador.jugador_id)
    await recargar()
  }

  const ultimo = estado?.ultimo_intento
  const exportado = estado?.exportado

  return (
    <>
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
        <div className="px-5 py-4 border-b border-outline-variant/20 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[20px]" aria-hidden="true">cloud_sync</span>
            <h2 className="text-base font-semibold text-on-surface">Integración COMET</h2>
          </div>
          {cometStatus?.modo && <CometModoBadge modo={cometStatus.modo} />}
        </div>

        <div className="p-5 flex flex-col gap-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] animate-spin" aria-hidden="true">progress_activity</span>
              <span className="text-sm">Consultando estado en COMET...</span>
            </div>
          )}

          {!isLoading && error && (
            <div className="bg-error-container/30 border border-error/40 rounded p-3 text-sm">
              <p className="font-semibold text-on-surface">No se pudo consultar el estado</p>
              <p className="text-on-surface-variant">Verificá la conexión con el backend.</p>
            </div>
          )}

          {!isLoading && !error && (
            <>
              <div className="flex items-start gap-3">
                <EstadoIcono exportado={exportado} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BadgeEstado ultimo={ultimo} />
                    {ultimo && (
                      <span className="text-xs text-on-surface-variant">
                        {formatearFecha(ultimo.fecha)}
                      </span>
                    )}
                  </div>
                  {ultimo?.mensaje && (
                    <p className="text-sm text-on-surface-variant mt-1">{ultimo.mensaje}</p>
                  )}
                  {ultimo?.referencia_externa && (
                    <p className="text-xs font-mono text-on-surface-variant mt-1">
                      ID COMET: {ultimo.referencia_externa}
                    </p>
                  )}
                </div>
              </div>

              {resultado && !resultado.ok && resultado.data?.mensaje && (
                <div className="bg-error-container/30 border border-error/40 rounded p-3 text-sm">
                  <p className="font-semibold text-on-surface">La exportación no se completó</p>
                  <p className="text-on-surface-variant">{resultado.data.mensaje}</p>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-outline-variant/20">
                <button
                  type="button"
                  onClick={() => setMostrarConfirmacion(true)}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold bg-primary text-on-primary hover:bg-primary/90 transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">cloud_upload</span>
                  <span>{exportado ? 'Re-exportar a COMET' : 'Exportar a COMET'}</span>
                </button>

                <Link
                  to={`/comet/logs`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded text-sm font-medium text-on-surface-variant hover:bg-surface-container-low border border-outline-variant/40 transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">history</span>
                  <span>Ver historial</span>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>

      {mostrarConfirmacion && (
        <ModalConfirmacion
          jugador={jugador}
          onConfirm={handleExportar}
          onCancel={() => setMostrarConfirmacion(false)}
          exporting={exporting}
        />
      )}
    </>
  )
}