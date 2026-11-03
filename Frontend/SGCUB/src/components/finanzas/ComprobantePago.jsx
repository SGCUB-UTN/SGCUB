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
  onBack,
  backLabel = 'Volver al estado de cuenta',
}) {
  const [clubConfig, setClubConfig] = useState(null)
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
  const comprobanteId = detalle?.comprobante_id

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
