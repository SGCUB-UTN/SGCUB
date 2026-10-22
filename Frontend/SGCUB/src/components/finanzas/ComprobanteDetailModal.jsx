import { Modal } from '@mantine/core'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import DesgloseComprobante from './DesgloseComprobante'

function ComprobanteDetailModal({ comprobante, detalle, loading, error, opened, onClose, onCorrect }) {
  if (!comprobante) return null
  const pago = detalle?.pago_detalle
  const itemsPago = pago?.items_pago ?? []
  const socio = pago?.socio
  const anulado = detalle?.estado === 'Anulado' || pago?.estado_pago === 'Anulado'

  return (
    <Modal opened={opened} onClose={onClose} title="Detalle del comprobante" centered size="md">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-surface-container-low border border-outline-variant/30">
          <span className="material-symbols-outlined text-primary text-3xl">receipt_long</span>
          <div><p className="text-sm text-on-surface-variant">Comprobante</p><p className="text-xl font-bold text-on-surface">{detalle?.tipo ? `${detalle.tipo} - ` : ''}#{comprobante.numero}</p></div>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
          <div><dt className="text-sm text-on-surface-variant">Fecha de emisión</dt><dd className="font-semibold text-on-surface">{formatDate(comprobante.fecha_emision)}</dd></div>
          <div><dt className="text-sm text-on-surface-variant">Pago asociado</dt><dd className="font-semibold text-on-surface">#{comprobante.pago}</dd></div>
          <div className="col-span-2 p-3 rounded-lg bg-surface-container-low"><dt className="text-sm text-on-surface-variant">Monto total</dt><dd className="text-2xl font-bold text-primary">{formatAmount(comprobante.monto_total)}</dd></div>
        </dl>
        {loading && <p className="text-sm text-on-surface-variant">Cargando detalle del pago...</p>}
        {error && <p className="text-sm text-error" role="alert">No se pudo cargar el detalle completo del pago.</p>}
        {!loading && !error && (
          <>
            {socio && <div className="p-3 rounded-lg bg-surface-container-low"><p className="text-sm text-on-surface-variant">Socio</p><p className="font-semibold text-on-surface">{socio.apellido}, {socio.nombre} · DNI {formatDni(socio.dni)} · Socio N° {socio.numero_socio}</p></div>}
            <DesgloseComprobante detalle={detalle} />
            <section className="border border-outline-variant/30 rounded-lg overflow-hidden"><h3 className="px-3 py-2 bg-surface-container-low font-semibold text-on-surface">Medios de pago</h3>{itemsPago.length ? itemsPago.map((item) => <div key={item.id_item_pago} className="flex justify-between px-3 py-2 border-t border-outline-variant/20"><span className="text-on-surface-variant">{item.medio_de_pago}</span><strong>{formatAmount(item.monto)}</strong></div>) : <p className="p-3 text-sm text-on-surface-variant">Sin detalle de medios disponible.</p>}</section>
            <div className="p-3 rounded-lg bg-surface-container-low">
              <p className="text-sm text-on-surface-variant">Estado</p>
              <p className={`font-semibold ${anulado ? 'text-error' : 'text-emerald-700'}`}>{anulado ? 'Anulado' : pago?.estado_pago ?? 'Acreditado'}</p>
              {pago?.observacion && <p className="mt-2 text-sm text-on-surface-variant">{pago.observacion}</p>}
              {pago?.motivo_anulacion && <p className="mt-2 text-sm text-on-surface-variant">Motivo de la anulación: {pago.motivo_anulacion}</p>}
              {detalle?.reemplazado_por_numero && <p className="mt-2 text-sm text-on-surface-variant">Reemplazado por el comprobante #{detalle.reemplazado_por_numero}</p>}
              {detalle?.reemplaza_a_numero && <p className="mt-2 text-sm text-on-surface-variant">Reemplaza al comprobante #{detalle.reemplaza_a_numero}</p>}
            </div>
            <DownloadComprobanteButtom comprobanteId={comprobante.comprobante_id} />
            {pago && pago.estado_pago !== 'Anulado' && onCorrect && (
              <div className="pt-3 border-t border-outline-variant/30">
                <button type="button" onClick={() => onCorrect(pago)} className="inline-flex items-center gap-2 h-10 px-4 border border-primary/40 rounded-md font-semibold text-primary hover:bg-primary/5">
                  <span className="material-symbols-outlined text-lg">published_with_changes</span>Revisar y corregir pago
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export default ComprobanteDetailModal