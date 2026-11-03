import { useEffect, useRef, useState } from 'react'
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
  const clubAddress = formatClubAddress(clubConfig)
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
      <div
        ref={comprobanteRef}
        className="border border-outline-variant/40 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm"
      >
        {/* Encabezado institucional: Club a la izquierda, Comprobante a la derecha */}
        <div className="p-5 border-b border-outline-variant/30 bg-surface-container-low/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            {/* Lado izquierdo: Identidad y datos del Club */}
            <div className="flex items-start gap-4 min-w-0">
              {clubConfig?.club_logo && (
                <img
                  src={clubConfig.club_logo}
                  alt={clubNombre}
                  className="h-16 w-auto max-w-[130px] max-h-16 object-contain rounded-lg border border-outline-variant/30 bg-surface p-1 shrink-0"
                />
              )}
              <div className="flex flex-col gap-0.5 min-w-0">
                <h3 className="font-bold text-xl text-on-surface leading-tight">{clubNombre}</h3>
                {clubConfig?.club_cuit && (
                  <p className="text-xs text-on-surface-variant font-medium">
                    <span className="text-on-surface-variant/70">CUIT:</span> {clubConfig.club_cuit}
                  </p>
                )}
                {clubAddress && (
                  <p className="text-xs text-on-surface-variant">
                    <span className="text-on-surface-variant/70">Dirección:</span> {clubAddress}
                  </p>
                )}
                {(clubConfig?.club_telefono || clubConfig?.club_email) && (
                  <p className="text-xs text-on-surface-variant">
                    {clubConfig?.club_telefono && (
                      <span><span className="text-on-surface-variant/70">Tel:</span> {clubConfig.club_telefono}</span>
                    )}
                    {clubConfig?.club_telefono && clubConfig?.club_email && <span className="mx-1.5 opacity-40">·</span>}
                    {clubConfig?.club_email && <span>{clubConfig.club_email}</span>}
                  </p>
                )}
              </div>
            </div>

            {/* Lado derecho: Tarjeta de Comprobante / Recibo */}
            <div className="sm:text-right shrink-0 sm:min-w-[210px]">
              <div className="sm:flex sm:justify-end mb-1">
                <span className="inline-block px-2.5 py-0.5 rounded text-xs font-bold tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
                  Recibo {detalle?.tipo || 'X'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-on-surface tracking-tight">{codigoComprobante}</p>
              <p className="text-xs text-on-surface-variant mt-0.5">Fecha: {fecha}</p>
              <p className="text-[11px] text-on-surface-variant/70 mt-1 italic">Documento no válido como factura</p>
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
        <div className="border-b border-outline-variant/30">
          {detalle ? (
            <DesgloseComprobante detalle={detalle} flat />
          ) : (
            <p className="px-5 py-4 text-sm text-on-surface-variant">
              El pago quedó registrado. Podés consultar el desglose completo en el listado de comprobantes.
            </p>
          )}
        </div>

        {/* Medios de pago y Total */}
        <section className="border-b border-outline-variant/30">
          <div className="px-5 py-2 bg-surface-container-low border-b border-outline-variant/30">
            <h3 className="font-semibold text-on-surface">Detalle del cobro</h3>
          </div>
          <div className="divide-y divide-outline-variant/20">
            {medios.map((medio, index) => (
              <div key={`${medio.medio}-${index}`} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
                <span className="text-on-surface-variant">{medio.medio}</span>
                <strong className="text-on-surface">{formatAmount(medio.monto)}</strong>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center gap-4 px-5 py-3 border-t border-outline-variant/30 bg-surface-container-low/70">
            <strong className="text-on-surface font-semibold">Total abonado</strong>
            <strong className="text-xl font-bold text-primary">{formatAmount(montoTotal)}</strong>
          </div>
        </section>

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
      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
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
