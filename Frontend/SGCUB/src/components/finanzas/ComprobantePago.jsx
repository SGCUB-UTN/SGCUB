import { useEffect, useState } from 'react'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import { SecondaryButton } from '../personas/tabs/parts'
import { getConfiguracionGeneral } from '../../api/configuracion'
import DownloadComprobanteButton from './DownloadComprobanteButton'
import WhatsAppComprobanteButton from './WhatsAppComprobanteButton'
import DesgloseComprobante from './DesgloseComprobante'

function formatClubAddress(cfg) {
  if (!cfg) return ''
  const calleYNumero = [cfg.domicilio_calle, cfg.domicilio_numero].filter(Boolean).join(' ')
  const pisoDepto = [cfg.domicilio_piso && `Piso ${cfg.domicilio_piso}`, cfg.domicilio_departamento].filter(Boolean).join(' ')
  const barrio = cfg.domicilio_barrio_nombre || ''
  const localidad = cfg.domicilio_localidad_nombre || ''
  return [calleYNumero, pisoDepto, barrio, localidad].filter(Boolean).join(', ')
}

function formatClubDetails(cfg) {
  if (!cfg) return ''
  const address = formatClubAddress(cfg)
  const parts = [
    cfg.club_cuit ? `CUIT ${cfg.club_cuit}` : '',
    address,
    cfg.club_telefono ? `Tel. ${cfg.club_telefono}` : '',
    cfg.club_email || '',
  ]
  return parts.filter(Boolean).join(' · ')
}

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
  const clubDetalles = formatClubDetails(clubConfig)
  const codigoComprobante = detalle?.codigo ?? (numero ? `X ${String(numero).padStart(8, '0')}` : 'Pendiente')
  const comprobanteId = detalle?.comprobante_id
  const socioPhone = socioCompleto.telefono || socioCompleto.persona?.telefono || ''

  return (
    <div className="flex flex-col gap-5">
      {/* Estado superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider font-semibold text-emerald-700">Operación confirmada</p>
          <h2 className="text-2xl font-bold text-on-surface">Comprobante de pago</h2>
        </div>
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-semibold text-sm border border-emerald-500/20">
          <span className="material-symbols-outlined text-base">verified</span>
          Registrado
        </span>
      </div>

      {/* Recibo formal con datos del club configurados */}
      <div className="border border-outline-variant/40 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm">
        {/* Encabezado del Club */}
        <div className="p-5 border-b border-outline-variant/30 bg-surface-container-low/50">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              {clubConfig?.club_logo ? (
                <img
                  src={clubConfig.club_logo}
                  alt={clubNombre}
                  className="h-14 w-14 object-contain rounded-lg border border-outline-variant/30 bg-surface p-1 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">receipt_long</span>
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-lg text-on-surface leading-tight truncate">{clubNombre}</h3>
                {clubDetalles && (
                  <p className="text-xs text-on-surface-variant mt-0.5 break-words">{clubDetalles}</p>
                )}
              </div>
            </div>

            <div className="sm:text-right shrink-0">
              <span className="inline-block px-2.5 py-1 rounded-md text-xs font-bold tracking-wider uppercase bg-primary/10 text-primary">
                Recibo {detalle?.tipo || 'X'}
              </span>
              <p className="text-lg font-extrabold text-on-surface tracking-tight mt-1">{codigoComprobante}</p>
              <p className="text-xs text-on-surface-variant">Emisión: {fecha}</p>
              <p className="text-[11px] text-on-surface-variant/80 mt-0.5">Documento no válido como factura</p>
            </div>
          </div>
        </div>

        {/* Datos del Socio */}
        <div className="p-5 border-b border-outline-variant/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Datos del socio</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-on-surface-variant">Apellido y nombre</p>
              <p className="font-semibold text-on-surface truncate">{socioCompleto.apellido || socioCompleto.nombre ? `${socioCompleto.apellido || ''}, ${socioCompleto.nombre || ''}`.replace(/^, |, $/g, '') : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">DNI</p>
              <p className="font-semibold text-on-surface">{socioCompleto.dni ? formatDni(socioCompleto.dni) : '—'}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">N° de socio</p>
              <p className="font-semibold text-on-surface">{socioCompleto.numero_socio ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-on-surface-variant">Teléfono</p>
              <p className={`font-semibold ${socioPhone ? 'text-on-surface' : 'text-on-surface-variant/60 italic'}`}>
                {socioPhone || 'No registrado'}
              </p>
            </div>
          </div>
        </div>

        {/* Desglose de cuotas y conceptos */}
        <div className="p-5 border-b border-outline-variant/30">
          {detalle ? (
            <DesgloseComprobante detalle={detalle} />
          ) : (
            <p className="p-3 bg-surface-container-low rounded-lg text-sm text-on-surface-variant">
              El pago quedó registrado. Podés consultar el desglose completo en el listado de comprobantes.
            </p>
          )}
        </div>

        {/* Medios de pago y Total */}
        <div className="p-5 border-b border-outline-variant/30 bg-surface-container-low/30">
          <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Detalle del cobro</p>
          <div className="divide-y divide-outline-variant/20 border border-outline-variant/30 rounded-xl overflow-hidden bg-surface">
            {medios.map((medio, index) => (
              <div key={`${medio.medio}-${index}`} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <span className="text-on-surface-variant">{medio.medio}</span>
                <strong className="text-on-surface">{formatAmount(medio.monto)}</strong>
              </div>
            ))}
            <div className="flex justify-between items-center gap-4 px-4 py-3 bg-surface-container-low/70">
              <strong className="text-on-surface font-semibold">Total abonado</strong>
              <strong className="text-xl font-bold text-primary">{formatAmount(montoTotal)}</strong>
            </div>
          </div>
        </div>

        {/* Observación si existe */}
        {observacion && (
          <div className="p-5 border-b border-outline-variant/30">
            <p className="text-xs text-on-surface-variant font-medium">Observación</p>
            <p className="text-sm text-on-surface mt-0.5">{observacion}</p>
          </div>
        )}

        {/* Pie institucional */}
        <div className="px-5 py-3 bg-surface-container-low/40 text-center text-xs text-on-surface-variant">
          Recibo de uso interno · Asociación civil sin fines de lucro exenta
        </div>
      </div>

      {/* Acciones */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
        <WhatsAppComprobanteButton
          socio={socioCompleto}
          comprobanteId={comprobanteId}
          comprobanteCodigo={codigoComprobante}
          montoTotal={montoTotal}
          clubNombre={clubNombre}
        />
        <DownloadComprobanteButton comprobanteId={comprobanteId} />
        <SecondaryButton icon="arrow_back" onClick={onBack}>{backLabel}</SecondaryButton>
      </div>
    </div>
  )
}

export default ComprobantePago
