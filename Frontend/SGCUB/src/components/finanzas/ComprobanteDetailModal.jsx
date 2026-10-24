import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { formatAmount, formatDate, formatDni, formatNumber } from '../personas/format'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import DesgloseComprobante from './DesgloseComprobante'
import { SummaryLine, TICKET_CLASS, TicketSection } from './formParts'

const METHOD_ICONS = {
  Efectivo: 'payments',
  Transferencia: 'account_balance',
  BilleteraVirtual: 'account_balance_wallet',
}

function ComprobanteDetailModal({ comprobante, detalle, loading, error, opened, onClose, onCorrect }) {
  const isMobile = useMediaQuery('(max-width: 640px)')

  if (!comprobante) return null

  const pago = detalle?.pago_detalle
  const itemsPago = pago?.items_pago ?? []
  const socio = pago?.socio ?? comprobante.socio ?? null
  const anulado = detalle?.estado === 'Anulado' || pago?.estado_pago === 'Anulado' || comprobante.estado === 'Anulado'
  const numeroLabel = `${detalle?.tipo ? `${detalle.tipo} - ` : ''}#${comprobante.numero}`
  const periodosCount = detalle?.periodos?.length ?? 0

  const modalTitle = (
    <div className="flex items-center justify-between gap-4 min-w-0 pr-2">
      <div className="flex items-center gap-4 min-w-0">
        <span className="shrink-0 text-sm uppercase tracking-wider font-semibold text-primary">
          Comprobante de pago
        </span>
        {socio && (
          <>
            <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
            <p className="min-w-0 truncate text-base text-on-surface-variant">
              <span className="text-lg font-bold text-on-surface">{socio.apellido}, {socio.nombre}</span>
              {' '}(DNI {formatDni(socio.dni)} • Socio #{formatNumber(socio.numero_socio)})
            </p>
          </>
        )}
      </div>
      <span
        className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide border ${
          anulado
            ? 'bg-error/10 text-error border-error/20'
            : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
        }`}
      >
        {anulado ? 'Anulado' : (pago?.estado_pago ?? 'Vigente')}
      </span>
    </div>
  )

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      aria-label="Detalle del comprobante de pago"
      title={modalTitle}
      styles={{ header: { gap: 16 }, title: { flex: 1, minWidth: 0 } }}
      size="min(980px, 95vw)"
      fullScreen={isMobile}
      centered
      padding="lg"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-6 items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/30">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-11 h-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl" aria-hidden="true">receipt_long</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
                  Recibo oficial de cobro
                </p>
                <p className="text-xl font-bold text-on-surface tabular-nums">{numeroLabel}</p>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div>
                <p className="text-xs text-on-surface-variant">Fecha de emisión</p>
                <p className="font-semibold text-on-surface tabular-nums">{formatDate(comprobante.fecha_emision)}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant">Pago asociado</p>
                <p className="font-semibold text-on-surface tabular-nums">#{comprobante.pago}</p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="p-6 rounded-xl border border-outline-variant/30 bg-surface-container-low/50 text-sm text-on-surface-variant">
              Cargando desglose del comprobante...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl border border-error/30 bg-error-container text-on-error-container text-sm" role="alert">
              No se pudo cargar el detalle completo del pago.
            </div>
          )}

          {!loading && !error && (
            <>
              <DesgloseComprobante detalle={detalle} />

              <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-surface-container-low border-b border-outline-variant/30">
                  <h3 className="font-semibold text-on-surface">Medios de pago utilizados</h3>
                </div>
                {itemsPago.length ? (
                  <div className="divide-y divide-outline-variant/20">
                    {itemsPago.map((item) => (
                      <div key={item.id_item_pago} className="flex items-center justify-between px-3 py-2.5 text-sm">
                        <span className="inline-flex items-center gap-2 text-on-surface font-medium">
                          <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">
                            {METHOD_ICONS[item.medio_de_pago] ?? 'payments'}
                          </span>
                          {item.medio_de_pago}
                        </span>
                        <strong className="text-on-surface tabular-nums">{formatAmount(item.monto)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-3 text-sm text-on-surface-variant">Sin detalle de medios disponible.</p>
                )}
              </section>

              {(pago?.observacion || pago?.motivo_anulacion || detalle?.reemplazado_por_numero || detalle?.reemplaza_a_numero) && (
                <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1.5 text-sm">
                  <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                    Observaciones y trazabilidad
                  </p>
                  {pago?.observacion && <p className="text-on-surface">{pago.observacion}</p>}
                  {pago?.motivo_anulacion && (
                    <p className="text-error font-medium">Motivo de la anulación: {pago.motivo_anulacion}</p>
                  )}
                  {detalle?.reemplazado_por_numero && (
                    <p className="text-on-surface-variant">
                      Reemplazado por el comprobante <strong className="text-on-surface">#{detalle.reemplazado_por_numero}</strong>
                    </p>
                  )}
                  {detalle?.reemplaza_a_numero && (
                    <p className="text-on-surface-variant">
                      Reemplaza al comprobante <strong className="text-on-surface">#{detalle.reemplaza_a_numero}</strong>
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <aside
          className={`${TICKET_CLASS} lg:sticky lg:top-4`}
          aria-label="Resumen tipo ticket del comprobante"
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-lg font-bold text-on-surface">Resumen del ticket</h3>
            <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 tabular-nums">
              {numeroLabel}
            </span>
          </div>

          <div className="flex flex-1 flex-col justify-between gap-3">
            <TicketSection title="Comprobante">
              <SummaryLine label="Fecha" value={formatDate(comprobante.fecha_emision)} />
              <SummaryLine label="Pago N°" value={`#${comprobante.pago}`} />
              <SummaryLine
                label="Estado"
                value={anulado ? 'Anulado' : (pago?.estado_pago ?? 'Acreditado')}
                valueClassName={anulado ? 'text-error' : 'text-emerald-700'}
              />
            </TicketSection>

            <TicketSection title="Liquidación">
              <SummaryLine
                label="Socio"
                value={socio ? `#${formatNumber(socio.numero_socio)}` : '—'}
              />
              <SummaryLine
                label="Períodos"
                value={loading ? '...' : `${periodosCount} ${periodosCount === 1 ? 'cuota' : 'cuotas'}`}
              />
              <SummaryLine
                label="Medios"
                value={itemsPago.length ? itemsPago.map((i) => i.medio_de_pago).join(' + ') : '—'}
              />
            </TicketSection>

            <div className="flex flex-col gap-1 pt-1">
              <SummaryLine
                label="Total abonado"
                value={formatAmount(comprobante.monto_total)}
                isTotal
                valueClassName={anulado ? 'text-error line-through' : 'text-primary'}
              />
              <p className="text-xs text-on-surface-variant">
                {anulado
                  ? 'Este comprobante fue anulado y no impacta en la recaudación vigente.'
                  : 'Importe acreditado e imputado en la cuenta corriente del socio.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-200">
            <DownloadComprobanteButtom
              comprobanteId={comprobante.comprobante_id}
              variant="primary"
              fullWidth
              label="Descargar comprobante PDF"
            />

            {!loading && !error && pago && pago.estado_pago !== 'Anulado' && onCorrect && (
              <button
                type="button"
                onClick={() => onCorrect(pago)}
                className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 border border-primary/40 bg-white rounded text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">published_with_changes</span>
                Revisar y corregir pago
              </button>
            )}
          </div>
        </aside>
      </div>
    </Modal>
  )
}

export default ComprobanteDetailModal