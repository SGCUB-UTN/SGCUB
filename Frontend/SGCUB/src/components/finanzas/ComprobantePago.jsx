import { useEffect, useRef, useState } from 'react'
import { formatDate } from '../personas/format'
import { SecondaryButton } from '../personas/tabs/parts'
import { getConfiguracionGeneral } from '../../api/configuracion'
import DownloadComprobanteButton from './DownloadComprobanteButton'
import WhatsAppComprobanteButton from './WhatsAppComprobanteButton'
import ReciboComprobante from './ReciboComprobante'

function ComprobantePago({
  socio,
  detalle,
  medios = [],
  montoTotal,
  observacion,
  numero,
  fecha: fechaEmision,
  comprobanteId: registeredId = null,
  onRetryDetalle = null,
  onRevert = null,
  onBack,
  backLabel = 'Volver al estado de cuenta',
}) {
  const [clubConfig, setClubConfig] = useState(null)
  const [retrying, setRetrying] = useState(false)
  const [retryFailed, setRetryFailed] = useState(false)
  const comprobanteRef = useRef(null)
  const fecha = fechaEmision ? formatDate(fechaEmision) : new Date().toLocaleDateString('es-AR')

  useEffect(() => {
    let active = true
    getConfiguracionGeneral()
      .then((cfg) => {
        if (active) setClubConfig(cfg)
      })
      .catch((err) => console.error('No se pudo cargar la configuración del club:', err))
    return () => {
      active = false
    }
  }, [])

  const socioCompleto = { ...(socio || {}), ...(detalle?.socio || {}) }
  const clubNombre = clubConfig?.club_nombre || 'Club Universitario de Berisso'
  const codigoComprobante = detalle?.codigo ?? (numero ? `X ${String(numero).padStart(8, '0')}` : 'Pendiente')
  const comprobanteId = detalle?.comprobante_id ?? registeredId
  const missingDetalle = !detalle && Boolean(onRetryDetalle)

  const retryDetalle = async () => {
    setRetrying(true)
    setRetryFailed(false)
    try {
      await onRetryDetalle()
    } catch {
      setRetryFailed(true)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 flex-1 min-h-0">
      {/* Estado superior */}
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700">Operación confirmada</p>
          <h2 className="text-2xl font-bold text-on-surface">Comprobante de pago</h2>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-semibold text-sm border border-emerald-500/20">
          <span className="material-symbols-outlined text-base">verified</span>
          Registrado
        </span>
      </div>

      {missingDetalle && (
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-amber-700/30 bg-amber-50 text-on-surface" role="alert">
          <p className="flex items-start gap-2 text-base">
            <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0" aria-hidden="true">warning</span>
            {retryFailed
              ? 'Todavía no se pudo cargar el comprobante. El pago está registrado; podés reintentar o verlo después desde el estado de cuenta.'
              : 'El pago quedó registrado, pero no se pudo cargar el comprobante completo.'}
          </p>
          <button
            type="button"
            onClick={retryDetalle}
            disabled={retrying}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-outline-variant/60 bg-surface-container-lowest text-base font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default"
          >
            <span className={`material-symbols-outlined text-[20px] ${retrying ? 'animate-spin' : ''}`} aria-hidden="true">refresh</span>
            {retrying ? 'Cargando...' : 'Reintentar'}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-2 thin-scroll [scrollbar-gutter:stable_both-edges]">
        <ReciboComprobante
          ref={comprobanteRef}
          clubConfig={clubConfig}
          socio={socioCompleto}
          detalle={detalle}
          codigo={codigoComprobante}
          fecha={fecha}
          medios={medios}
          montoTotal={montoTotal}
          observacion={observacion}
        />
      </div>

      {/* Acciones */}
      <div className="shrink-0 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
        {onRevert && detalle?.revertible && (
          <button
            type="button"
            onClick={onRevert}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 border border-error/40 rounded-lg text-base font-semibold text-error hover:bg-error-container/40 transition-colors cursor-pointer sm:mr-auto"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">undo</span>
            Revertir pago
          </button>
        )}
        <SecondaryButton icon="arrow_back" onClick={onBack}>{backLabel}</SecondaryButton>
        <DownloadComprobanteButton comprobanteId={comprobanteId} />
        <WhatsAppComprobanteButton
          socio={socioCompleto}
          comprobanteId={comprobanteId}
          comprobanteCodigo={codigoComprobante}
          montoTotal={montoTotal}
          clubNombre={clubNombre}
          comprobanteRef={comprobanteRef}
        />
      </div>
    </div>
  )
}

export default ComprobantePago
