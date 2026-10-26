import { formatAmount, formatDate, formatDni } from '../personas/format'
import { SecondaryButton } from '../personas/tabs/parts'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import DesgloseComprobante from './DesgloseComprobante'

function ComprobantePago({ socio, detalle, medios, montoTotal, observacion, numero, fecha: fechaEmision, onBack }) {
  const fecha = fechaEmision ? formatDate(fechaEmision) : new Date().toLocaleDateString('es-AR')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><p className="text-sm uppercase tracking-wider font-semibold text-emerald-700">Operación confirmada</p><h2 className="text-2xl font-bold text-on-surface">Comprobante de pago</h2></div>
        <span className="inline-flex items-center gap-2 text-emerald-700 font-semibold"><span className="material-symbols-outlined">verified</span>Registrado</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
        <div><p className="text-sm text-on-surface-variant">Fecha</p><p className="font-semibold text-on-surface">{fecha}</p></div>
        <div><p className="text-sm text-on-surface-variant">Comprobante N°</p><p className="font-semibold text-on-surface">{detalle?.tipo ? `${detalle.tipo} - ` : ''}{numero ?? 'Pendiente'}</p></div>
        <div><p className="text-sm text-on-surface-variant">Socio N°</p><p className="font-semibold text-on-surface">{socio.numero_socio}</p></div>
        <div><p className="text-sm text-on-surface-variant">Nombre y apellido</p><p className="font-semibold text-on-surface">{socio.nombre} {socio.apellido}</p></div>
        <div><p className="text-sm text-on-surface-variant">DNI</p><p className="font-semibold text-on-surface">{formatDni(socio.dni)}</p></div>
      </div>

      {detalle
        ? <DesgloseComprobante detalle={detalle} />
        : <p className="p-4 bg-surface-container-low rounded-lg text-on-surface-variant">El pago quedó registrado, pero no se pudo cargar el desglose. Podés consultarlo desde el listado de comprobantes.</p>}

      <section className="border border-outline-variant/30 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/30"><h3 className="font-bold text-on-surface">Detalle del pago</h3></div>
        <div className="divide-y divide-outline-variant/20">
          {medios.map((medio, index) => <div key={`${medio.medio}-${index}`} className="flex justify-between gap-4 px-4 py-3"><span className="text-on-surface-variant">{medio.medio}</span><strong className="text-on-surface">{formatAmount(medio.monto)}</strong></div>)}
          <div className="flex justify-between gap-4 px-4 py-3 bg-surface-container-low"><strong className="text-on-surface">Monto total</strong><strong className="text-lg text-primary">{formatAmount(montoTotal)}</strong></div>
        </div>
      </section>

      {observacion && <div className="p-4 bg-surface-container-low rounded-lg"><p className="text-sm text-on-surface-variant">Observación</p><p className="text-on-surface">{observacion}</p></div>}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        <DownloadComprobanteButtom comprobanteId={detalle?.comprobante_id} />
        <SecondaryButton icon="arrow_back" onClick={onBack}>Volver al estado de cuenta</SecondaryButton>
      </div>
    </div>
  )
}

export default ComprobantePago