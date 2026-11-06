import { formatAmount, formatDate, formatDni, formatReceiptPhone } from '../personas/format'
import DesgloseComprobante from './DesgloseComprobante'

const DEFAULT_CLUB_NAME = 'Club Universitario de Berisso'
const DEFAULT_CLUB_LOGO = '/escudo-sin-fondo.png'

function showDefaultLogo(event) {
  if (!event.currentTarget.src.endsWith(DEFAULT_CLUB_LOGO)) event.currentTarget.src = DEFAULT_CLUB_LOGO
}

function formatClubAddress(cfg) {
  if (!cfg) return ''
  const calleYNumero = [cfg.domicilio_calle, cfg.domicilio_numero].filter(Boolean).join(' ')
  const pisoDepto = [cfg.domicilio_piso && `Piso ${cfg.domicilio_piso}`, cfg.domicilio_departamento].filter(Boolean).join(' ')
  const barrio = cfg.domicilio_barrio_nombre || ''
  const localidad = cfg.domicilio_localidad_nombre || ''
  return [calleYNumero, pisoDepto, barrio, localidad].filter(Boolean).join(', ')
}

function annulmentLine(anulacion) {
  return anulacion?.fecha ? `Anulado el ${formatDate(anulacion.fecha)}` : 'Anulado'
}

export function ReceiptSection({ title, children }) {
  return (
    <section className="border-b border-outline-variant/30">
      <div className="px-5 py-2 bg-surface-container-low border-b border-outline-variant/30">
        <h3 className="font-semibold text-on-surface">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export function ReceiptTotal({ label, amount, tone = 'text-primary' }) {
  return (
    <div className="flex justify-between items-center gap-4 px-5 py-3 border-t border-outline-variant/30 bg-surface-container-low/70">
      <strong className="text-on-surface font-semibold">{label}</strong>
      <strong className={`text-xl font-bold ${tone}`}>{formatAmount(amount)}</strong>
    </div>
  )
}

export function ReceiptLayout({
  ref,
  clubConfig,
  socio = {},
  titulo,
  codigo,
  fecha,
  pie,
  anulado = false,
  anulacion = null,
  children,
}) {
  const clubNombre = clubConfig?.club_nombre || DEFAULT_CLUB_NAME
  const clubAddress = formatClubAddress(clubConfig)

  return (
    <div
      ref={ref}
      className="relative border border-outline-variant/40 rounded-2xl overflow-hidden bg-surface-container-lowest shadow-sm"
    >
      {/* Encabezado institucional: Club a la izquierda, Comprobante a la derecha */}
      <div className="p-5 border-b border-outline-variant/30 bg-surface-container-low/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          {/* Lado izquierdo: Identidad y datos del Club */}
          <div className="flex items-start gap-4 min-w-0">
            <img
              src={clubConfig?.club_logo || DEFAULT_CLUB_LOGO}
              alt={clubNombre}
              onError={showDefaultLogo}
              className="h-16 w-auto max-w-[130px] max-h-16 object-contain rounded-lg border border-outline-variant/30 bg-surface p-1 shrink-0"
            />
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
                    <span><span className="text-on-surface-variant/70">Tel:</span> {formatReceiptPhone(clubConfig.club_telefono)}</span>
                  )}
                  {clubConfig?.club_telefono && clubConfig?.club_email && <span className="mx-1.5 opacity-40">·</span>}
                  {clubConfig?.club_email && <span>{clubConfig.club_email}</span>}
                </p>
              )}
            </div>
          </div>

          {/* Lado derecho: Tarjeta de Comprobante / Recibo */}
          <div className="sm:text-right shrink-0 sm:min-w-[210px]">
            <p className="text-xl font-bold uppercase text-on-surface">{titulo}</p>
            <p className="text-base font-bold font-mono text-on-surface tracking-tight">N° {codigo?.split(' ').pop()}</p>
            {anulado && <p className="text-xs font-semibold text-error">{annulmentLine(anulacion)}</p>}
            <p className="text-xs text-on-surface-variant mt-0.5">Fecha: {fecha}</p>
            <p className="text-[11px] text-on-surface-variant/70 mt-1 italic">Documento no válido como factura</p>
          </div>
        </div>
      </div>

      {/* Datos del Socio */}
      <div className="p-5 border-b border-outline-variant/30">
        <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Datos del socio</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-xs text-on-surface-variant">Apellido y nombre</p>
            <p className="font-semibold text-on-surface truncate">{socio.apellido || socio.nombre ? `${socio.apellido || ''}, ${socio.nombre || ''}`.replace(/^, |, $/g, '') : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">DNI</p>
            <p className="font-semibold text-on-surface">{socio.dni ? formatDni(socio.dni) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-on-surface-variant">N° de socio</p>
            <p className="font-semibold text-on-surface">{socio.numero_socio ?? '—'}</p>
          </div>
        </div>
      </div>

      {children}

      {/* Pie institucional */}
      <div className="px-5 py-3 bg-surface-container-low/40 text-center text-xs text-on-surface-variant">
        {pie}
      </div>

      {anulado && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden" aria-hidden="true">
          <span className="-rotate-45 select-none text-6xl sm:text-8xl md:text-9xl font-extrabold uppercase tracking-widest text-error/20">
            Anulado
          </span>
        </div>
      )}
    </div>
  )
}

function ReciboComprobante({
  ref,
  clubConfig,
  socio = {},
  detalle,
  codigo,
  fecha,
  medios = [],
  montoTotal,
  observacion,
  anulado = false,
  anulacion = null,
}) {
  return (
    <ReceiptLayout
      ref={ref}
      clubConfig={clubConfig}
      socio={socio}
      titulo={`Recibo ${detalle?.tipo || 'X'}`}
      codigo={codigo}
      fecha={fecha}
      pie="Recibo de uso interno · Asociación civil sin fines de lucro exenta"
      anulado={anulado}
      anulacion={anulacion}
    >
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
      <ReceiptSection title="Detalle del cobro">
        <div className="divide-y divide-outline-variant/20">
          {medios.map((medio, index) => (
            <div key={`${medio.medio}-${index}`} className="flex justify-between gap-4 px-5 py-2.5 text-sm">
              <span className="text-on-surface-variant">{medio.medio}</span>
              <strong className="text-on-surface">{formatAmount(medio.monto)}</strong>
            </div>
          ))}
        </div>
        <ReceiptTotal label="Total abonado" amount={montoTotal} />
      </ReceiptSection>

      {/* Observación si existe */}
      {observacion && (
        <div className="p-5 border-b border-outline-variant/30">
          <p className="text-xs text-on-surface-variant font-medium">Observación</p>
          <p className="text-sm text-on-surface mt-0.5">{observacion}</p>
        </div>
      )}
    </ReceiptLayout>
  )
}

export default ReciboComprobante
