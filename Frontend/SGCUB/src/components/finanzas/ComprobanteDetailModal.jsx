import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { corregirPago } from '../../api/pagos'
import { formatAmount, formatDate, formatDni, formatNumber, getErrorMessage } from '../personas/format'
import DownloadComprobanteButtom from './DownloadComprobanteButtom'
import DesgloseComprobante from './DesgloseComprobante'
import MovimientoManualDetailModal from './MovimientoManualDetailModal'
import { NO_SPINNER_CLASS, SummaryLine, TICKET_CLASS, TicketSection } from './formParts'

const METHOD_ICONS = {
  Efectivo: 'payments',
  Transferencia: 'account_balance',
  BilleteraVirtual: 'account_balance_wallet',
}

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo' },
  { value: 'Transferencia', label: 'Transferencia' },
  { value: 'BilleteraVirtual', label: 'Billetera virtual' },
]

const buildInitialMethods = (itemsPago, fallbackTotal) => {
  if (itemsPago && itemsPago.length > 0) {
    return itemsPago.map((item) => ({
      medio_de_pago: item.medio_de_pago,
      monto: String(item.monto),
    }))
  }
  return [{ medio_de_pago: 'Efectivo', monto: String(fallbackTotal ?? '') }]
}

const availableToAdjustFor = (periodo) => {
  const applied = Number(periodo?.monto_aplicado ?? 0)
  const existingNc = Number(periodo?.monto_nota_credito ?? periodo?.nota_credito?.monto ?? 0)
  return Math.max(0, Math.round((applied - existingNc) * 100) / 100)
}

const buildInitialAdjustments = (periodos) => Object.fromEntries(
  (periodos ?? []).map((periodo) => [
    periodo.cuota_id,
    {
      removedConcepts: [],
      addedItems: [],
      ncDetail: '',
    },
  ]),
)

const formatNcDetail = (periodo, removedConcepts = [], addedItems = []) => {
  const parts = []
  const removedItems = (periodo.detalle ?? []).filter(
    (item) => Number(item.monto) > 0 && removedConcepts.includes(item.concepto),
  )
  if (removedItems.length > 0) {
    parts.push(`Baja de ${removedItems.map((i) => i.concepto_nombre).join(', ')}`)
  }
  if (addedItems.length > 0) {
    parts.push(addedItems.map((i) => `${i.concepto_nombre} (${formatAmount(i.monto)})`).join(', '))
  }
  return parts.length > 0
    ? `Modificación de ítem de cuota · ${parts.join(', ')} en Cuota ${periodo.periodo}`
    : ''
}

const serializeMethods = (list) => (list ?? [])
  .map((item) => `${item.medio_de_pago}:${Number(item.monto || 0).toFixed(2)}`)
  .join('|')

const capMethodsToTarget = (methods, targetTotal) => {
  let remaining = Math.round(Number(targetTotal || 0) * 100) / 100
  const capped = []
  for (const method of methods) {
    if (remaining <= 0) break
    const amount = Math.min(Number(method.monto || 0), remaining)
    if (amount > 0 && method.medio_de_pago) {
      capped.push({
        medio_de_pago: method.medio_de_pago,
        monto: Math.round(amount * 100) / 100,
      })
      remaining = Math.max(Math.round((remaining - amount) * 100) / 100, 0)
    }
  }
  return capped
}

function ComprobanteDetailModal({
  comprobante,
  detalle,
  loading,
  error,
  opened,
  onClose,
  onAmended,
  initialEditMode = false,
}) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [isEditing, setIsEditing] = useState(false)
  const [methods, setMethods] = useState([])
  const [reason, setReason] = useState('')
  const [cuotaAdjustments, setCuotaAdjustments] = useState({})
  const [activeCreditNote, setActiveCreditNote] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState('')

  const pago = detalle?.pago_detalle
  const itemsPago = pago?.items_pago ?? []
  const socio = pago?.socio ?? comprobante?.socio ?? null
  const anulado = detalle?.estado === 'Anulado' || pago?.estado_pago === 'Anulado' || comprobante?.estado === 'Anulado'

  useEffect(() => {
    if (!opened || !comprobante) return
    setIsEditing(Boolean(initialEditMode) && !anulado)
    setMethods(buildInitialMethods(detalle?.pago_detalle?.items_pago, comprobante.monto_total))
    setReason(detalle?.pago_detalle?.observacion ?? '')
    setCuotaAdjustments(buildInitialAdjustments(detalle?.periodos))
    setSaveError('')
    setSaveSuccess('')
  }, [opened, comprobante?.comprobante_id, detalle, initialEditMode, anulado])

  const receiptTotal = Number(comprobante?.monto_total ?? 0)
  const methodsTotal = useMemo(
    () => methods.reduce((sum, item) => sum + Number(item.monto || 0), 0),
    [methods],
  )
  const surplusAmount = useMemo(
    () => (methodsTotal - receiptTotal > 0.01 ? Math.round((methodsTotal - receiptTotal) * 100) / 100 : 0),
    [methodsTotal, receiptTotal],
  )
  const cappedMethods = useMemo(
    () => capMethodsToTarget(methods, receiptTotal),
    [methods, receiptTotal],
  )
  const paymentDistributionChanged = useMemo(
    () => serializeMethods(cappedMethods) !== serializeMethods(itemsPago),
    [cappedMethods, itemsPago],
  )
  const methodsChanged = paymentDistributionChanged || surplusAmount > 0
  const reasonChanged = useMemo(
    () => reason.trim() !== '' && reason.trim() !== (pago?.observacion ?? '').trim(),
    [reason, pago?.observacion],
  )

  const ncTargets = useMemo(() => {
    const periodos = detalle?.periodos ?? []
    return periodos
      .map((periodo) => {
        const available = availableToAdjustFor(periodo)
        if (available <= 0) return null
        const adj = cuotaAdjustments[periodo.cuota_id]
        if (!adj) return null
        const removedConcepts = adj.removedConcepts ?? []
        const addedItems = adj.addedItems ?? []
        if (!removedConcepts.length && !addedItems.length) return null

        const removedItems = (periodo.detalle ?? []).filter(
          (item) => Number(item.monto) > 0 && removedConcepts.includes(item.concepto),
        )
        const removedSum = removedItems.reduce((sum, item) => sum + Number(item.monto || 0), 0)
        const addedSum = addedItems.reduce((sum, item) => sum + Number(item.monto || 0), 0)
        const totalDiscount = removedSum + addedSum
        const ncAmount = Math.min(available, Math.round(totalDiscount * 100) / 100)
        if (ncAmount <= 0) return null
        return {
          cuotaId: periodo.cuota_id,
          movimientoCuotaId: periodo.movimiento_cuota_id,
          periodo: periodo.periodo,
          appliedAmount: available,
          newCuotaValue: Math.max(0, Math.round((available - ncAmount) * 100) / 100),
          ncAmount,
          ncDetail: adj.ncDetail?.trim() || formatNcDetail(periodo, removedConcepts, addedItems),
        }
      })
      .filter(Boolean)
  }, [detalle?.periodos, cuotaAdjustments])

  const totalNcAmount = useMemo(
    () => ncTargets.reduce((sum, item) => sum + item.ncAmount, 0),
    [ncTargets],
  )

  if (!comprobante) return null

  const numeroLabel = `${detalle?.tipo ? `${detalle.tipo} - ` : ''}#${comprobante.numero}`
  const periodosCount = detalle?.periodos?.length ?? 0
  const canEdit = !loading && !error && Boolean(pago) && !anulado

  const startEditing = () => {
    setMethods(buildInitialMethods(itemsPago, comprobante.monto_total))
    setReason('')
    setCuotaAdjustments(buildInitialAdjustments(detalle?.periodos))
    setSaveError('')
    setSaveSuccess('')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setIsEditing(false)
    setSaveError('')
  }

  const updateMethod = (index, field, value) => {
    setMethods((current) => current.map((method, position) => {
      if (position !== index) return method
      if (field === 'medio_de_pago' && current.length === 1 && !method.monto) {
        return { medio_de_pago: value, monto: String(comprobante.monto_total) }
      }
      return { ...method, [field]: value }
    }))
    setSaveError('')
  }

  const addMethod = () => {
    setMethods((current) => {
      const used = current.reduce((sum, item) => sum + Number(item.monto || 0), 0)
      const remaining = Math.max(Math.round((receiptTotal - used) * 100) / 100, 0)
      const defaultMethod = PAYMENT_METHODS.find((opt) => !current.some((m) => m.medio_de_pago === opt.value))?.value || 'Transferencia'
      return [...current, { medio_de_pago: defaultMethod, monto: remaining > 0 ? String(remaining) : '' }]
    })
    setSaveError('')
  }

  const removeMethod = (index) => {
    setMethods((current) => {
      const next = current.filter((_, position) => position !== index)
      if (next.length === 1 && !next[0].monto) {
        return [{ ...next[0], monto: String(comprobante.monto_total) }]
      }
      return next
    })
    setSaveError('')
  }

  const handleToggleItem = (periodo, linea) => {
    setCuotaAdjustments((current) => {
      const prev = current[periodo.cuota_id] ?? {
        removedConcepts: [],
        addedItems: [],
        ncDetail: '',
      }
      const exists = prev.removedConcepts.includes(linea.concepto)
      const nextRemoved = exists
        ? prev.removedConcepts.filter((concept) => concept !== linea.concepto)
        : [...prev.removedConcepts, linea.concepto]
      const nextDetail = formatNcDetail(periodo, nextRemoved, prev.addedItems ?? [])
      return {
        ...current,
        [periodo.cuota_id]: {
          ...prev,
          removedConcepts: nextRemoved,
          ncDetail: nextDetail,
        },
      }
    })
    setSaveError('')
  }

  const handleAddCustomItem = (periodo, item) => {
    setCuotaAdjustments((current) => {
      const prev = current[periodo.cuota_id] ?? {
        removedConcepts: [],
        addedItems: [],
        ncDetail: '',
      }
      const nextAdded = [...(prev.addedItems ?? []), item]
      const nextDetail = formatNcDetail(periodo, prev.removedConcepts ?? [], nextAdded)
      return {
        ...current,
        [periodo.cuota_id]: {
          ...prev,
          addedItems: nextAdded,
          ncDetail: nextDetail,
        },
      }
    })
    setSaveError('')
  }

  const handleRemoveAddedItem = (periodo, itemId) => {
    setCuotaAdjustments((current) => {
      const prev = current[periodo.cuota_id] ?? {
        removedConcepts: [],
        addedItems: [],
        ncDetail: '',
      }
      const nextAdded = (prev.addedItems ?? []).filter((i) => i.id !== itemId)
      const nextDetail = formatNcDetail(periodo, prev.removedConcepts ?? [], nextAdded)
      return {
        ...current,
        [periodo.cuota_id]: {
          ...prev,
          addedItems: nextAdded,
          ncDetail: nextDetail,
        },
      }
    })
    setSaveError('')
  }

  const handleChangeNcDetail = (periodo, detailText) => {
    setCuotaAdjustments((current) => ({
      ...current,
      [periodo.cuota_id]: {
        ...(current[periodo.cuota_id] ?? { removedConcepts: [], addedItems: [] }),
        ncDetail: detailText,
      },
    }))
    setSaveError('')
  }

  const validateEdition = () => {
    if (!methods.length || methods.some((m) => !m.medio_de_pago || Number(m.monto) <= 0)) {
      return 'Completá un medio de pago y un monto válido en cada fila.'
    }
    if (methodsTotal + 0.01 < receiptTotal) {
      return `La suma de los medios de pago (${formatAmount(methodsTotal)}) no alcanza a cubrir el total del comprobante (${formatAmount(receiptTotal)}). Para reducir el valor de la cuota, quitá conceptos o agregá ítems de ajuste arriba para emitir una Nota de Crédito.`
    }
    if (!methodsChanged && !reasonChanged && ncTargets.length === 0) {
      return 'Modificá el medio o monto de pago, o quitá/agregá conceptos de la cuota para emitir una Nota de Crédito antes de guardar.'
    }
    return ''
  }

  const handleSaveEdition = async () => {
    const validationMsg = validateEdition()
    if (validationMsg) {
      setSaveError(validationMsg)
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      const shouldCorrectPayment = paymentDistributionChanged || (reasonChanged && ncTargets.length === 0 && surplusAmount === 0)
      const cuotaIds = (detalle?.periodos ?? []).map((p) => p.cuota_id)
      const correctionReason = reason.trim() || 'Edición de comprobante de pago'
      const reasonSuffix = reason.trim() ? ` (${reason.trim()})` : ''

      let excedentePayload = null
      if (surplusAmount > 0) {
        const surplusMethod = methods.filter((m) => m.medio_de_pago && Number(m.monto) > 0).at(-1)?.medio_de_pago || 'Transferencia'
        const surplusConcept = `Excedente de transferencia / Saldo a favor · Generado al editar comprobante #${comprobante.numero}${reasonSuffix}`.slice(0, 200)
        excedentePayload = {
          monto: String(surplusAmount),
          medio_de_pago: surplusMethod,
          concepto: surplusConcept,
        }
      }

      const notasCreditoPayload = ncTargets.map((target) => ({
        cuota_id: target.cuotaId,
        monto: String(target.ncAmount),
        concepto: `${target.ncDetail}${reasonSuffix}`.slice(0, 200),
      }))

      const correctionResult = await corregirPago(pago.pago_id, {
        motivo: correctionReason,
        cuota_ids: cuotaIds,
        monto_total: receiptTotal,
        medios: cappedMethods,
        actualizar_medios: shouldCorrectPayment,
        excedente: excedentePayload,
        notas_credito: notasCreditoPayload,
      })

      const replacementComprobante = shouldCorrectPayment ? (correctionResult?.comprobante ?? null) : null
      const createdSurplusMovement = correctionResult?.excedente ?? null
      const emittedCreditNotes = correctionResult?.notas_credito ?? []

      setIsEditing(false)
      const messages = []
      if (shouldCorrectPayment) {
        messages.push('se actualizó el medio de pago')
      }
      if (createdSurplusMovement) {
        const num = createdSurplusMovement.numero_comprobante ?? createdSurplusMovement.movimiento_cuenta_id
        messages.push(`se generó el Recibo X #${num} de excedente / saldo a favor por ${formatAmount(surplusAmount)}`)
      }
      if (emittedCreditNotes.length > 0) {
        const ncNums = emittedCreditNotes.map((nc) => `#${nc.numero_comprobante ?? nc.movimiento_cuenta_id}`).join(', ')
        messages.push(`se emitió la Nota de Crédito NC-X ${ncNums} por ${formatAmount(totalNcAmount)}`)
      }
      const fullMessage = messages.length > 0
        ? `${messages[0].charAt(0).toUpperCase() + messages[0].slice(1)}${messages.length > 1 ? `, ${messages.slice(1).join(' y ')}` : ''}.`
        : 'Se actualizaron los datos del pago correctamente.'
      setSaveSuccess(fullMessage)

      await onAmended?.({
        replacementComprobante,
        emittedCreditNotes,
        createdSurplusMovement,
      })
    } catch (requestError) {
      setSaveError(getErrorMessage(requestError, 'No se pudieron guardar los cambios.'))
    } finally {
      setSaving(false)
    }
  }

  const modalTitle = (
    <div className="flex items-center justify-between gap-4 min-w-0 pr-2">
      <div className="flex items-center gap-4 min-w-0">
        <span className="shrink-0 text-sm uppercase tracking-wider font-semibold text-primary">
          {isEditing ? 'Editar pago / cuota abonada' : 'Comprobante de pago'}
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
            : isEditing
              ? 'bg-primary/10 text-primary border-primary/20'
              : 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
        }`}
      >
        {anulado ? 'Anulado' : isEditing ? 'Modo edición' : (pago?.estado_pago ?? 'Vigente')}
      </span>
    </div>
  )

  return (
    <Modal
      opened={opened}
      onClose={() => !saving && onClose()}
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

          {saveSuccess && (
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-50 text-emerald-900 text-sm flex items-center gap-2" role="status">
              <span className="material-symbols-outlined text-[20px] text-emerald-700 shrink-0" aria-hidden="true">check_circle</span>
              <span>{saveSuccess}</span>
            </div>
          )}

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
              <DesgloseComprobante
                detalle={detalle}
                editable={isEditing}
                cuotaAdjustments={cuotaAdjustments}
                onToggleItem={handleToggleItem}
                onAddCustomItem={handleAddCustomItem}
                onRemoveAddedItem={handleRemoveAddedItem}
                onChangeNcDetail={handleChangeNcDetail}
                onOpenCreditNote={(nc) => setActiveCreditNote({ ...nc, socio })}
              />

              <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-on-surface">
                    {isEditing ? 'Medios de pago utilizados (editable)' : 'Medios de pago utilizados'}
                  </h3>
                  {isEditing && (
                    <button
                      type="button"
                      onClick={addMethod}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">add</span>
                      Dividir en otro medio
                    </button>
                  )}
                </div>

                {!isEditing ? (
                  itemsPago.length ? (
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
                  )
                ) : (
                  <div className="p-3 flex flex-col gap-2.5">
                    {methods.map((method, index) => (
                      <div key={index} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                        <select
                          value={method.medio_de_pago}
                          onChange={(event) => updateMethod(index, 'medio_de_pago', event.target.value)}
                          aria-label={`Medio de pago ${index + 1}`}
                          className="h-9 min-w-0 flex-1 px-3 bg-surface-container-lowest border border-outline-variant/60 rounded-md text-sm text-on-surface focus:outline-none focus:border-primary"
                        >
                          <option value="">Seleccionar medio</option>
                          {PAYMENT_METHODS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                        <div className="relative flex items-center w-40 shrink-0">
                          <span className="absolute left-3 text-sm font-semibold text-on-surface-variant pointer-events-none">$</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={method.monto}
                            onChange={(event) => updateMethod(index, 'monto', event.target.value)}
                            aria-label={`Monto del medio ${index + 1}`}
                            className={`${NO_SPINNER_CLASS} h-9 w-full pl-7 pr-3 bg-surface-container-lowest border border-outline-variant/60 rounded-md text-sm font-semibold tabular-nums text-on-surface focus:outline-none focus:border-primary`}
                          />
                        </div>
                        {methods.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeMethod(index)}
                            aria-label="Quitar medio de pago"
                            className="h-9 w-9 inline-flex items-center justify-center text-error hover:bg-error-container rounded-md cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-xs text-on-surface-variant pt-1">
                      <span>Total ingresado en medios: <strong className="text-on-surface tabular-nums">{formatAmount(methodsTotal)}</strong></span>
                      <span>Total de la cuota: <strong className="text-on-surface tabular-nums">{formatAmount(receiptTotal)}</strong></span>
                    </div>
                    {surplusAmount > 0 && (
                      <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2">
                        <span className="material-symbols-outlined text-[18px] text-emerald-700 shrink-0 mt-0.5" aria-hidden="true">
                          account_balance_wallet
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <strong className="text-emerald-800">
                            Excedente detectado: + {formatAmount(surplusAmount)} a favor del socio
                          </strong>
                          <span>
                            El monto ingresado supera lo abonado por la cuota ({formatAmount(receiptTotal)}). Al guardar, se generará automáticamente un Recibo X de saldo a favor por {formatAmount(surplusAmount)} para la próxima cuota.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

              {isEditing && (
                <section className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col gap-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface">
                    <span>Motivo de la modificación / observación (opcional)</span>
                    <input
                      type="text"
                      maxLength={300}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value)
                        setSaveError('')
                      }}
                      placeholder="Ej. Cambio de Efectivo a Transferencia / Excedente transferido / Baja de actividad"
                      className="h-9 px-3 bg-surface-container-lowest border border-outline-variant/60 rounded-md text-sm font-normal text-on-surface focus:outline-none focus:border-primary"
                    />
                  </label>
                </section>
              )}

              {saveError && (
                <div className="p-3 rounded-lg bg-error-container text-on-error-container border border-error/30 text-sm" role="alert">
                  {saveError}
                </div>
              )}

              {!isEditing && (pago?.observacion || pago?.motivo_anulacion || detalle?.reemplazado_por_numero || detalle?.reemplaza_a_numero) && (
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
                value={anulado ? 'Anulado' : isEditing ? 'Editando' : (pago?.estado_pago ?? 'Acreditado')}
                valueClassName={anulado ? 'text-error' : isEditing ? 'text-primary' : 'text-emerald-700'}
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
                value={
                  isEditing
                    ? (methods.filter((m) => m.medio_de_pago).map((m) => m.medio_de_pago).join(' + ') || '—')
                    : (itemsPago.length ? itemsPago.map((i) => i.medio_de_pago).join(' + ') : '—')
                }
                valueClassName={isEditing && methodsChanged ? 'text-primary font-bold' : undefined}
              />
              {isEditing && surplusAmount > 0 && (
                <SummaryLine
                  label="Excedente a favor"
                  value={`+ ${formatAmount(surplusAmount)}`}
                  valueClassName="text-emerald-700 font-bold"
                />
              )}
              {isEditing && totalNcAmount > 0 && (
                <>
                  <SummaryLine
                    label="Nuevo valor cuota"
                    value={formatAmount(Math.max(0, receiptTotal - totalNcAmount))}
                  />
                  <SummaryLine
                    label="NC-X (lo que queda)"
                    value={`+ ${formatAmount(totalNcAmount)}`}
                    valueClassName="text-primary font-bold"
                  />
                </>
              )}
            </TicketSection>

            <div className="flex flex-col gap-1 pt-1">
              <SummaryLine
                label={isEditing && surplusAmount > 0 ? 'Total ingresado' : 'Total abonado'}
                value={formatAmount(isEditing && surplusAmount > 0 ? methodsTotal : comprobante.monto_total)}
                isTotal
                valueClassName={anulado ? 'text-error line-through' : 'text-primary'}
              />
              <p className="text-xs text-on-surface-variant">
                {anulado
                  ? 'Este comprobante fue anulado y no impacta en la recaudación vigente.'
                  : isEditing && surplusAmount > 0
                    ? `Se imputan ${formatAmount(receiptTotal)} a la cuota y ${formatAmount(surplusAmount)} quedan como excedente a favor.`
                    : isEditing && totalNcAmount > 0
                      ? `Se emitirá una Nota de Crédito (NC-X) por ${formatAmount(totalNcAmount)} a favor del socio.`
                      : 'Importe acreditado e imputado en la cuenta corriente del socio.'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-200">
            {!isEditing ? (
              <>
                <DownloadComprobanteButtom
                  comprobanteId={comprobante.comprobante_id}
                  variant="primary"
                  fullWidth
                  label="Descargar comprobante PDF"
                />

                {canEdit && (
                  <button
                    type="button"
                    onClick={startEditing}
                    className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 border border-primary/40 bg-white rounded text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit_note</span>
                    Editar pago / cuota
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSaveEdition}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 bg-primary text-on-primary rounded text-sm font-semibold hover:bg-primary/90 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                    {saving ? 'progress_activity' : (totalNcAmount > 0 ? 'assignment_return' : surplusAmount > 0 ? 'account_balance_wallet' : 'published_with_changes')}
                  </span>
                  {saving
                    ? 'Guardando cambios...'
                    : surplusAmount > 0 && totalNcAmount > 0
                      ? 'Guardar excedente y emitir NC-X'
                      : surplusAmount > 0
                        ? `Guardar y generar excedente (${formatAmount(surplusAmount)})`
                        : totalNcAmount > 0 && paymentDistributionChanged
                          ? `Guardar y emitir NC-X (${formatAmount(totalNcAmount)})`
                          : totalNcAmount > 0
                            ? `Emitir NC-X por ${formatAmount(totalNcAmount)}`
                            : 'Guardar cambios de pago'}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 w-full h-10 px-4 border border-outline-variant/60 bg-white rounded text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50"
                >
                  Cancelar edición
                </button>
              </>
            )}
          </div>
        </aside>
      </div>

      {activeCreditNote && (
        <MovimientoManualDetailModal
          movimiento={activeCreditNote}
          opened={Boolean(activeCreditNote)}
          onClose={() => setActiveCreditNote(null)}
        />
      )}
    </Modal>
  )
}

export default ComprobanteDetailModal