import { useState } from 'react'
import { descargarMovimientoPdf } from '../../api/movimientos'
import { formatAmount } from '../personas/format'
import { NO_SPINNER_CLASS } from './formParts'

export const renderPeriodoLabel = (periodo) => {
  if (!periodo) return '—'
  const [year, month] = periodo.split('-')
  const date = new Date(Number(year), Number(month) - 1, 1)
  const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function AddItemInlineForm({ onAdd, onCancel, maxAmount }) {
  const [concepto, setConcepto] = useState('Bonificación especial')
  const [customConcepto, setCustomConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  const PRESETS = [
    'Bonificación especial',
    'Descuento único',
    'Beca parcial',
    'Ajuste por diferencia',
    'Condonación de concepto',
    'Otro concepto',
  ]

  const handleSubmit = (e) => {
    e.preventDefault()
    const num = Number(monto)
    if (!monto || !Number.isFinite(num) || num <= 0) {
      setError('Ingresá un monto mayor a cero.')
      return
    }
    if (maxAmount != null && num > maxAmount) {
      setError(`El monto no puede superar el disponible de la cuota (${formatAmount(maxAmount)}).`)
      return
    }
    const finalConcepto = concepto === 'Otro concepto' ? (customConcepto.trim() || 'Ajuste de cuota') : concepto
    onAdd({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      concepto: finalConcepto,
      concepto_nombre: finalConcepto,
      monto: num,
      motivo: motivo.trim(),
      es_descuento: true,
      es_agregado: true,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add_circle</span>
          Agregar ítem de ajuste a la cuota
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer"
        >
          Cancelar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
          <span>Concepto</span>
          <select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="h-8 px-2 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:border-primary"
          >
            {PRESETS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </label>

        {concepto === 'Otro concepto' ? (
          <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
            <span>Nombre del concepto</span>
            <input
              type="text"
              maxLength={80}
              value={customConcepto}
              onChange={(e) => setCustomConcepto(e.target.value)}
              placeholder="Ej: Bonificación deportiva"
              className="h-8 px-2 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:border-primary"
            />
          </label>
        ) : (
          <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
            <span>Monto del ajuste</span>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-xs text-on-surface-variant pointer-events-none">$</span>
              <input
                type="number"
                min="0.01"
                max={maxAmount || undefined}
                step="0.01"
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value)
                  setError('')
                }}
                placeholder="0.00"
                className={`${NO_SPINNER_CLASS} h-8 w-full pl-6 pr-2 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs font-semibold text-right tabular-nums text-on-surface focus:outline-none focus:border-primary`}
              />
            </div>
          </label>
        )}

        {concepto === 'Otro concepto' && (
          <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
            <span>Monto del ajuste</span>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-xs text-on-surface-variant pointer-events-none">$</span>
              <input
                type="number"
                min="0.01"
                max={maxAmount || undefined}
                step="0.01"
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value)
                  setError('')
                }}
                placeholder="0.00"
                className={`${NO_SPINNER_CLASS} h-8 w-full pl-6 pr-2 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs font-semibold text-right tabular-nums text-on-surface focus:outline-none focus:border-primary`}
              />
            </div>
          </label>
        )}

        <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface sm:col-span-2">
          <span>Motivo / justificación (opcional)</span>
          <input
            type="text"
            maxLength={140}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: Aprobado por Secretaría Deportiva"
            className="h-8 px-2 rounded border border-outline-variant/60 bg-surface-container-lowest text-xs text-on-surface focus:outline-none focus:border-primary"
          />
        </label>
      </div>

      {error && <p className="text-xs text-error font-medium">{error}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded text-xs text-on-surface-variant hover:bg-surface-container-low cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-3 py-1 rounded bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 cursor-pointer shadow-xs"
        >
          + Agregar a la cuota
        </button>
      </div>
    </form>
  )
}

function DesgloseComprobante({
  detalle,
  editable = false,
  cuotaAdjustments = {},
  onToggleItem,
  onAddCustomItem,
  onRemoveAddedItem,
  onChangeNcDetail,
  onOpenCreditNote,
}) {
  const periodos = detalle?.periodos ?? []
  const [downloadingNcId, setDownloadingNcId] = useState(null)
  const [addingCuotaId, setAddingCuotaId] = useState(null)

  const handleDownloadNc = async (movimientoId) => {
    if (!movimientoId) return
    setDownloadingNcId(movimientoId)
    try {
      await descargarMovimientoPdf(movimientoId)
    } finally {
      setDownloadingNcId(null)
    }
  }

  return (
    <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-semibold text-on-surface">
          {editable ? 'Períodos abonados (desglose de ítems)' : 'Períodos abonados'}
        </h3>
        {editable && (
          <span className="text-xs font-medium text-primary">
            Quitá los conceptos que desees bonificar para emitir la Nota de Crédito (NC-X)
          </span>
        )}
      </div>
      <div className="divide-y divide-outline-variant/20">
        {periodos.length === 0 && <p className="px-3 py-2 text-sm text-on-surface-variant">Sin períodos imputados.</p>}
        {periodos.map((periodo) => {
          const appliedAmount = Number(periodo.monto_aplicado ?? 0)
          const existingNcs = periodo.notas_credito?.length
            ? periodo.notas_credito
            : (periodo.nota_credito ? [periodo.nota_credito] : [])
          const existingNcTotal = Number(
            periodo.monto_nota_credito ?? existingNcs.reduce((sum, nc) => sum + Number(nc.monto || 0), 0),
          )
          const availableToAdjust = Math.max(0, Math.round((appliedAmount - existingNcTotal) * 100) / 100)
          const canAdjustPeriodo = availableToAdjust > 0
          const adjustment = cuotaAdjustments[periodo.cuota_id] ?? {
            removedConcepts: [],
            addedItems: [],
            ncDetail: '',
          }
          const removedSet = new Set(adjustment.removedConcepts ?? [])
          const removedItems = (periodo.detalle ?? []).filter(
            (item) => Number(item.monto) > 0 && removedSet.has(item.concepto),
          )
          const removedSum = removedItems.reduce((sum, item) => sum + Number(item.monto || 0), 0)
          const addedItems = adjustment.addedItems ?? []
          const addedSum = addedItems.reduce((sum, item) => sum + Number(item.monto || 0), 0)
          const totalAdjustment = removedSum + addedSum
          const ncAmount = canAdjustPeriodo && totalAdjustment > 0
            ? Math.min(availableToAdjust, Math.round(totalAdjustment * 100) / 100)
            : 0
          const resultingNetValue = Math.max(0, Math.round((availableToAdjust - ncAmount) * 100) / 100)
          const totalCount = removedItems.length + addedItems.length

          return (
            <div key={periodo.cuota_id} className="p-3 flex flex-col gap-2.5">
              <div className="flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <strong className="text-on-surface text-sm">{renderPeriodoLabel(periodo.periodo)}</strong>
                  {existingNcs.map((nc) => (
                    <span
                      key={nc.movimiento_cuenta_id}
                      className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
                    >
                      NC-X #{nc.numero_comprobante} emitida (−{formatAmount(nc.monto)})
                    </span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm tabular-nums">
                  {existingNcTotal > 0 ? (
                    <>
                      <span className="line-through text-on-surface-variant text-xs">{formatAmount(appliedAmount)}</span>
                      <span className="font-bold text-on-surface">{formatAmount(availableToAdjust)}</span>
                    </>
                  ) : (
                    <span className="font-semibold text-on-surface">{formatAmount(appliedAmount)}</span>
                  )}
                </div>
              </div>

              {periodo.detalle && periodo.detalle.length > 0 && (
                <ul className="flex flex-col gap-1.5 pl-1">
                  {periodo.detalle.map((linea) => {
                    const isPositiveItem = Number(linea.monto) > 0
                    const isRemoved = editable && canAdjustPeriodo && removedSet.has(linea.concepto)
                    return (
                      <li
                        key={linea.concepto}
                        className={`flex items-center justify-between gap-2 text-sm rounded px-2 py-1 ${
                          isRemoved ? 'bg-amber-50/80 border border-amber-200/70' : ''
                        }`}
                      >
                        <span
                          className={`flex items-center gap-1.5 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full ${
                            isRemoved
                              ? 'line-through text-on-surface-variant before:bg-amber-500'
                              : 'text-on-surface-variant before:bg-outline-variant/60'
                          }`}
                        >
                          {linea.concepto_nombre}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`tabular-nums ${
                              isRemoved
                                ? 'line-through text-amber-800 font-medium'
                                : Number(linea.monto) < 0
                                  ? 'text-emerald-700 font-medium'
                                  : 'text-on-surface-variant'
                            }`}
                          >
                            {formatAmount(linea.monto)}
                          </span>
                          {editable && canAdjustPeriodo && isPositiveItem && onToggleItem && (
                            <button
                              type="button"
                              onClick={() => onToggleItem(periodo, linea)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                                isRemoved
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200/70'
                                  : 'bg-surface-container-lowest text-primary border-primary/30 hover:bg-primary/5'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
                                {isRemoved ? 'undo' : 'remove_circle_outline'}
                              </span>
                              {isRemoved ? 'Restaurar ítem' : 'Quitar ítem'}
                            </button>
                          )}
                        </div>
                      </li>
                    )
                  })}

                  {addedItems.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-sm rounded px-2 py-1 bg-amber-50/90 border border-amber-200"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden="true" />
                        <span className="font-semibold text-amber-950 truncate">{item.concepto_nombre}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900 shrink-0">
                          Agregado
                        </span>
                        {item.motivo && (
                          <span className="text-xs text-amber-800/80 truncate">({item.motivo})</span>
                        )}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="tabular-nums font-bold text-amber-900">
                          − {formatAmount(item.monto)}
                        </span>
                        {editable && onRemoveAddedItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveAddedItem(periodo, item.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border bg-surface-container-lowest text-primary border-primary/30 hover:bg-primary/5 transition-colors cursor-pointer"
                            title="Quitar este ítem"
                          >
                            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">remove_circle_outline</span>
                            Quitar ítem
                          </button>
                        )}
                      </div>
                    </li>
                  ))}

                  {editable && canAdjustPeriodo && onAddCustomItem && (
                    <li className="pt-1.5 border-t border-outline-variant/20 flex flex-col gap-2">
                      {addingCuotaId === periodo.cuota_id ? (
                        <AddItemInlineForm
                          maxAmount={Math.max(0, Math.round((availableToAdjust - (removedSum + addedSum)) * 100) / 100)}
                          onAdd={(newItem) => {
                            onAddCustomItem(periodo, newItem)
                            setAddingCuotaId(null)
                          }}
                          onCancel={() => setAddingCuotaId(null)}
                        />
                      ) : (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-on-surface-variant/75 text-[11px] italic">
                            ¿Deseas agregar un concepto o ajuste a la cuota?
                          </span>
                          <button
                            type="button"
                            onClick={() => setAddingCuotaId(periodo.cuota_id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-primary border border-primary/30 bg-surface-container-lowest hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
                          >
                            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">add_circle_outline</span>
                            Agregar ítem
                          </button>
                        </div>
                      )}
                    </li>
                  )}
                </ul>
              )}

              {existingNcs.length > 0 && (
                <div className="flex flex-col gap-1.5 pt-1">
                  {existingNcs.map((nc) => (
                    <div
                      key={nc.movimiento_cuenta_id}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-amber-50/80 border border-amber-200/80 text-xs text-amber-900"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="material-symbols-outlined text-[16px] text-amber-800 shrink-0" aria-hidden="true">
                          assignment_return
                        </span>
                        <span className="font-semibold truncate">NC-X #{nc.numero_comprobante}</span>
                        <span className="tabular-nums font-bold text-amber-950 shrink-0">
                          −{formatAmount(nc.monto)}
                        </span>
                        {nc.concepto && (
                          <span className="text-[11px] text-amber-800/80 truncate hidden sm:inline" title={nc.concepto}>
                            · {nc.concepto}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onOpenCreditNote && (
                          <button
                            type="button"
                            onClick={() => onOpenCreditNote(nc)}
                            title="Ver detalle de la Nota de Crédito"
                            aria-label={`Ver detalle NC-X #${nc.numero_comprobante}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 font-semibold text-[11px] cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]" aria-hidden="true">visibility</span>
                            Ver nota
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadNc(nc.movimiento_cuenta_id)}
                          disabled={downloadingNcId === nc.movimiento_cuenta_id}
                          title="Descargar PDF de la Nota de Crédito"
                          aria-label={`Descargar PDF NC-X #${nc.numero_comprobante}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-amber-900 border border-amber-300 hover:bg-amber-100 font-semibold text-[11px] cursor-pointer disabled:opacity-50"
                        >
                          <span className={`material-symbols-outlined text-[14px] ${downloadingNcId === nc.movimiento_cuenta_id ? 'animate-spin' : ''}`} aria-hidden="true">
                            {downloadingNcId === nc.movimiento_cuenta_id ? 'progress_activity' : 'download'}
                          </span>
                          PDF
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {editable && canAdjustPeriodo && (
                <div className="mt-1 p-3 rounded-lg bg-surface-container-low border border-outline-variant/40 flex flex-col gap-2.5">
                  {ncAmount > 0 ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
                        <div className="flex flex-col justify-center p-2.5 rounded-md bg-amber-50/70 border border-amber-200 text-xs">
                          <span className="text-amber-800 font-medium">Nota de Crédito (NC-X) a emitir</span>
                          <strong className="text-base text-amber-900 tabular-nums font-bold">
                            {formatAmount(ncAmount)}
                          </strong>
                          <span className="text-[11px] text-amber-700/90 mt-0.5">
                            {totalCount === 1 ? '1 ítem ajustado' : `${totalCount} ítems ajustados`}
                          </span>
                        </div>
                        <div className="flex flex-col justify-center p-2.5 rounded-md bg-surface-container-lowest border border-outline-variant/30 text-xs">
                          <span className="text-on-surface-variant font-medium">Nuevo valor neto de la cuota</span>
                          <strong className="text-base text-on-surface tabular-nums font-bold">
                            {formatAmount(resultingNetValue)}
                          </strong>
                          <span className="text-[11px] text-on-surface-variant mt-0.5">
                            Original: {formatAmount(availableToAdjust)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/30">
                        <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">assignment_return</span>
                          Se emitirá una Nota de Crédito (NC-X) por {formatAmount(ncAmount)} que quedará como saldo a favor del socio.
                        </p>
                        <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                          <span>Concepto / detalle de la Nota de Crédito</span>
                          <input
                            type="text"
                            maxLength={160}
                            value={adjustment.ncDetail}
                            onChange={(event) => onChangeNcDetail?.(periodo, event.target.value)}
                            placeholder={`Modificación de ítem de cuota · Ajuste en Cuota ${periodo.periodo}`}
                            className="h-9 px-3 bg-surface-container-lowest border border-outline-variant/60 rounded-md text-xs font-normal text-on-surface focus:outline-none focus:border-primary"
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2 p-2 rounded-md bg-surface-container-lowest border border-dashed border-outline-variant/50 text-xs text-on-surface-variant">
                      <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">info</span>
                      <span>Hacé clic en <strong>Quitar ítem</strong> o <strong>Agregar ítem de ajuste</strong> para modificar el valor de la cuota. El monto de la Nota de Crédito se calculará automáticamente.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default DesgloseComprobante
