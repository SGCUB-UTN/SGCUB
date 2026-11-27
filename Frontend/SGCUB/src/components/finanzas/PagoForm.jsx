import { Fragment } from 'react'
import { formatAmount } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import DataTable from '../shared/DataTable'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import ComprobantePago from './ComprobantePago'
import RemoveCuotaItemModal, { RemoveItemButton } from './CuotaItemRemoval'
import { AmountInput, AuthorizerSelect, FormPanel, OptionCard, SUBMIT_BUTTON_CLASS, SummaryLine, TICKET_CLASS } from './formParts'
import { isAdjustment, isRegistration, itemLabel, itemTone, removalBlocker } from './cuotaItems'
import { CUOTA_STATE_TONES, cuotaStateLabel, cuotaStateShortLabel, isOverdue } from './cuotaStates'
import StatusBadge from '../shared/StatusBadge'
import usePagoForm from '../../hooks/usePagoForm'
import { EXCESS_CREDIT_NOTE, EXCESS_PARTIAL, NO_CUOTAS, isFuture, isRowComplete, periodsText, roundCents, visibleCuotaLines } from './pagoFormMath'

const COLUMN_COUNT = 3

const EXCESS_OPTIONS = [
  {
    value: EXCESS_PARTIAL,
    title: 'Pago parcial de la siguiente cuota',
    description: 'Se usa todo el dinero recibido: lo que sobra queda como pago parcial de la cuota siguiente.',
    icon: 'event_repeat',
  },
  {
    value: EXCESS_CREDIT_NOTE,
    title: 'Nota de crédito por el sobrante',
    description: 'Se cobra solo lo que corresponde y el sobrante se devuelve con una nota de crédito.',
    icon: 'currency_exchange',
  },
]

function BreakdownLine({ label, detail = '', value, tone = 'text-on-surface-variant', strong = false, action = null }) {
  return (
    <div className={`flex items-center justify-between gap-3 text-base ${tone} ${strong ? 'font-bold' : ''}`}>
      <div className="flex flex-col min-w-0">
        <span>{label}</span>
        {detail && <span className="text-sm font-normal text-on-surface-variant truncate" title={detail}>{detail}</span>}
      </div>
      <div className="grid w-44 max-w-[55%] shrink-0 grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-1.5">
        <span className="text-right tabular-nums whitespace-nowrap">{value}</span>
        <span className="flex w-6 justify-start">{action}</span>
      </div>
    </div>
  )
}

export function CuotaBreakdown({
  line,
  onRemoveItem,
  onAssignBenefit,
}) {
  const { cuota, due } = line
  const items = cuota.items ?? []
  const paid = Number(cuota.monto_pagado || 0)

  return (
        <div className="flex flex-col gap-2.5 max-w-xl">
          <div className="flex flex-col gap-1.5 pt-3 border-t border-outline-variant/30">
            {items.filter((item) => !isAdjustment(item)).map((item) => {
              const blocker = onRemoveItem && isRegistration(item) ? removalBlocker(cuota, item) : null
              return (
                <BreakdownLine
                  key={item.item_cuota_id}
                  label={itemLabel(item)}
                  value={formatAmount(Number(item.monto || 0))}
                  tone="text-on-surface"
                  action={blocker === null ? null : (
                    <RemoveItemButton
                      label={`Eliminar ${itemLabel(item)}`}
                      blocker={blocker}
                      onClick={() => onRemoveItem(cuota, item)}
                    />
                  )}
                />
              )
            })}
            {items.filter(isAdjustment).map((item) => {
              const tone = itemTone(item)
              const blocker = onRemoveItem ? removalBlocker(cuota, item) : null
              return (
                <BreakdownLine
                  key={item.item_cuota_id}
                  label={itemLabel(item)}
                  detail={item.es_descuento ? item.motivo : ''}
                  value={`${tone.sign}${formatAmount(Number(item.monto || 0))}`}
                  tone={tone.className}
                  action={blocker === null ? null : (
                    <RemoveItemButton
                      label={`Eliminar ${itemLabel(item)}`}
                      blocker={blocker}
                      onClick={() => onRemoveItem(cuota, item)}
                    />
                  )}
                />
              )
            })}
            {paid > 0 && <BreakdownLine label="Pagado" value={`− ${formatAmount(paid)}`} />}
            <div className="pt-2 mt-1 mb-2 border-t border-outline-variant/30">
              <BreakdownLine
                label="Total"
                value={formatAmount(due)}
                tone="text-on-surface"
                strong
                action={onAssignBenefit && (
                  <button
                    type="button"
                    onClick={() => onAssignBenefit(cuota.cuota_id)}
                    className="min-h-10 -my-2 -mr-2 px-2 shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-md text-base font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">sell</span>
                    Agregar descuento
                  </button>
                )}
              />
            </div>
          </div>
        </div>
  )
}

function CuotaBreakdownRow(props) {
  return (
    <tr className="bg-surface-container-low/40">
      <td colSpan={COLUMN_COUNT} className="px-4 py-3 sm:pl-12">
        <CuotaBreakdown {...props} />
      </td>
    </tr>
  )
}

export function CuotaBadges({ cuota, upcoming }) {
  return (
    <>
      {isOverdue(cuota) && (
        <StatusBadge
          size="md"
          badge={{
            label: cuotaStateShortLabel(cuota.estado_cuota),
            title: cuotaStateLabel(cuota.estado_cuota),
            tono: CUOTA_STATE_TONES[cuota.estado_cuota] ?? 'neutro',
          }}
        />
      )}
      {upcoming && (
        <StatusBadge size="md" badge={{ label: 'Próxima', tono: 'neutro' }} />
      )}
    </>
  )
}

export function CuotaAmount({ line }) {
  const { due, applied } = line
  const partial = applied > 0 && applied < due
  const settled = due <= 0 || (applied > 0 && applied >= due)
  return (
    <>
      <span className="inline-flex items-center gap-1 font-semibold text-on-surface text-base">
        {settled && <span className="material-symbols-outlined text-[16px] text-emerald-600" aria-hidden="true">check_circle</span>}
        {formatAmount(due)}
      </span>
      {settled && (
        <span className="block text-sm text-emerald-700">
          {due <= 0 ? 'Se cubre con descuento' : 'Se pagará completa'}
        </span>
      )}
      {partial && (
        <span className="block text-sm text-amber-700">
          Pago parcial: {formatAmount(applied)} · faltarán {formatAmount(roundCents(due - applied))}
        </span>
      )}
    </>
  )
}

export function PaymentSubmitError({ message }) {
  if (!message) return null
  return (
    <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
      <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
      <div>
        <p className="text-base font-bold">No se pudo registrar el pago</p>
        <p className="text-sm text-on-error-container/80 mt-0.5 break-words">{message}</p>
      </div>
    </div>
  )
}

function CuotasTable({
  lines,
  debtTotal,
  period,
  expandedIds,
  onToggleExpand,
  onRemoveItem,
  onAssignBenefit,
}) {
  const handleKeyDown = (event, cuotaId) => {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggleExpand(cuotaId)
    }
  }

  const { dueLines, visibleFuture } = visibleCuotaLines(lines, period)
  const renderLine = (line) => (
    <CuotaLine
      key={line.cuota.cuota_id}
      line={line}
      upcoming={isFuture(line.cuota, period)}
      expandedIds={expandedIds}
      onToggleExpand={onToggleExpand}
      onRemoveItem={onRemoveItem}
      onAssignBenefit={onAssignBenefit}
      onKeyDown={handleKeyDown}
    />
  )

  return (
    <DataTable
      tableClassName="min-w-[560px]"
      headers={(
        <>
          <th className="py-1.5 pl-3 pr-0 w-8" scope="col"><span className="sr-only">Desglose</span></th>
          <th className="py-1.5 px-3" scope="col">Período</th>
          <th className="py-1.5 px-3 text-right" scope="col">Total</th>
        </>
      )}
      footer={(
        <>
          <td className="py-2 pl-3 pr-0" />
          <th className="py-2 px-3 text-base font-semibold text-on-surface-variant" scope="row">Deuda a hoy</th>
          <td className="py-2 px-3 text-right text-base font-bold text-on-surface">{formatAmount(debtTotal)}</td>
        </>
      )}
    >
      {dueLines.length === 0 && (
        <tr>
          <td colSpan={COLUMN_COUNT} className="py-3 px-4 text-center text-base text-on-surface-variant">
            No hay cuotas vencidas ni del mes actual.
          </td>
        </tr>
      )}
      {dueLines.map(renderLine)}
      {visibleFuture.map(renderLine)}
    </DataTable>
  )
}

function CuotaLine({
  line,
  upcoming = false,
  expandedIds,
  onToggleExpand,
  onRemoveItem,
  onAssignBenefit,
  onKeyDown,
}) {
  const { cuota } = line
  const cuotaId = cuota.cuota_id
  const expanded = expandedIds.includes(cuotaId)
  return (
    <Fragment>
      <tr
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggleExpand(cuotaId)}
        onKeyDown={(event) => onKeyDown(event, cuotaId)}
        className={`cursor-pointer transition-colors ${expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
      >
        <td className="py-1.5 pl-3 pr-0 text-outline">
          <span className={`material-symbols-outlined text-[20px] align-middle transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
        </td>
        <td className="py-1.5 px-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-on-surface text-base">{formatPeriod(cuota.periodo)}</span>
            <CuotaBadges cuota={cuota} upcoming={upcoming} />
          </div>
        </td>
        <td className="py-1.5 px-3 text-right">
          <CuotaAmount line={line} />
        </td>
      </tr>
      {expanded && (
        <CuotaBreakdownRow
          line={line}
          onRemoveItem={onRemoveItem}
          onAssignBenefit={onAssignBenefit}
        />
      )}
    </Fragment>
  )
}

export function SettlementStatus({ settledLines, partialLines }) {
  if (settledLines.length === 0 && partialLines.length === 0) {
    return <p className="text-base text-on-surface-variant">Ingresá el monto para ver qué cuotas se saldan.</p>
  }
  return (
    <ul className="flex flex-col gap-1.5 text-base">
      {settledLines.length > 0 && (
        <li className="flex items-start gap-2 text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-emerald-700 shrink-0" aria-hidden="true">check_circle</span>
          <span>Salda {periodsText(settledLines.map((line) => line.cuota.periodo))}.</span>
        </li>
      )}
      {partialLines.map((line) => (
        <li key={line.cuota.cuota_id} className="flex items-start gap-2 text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-amber-700 shrink-0" aria-hidden="true">timelapse</span>
          <span>
            {periodsText([line.cuota.periodo]).replace(/^./, (letter) => letter.toUpperCase())} queda con pago parcial: faltan{' '}
            <span className="font-semibold tabular-nums">{formatAmount(roundCents(line.due - line.applied))}</span>.
          </span>
        </li>
      ))}
    </ul>
  )
}

function RemainingValue({ remaining, empty }) {
  if (empty) return <span className="text-lg font-bold tabular-nums text-on-surface-variant">{formatAmount(0)}</span>
  if (remaining > 0) return <span className="text-lg font-bold tabular-nums text-amber-700">{formatAmount(remaining)}</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-lg font-bold text-emerald-700">
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">check_circle</span>
      Al día
    </span>
  )
}

export function PaymentSummary({ enteredTotal, settledLines, partialLines, completeRows, methodLabel, remaining, empty }) {
  return (
    <div className="flex flex-col gap-5">
      <h3 id="payment-summary-title" className="text-lg font-bold text-on-surface">Resumen del cobro</h3>

      <div className="flex flex-col gap-1">
        <span className="text-base font-semibold text-on-surface-variant">A cobrar</span>
        <span className="text-[2rem] leading-tight font-bold tabular-nums text-on-surface" aria-live="polite">{formatAmount(enteredTotal)}</span>
      </div>

      {empty
        ? <p className="text-base text-on-surface-variant">Elegí un socio con deuda para armar el cobro.</p>
        : <SettlementStatus settledLines={settledLines} partialLines={partialLines} />}

      <div className="flex flex-col gap-1.5 pt-4 border-t border-dashed border-outline-variant">
        {completeRows.map((row) => (
          <SummaryLine key={row.medio} label={methodLabel(row.medio)} value={formatAmount(Number(row.monto))} />
        ))}
        {completeRows.length === 0 && (
          <p className="text-base text-on-surface-variant">{empty ? 'Sin medios de pago.' : 'Falta elegir el medio de pago.'}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 pt-4 border-t border-dashed border-outline-variant">
        <span className="text-base font-bold text-on-surface">Queda por pagar</span>
        <RemainingValue remaining={remaining} empty={empty} />
      </div>
    </div>
  )
}

export function PaymentMethodsNotice({ error, empty, onRetry }) {
  if (!error && !empty) return null
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-error/30 bg-error-container text-on-error-container" role="alert">
      <p className="flex items-start gap-2 text-base">
        <span className="material-symbols-outlined text-[20px] text-error shrink-0" aria-hidden="true">error</span>
        {error
          ? 'No se pudieron cargar los medios de pago.'
          : 'No hay medios de pago habilitados. Se activan en Ajustes › Configuración › Finanzas y facturación.'}
      </p>
      {error && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-error/40 text-base font-semibold text-error hover:bg-error/10 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">refresh</span>
          Reintentar
        </button>
      )}
    </div>
  )
}

const ROW_ICON_BUTTON_CLASS = 'w-11 h-11 shrink-0 rounded-lg flex items-center justify-center transition-colors cursor-pointer'

export function PaymentRow({ row, index, paymentMethods, takenMethods, canRemove, showActionSlot, showErrors, onChange, onRemove, onAdd = null, lockedTitle = '' }) {
  const locked = Boolean(lockedTitle)
  const methodError = showErrors && !row.medio
  const amountError = showErrors && !(Number(row.monto) > 0)

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <SelectConFlecha
          value={row.medio}
          onChange={(event) => onChange({ medio: event.target.value })}
          aria-label={`Medio de pago ${index + 1}`}
          conError={methodError}
          disabled={locked}
        >
          <option value="">Seleccioná un medio</option>
          {paymentMethods.map((method) => (
            <option key={method.value} value={method.value} disabled={takenMethods.includes(method.value)}>
              {method.label}
            </option>
          ))}
        </SelectConFlecha>
      </div>

      <AmountInput
        className="w-36 sm:w-48 shrink-0"
        value={row.monto}
        onChange={(monto) => onChange({ monto, edited: true })}
        aria-label={`Monto del medio de pago ${index + 1}`}
        invalid={amountError}
        disabled={locked}
      />

      {showActionSlot && (
        <div className="w-11 shrink-0">
          {locked && (
            <span className={`${ROW_ICON_BUTTON_CLASS} cursor-default text-outline`} title={lockedTitle} aria-label={lockedTitle}>
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">lock</span>
            </span>
          )}
          {!locked && canRemove && (
            <button
              type="button"
              onClick={onRemove}
              title="Quitar medio de pago"
              aria-label={`Quitar medio de pago ${index + 1}`}
              className={`${ROW_ICON_BUTTON_CLASS} text-error hover:bg-error-container/60`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
            </button>
          )}
          {!locked && !canRemove && onAdd && (
            <button
              type="button"
              onClick={onAdd}
              title="Agregar medio de pago"
              aria-label="Agregar medio de pago"
              className={`${ROW_ICON_BUTTON_CLASS} text-primary border border-primary/40 hover:bg-primary-fixed/30`}
            >
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function PagoForm({ socio = null, cuenta = null, initialCuotaIds = NO_CUOTAS, reversal = null, onSuccess, onAssignBenefit, onAccountChanged, onRevertStart, onReverted, onLeave }) {
  const {
    period,
    pendingCuotas,
    expandedIds,
    toggleExpand,
    removal,
    setRemoval,
    excessMode,
    setExcessMode,
    refundMethod,
    setRefundMethod,
    refundReason,
    setRefundReason,
    refundResponsable,
    setRefundResponsable,
    observacion,
    setObservacion,
    showErrors,
    receipt,
    submitError,
    paymentMethods,
    methodLabel,
    methodsError,
    methodsLoading,
    retryMethods,
    debtTotal,
    received,
    hasExcess,
    refundsExcess,
    excess,
    reversalRows,
    paymentRows,
    allRows,
    enteredTotal,
    lines,
    settledLines,
    partialLines,
    pendingBalance,
    updateRow,
    removeRow,
    addRow,
    canAddRow,
    addsInRow,
    showActionSlot,
    formErrors,
    confirmPayment,
    reloadReceipt,
    revertPayment,
    noDebt,
    confirmLabel,
    canSubmit,
  } = usePagoForm({ socio, cuenta, initialCuotaIds, reversal, onSuccess, onRevertStart, onReverted })

  if (receipt) {
    return <ComprobantePago socio={socio} {...receipt} onRetryDetalle={reloadReceipt} onRevert={revertPayment} onLeave={onLeave} />
  }

  return (
    <form onSubmit={confirmPayment} className="flex flex-col flex-1 min-h-0" noValidate>
      <div className={`grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] lg:grid-rows-[minmax(0,1fr)] gap-6 items-stretch ${socio ? '' : 'grayscale'}`}>
        <div className="flex flex-col gap-5 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:-m-1 lg:p-1 [&>*]:shrink-0">
          <FormPanel
            id="payment-cuotas-title"
            icon="receipt_long"
            title="Cuotas a saldar"
            disabled={!socio || noDebt}
            flush={pendingCuotas.length > 0}
          >
            {pendingCuotas.length ? (
              <CuotasTable
                lines={lines}
                debtTotal={debtTotal}
                period={period}
                expandedIds={expandedIds}
                onToggleExpand={toggleExpand}
                onRemoveItem={onAccountChanged ? (cuota, item) => setRemoval({ cuota, item }) : undefined}
                onAssignBenefit={onAssignBenefit}
              />
            ) : (
              <p className="text-base text-on-surface-variant text-center py-6 border border-dashed border-outline-variant/40 rounded-lg">
                {socio ? 'El socio no tiene cuotas pendientes.' : 'Las cuotas pendientes del socio aparecerán aquí.'}
              </p>
            )}
          </FormPanel>

          {hasExcess && (
            <FormPanel
              id="payment-reversal-title"
              icon="currency_exchange"
              title={`Dinero del pago anulado ${reversal.codigo}`}
              actions={<span className="text-base font-bold tabular-nums text-on-surface">{formatAmount(received)}</span>}
              disabled={!socio || noDebt}
            >
              <p className="text-base text-on-surface-variant">
                Lo recibido supera la deuda actual ({formatAmount(debtTotal)}): elegí qué hacer con el sobrante.
              </p>
              <div role="radiogroup" aria-label="Qué hacer con el sobrante" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EXCESS_OPTIONS.map((option) => (
                  <OptionCard
                    key={option.value}
                    icon={option.icon}
                    title={option.title}
                    description={option.description}
                    selected={excessMode === option.value}
                    onSelect={() => setExcessMode(option.value)}
                  />
                ))}
              </div>
              {refundsExcess && (
                <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 pt-3 border-t border-outline-variant/30">
                  <Campo id="payment-refund-method" label="Medio de devolución" requerido>
                    <SelectConFlecha
                      id="payment-refund-method"
                      value={refundMethod}
                      onChange={(event) => setRefundMethod(event.target.value)}
                      conError={showErrors && excess > 0 && !refundMethod}
                    >
                      <option value="">Seleccioná un medio</option>
                      {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                    </SelectConFlecha>
                  </Campo>
                  <Campo id="payment-refund-reason" label="Motivo de la nota de crédito" requerido>
                    <input
                      id="payment-refund-reason"
                      type="text"
                      value={refundReason}
                      onChange={(event) => setRefundReason(event.target.value)}
                      maxLength={200}
                      aria-invalid={(showErrors && excess > 0 && !refundReason.trim()) || undefined}
                      className={claseInput(showErrors && excess > 0 && !refundReason.trim())}
                    />
                  </Campo>
                  <Campo id="payment-refund-responsable" label="Responsable de la devolución" requerido className="sm:col-span-2">
                    <AuthorizerSelect
                      id="payment-refund-responsable"
                      value={refundResponsable}
                      onChange={setRefundResponsable}
                      invalid={showErrors && excess > 0 && !refundResponsable}
                    />
                  </Campo>
                  <p className="sm:col-span-2 text-base text-on-surface-variant">
                    Sobrante a devolver: <strong className="text-on-surface tabular-nums">{formatAmount(excess)}</strong>
                  </p>
                </div>
              )}
              {showErrors && formErrors.devolucion && (
                <p className="text-sm text-error font-medium" role="alert">{formErrors.devolucion}</p>
              )}
            </FormPanel>
          )}

          <FormPanel
            id="payment-methods-title"
            icon="payments"
            title="Medios de pago"
            description={socio && noDebt ? 'El socio no tiene deuda para cobrar.' : ''}
            disabled={!socio || noDebt}
          >
            <PaymentMethodsNotice
              error={methodsError}
              empty={!methodsLoading && !methodsError && paymentMethods.length === 0}
              onRetry={retryMethods}
            />
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-base font-semibold text-on-surface">
                <span className="flex-1" aria-hidden="true">Medio de pago <span className="text-error font-bold">*</span></span>
                <span className="w-36 sm:w-48 shrink-0" aria-hidden="true">Monto <span className="text-error font-bold">*</span></span>
                {showActionSlot && (
                  <div className="w-11 shrink-0 flex justify-center">
                    {canAddRow && !addsInRow && (
                      <button
                        type="button"
                        onClick={addRow}
                        title="Agregar medio de pago"
                        aria-label="Agregar medio de pago"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-primary border border-primary/40 hover:bg-primary-fixed/30 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              {reversalRows.map((row, index) => (
                <PaymentRow
                  key={`reversal-${row.medio}`}
                  row={row}
                  index={index}
                  paymentMethods={paymentMethods}
                  takenMethods={[]}
                  showActionSlot={showActionSlot}
                  lockedTitle={`Dinero del pago anulado ${reversal.codigo}`}
                />
              ))}
              {paymentRows.map((row, index) => (
                <PaymentRow
                  key={index}
                  row={row}
                  index={reversalRows.length + index}
                  paymentMethods={paymentMethods}
                  takenMethods={allRows.filter((other) => other !== row).map((other) => other.medio).filter(Boolean)}
                  canRemove={allRows.length > 1}
                  showActionSlot={showActionSlot}
                  showErrors={showErrors}
                  onChange={(changes) => updateRow(index, changes)}
                  onRemove={() => removeRow(index)}
                  onAdd={canAddRow && addsInRow ? addRow : null}
                />
              ))}
            </div>
            {showErrors && formErrors.medios && <p className="text-sm text-error font-medium" role="alert">{formErrors.medios}</p>}
            {formErrors.montos && <p className="text-sm text-error font-medium" role="alert">{formErrors.montos}</p>}
          </FormPanel>

          <FormPanel id="payment-notes-title" icon="notes" title="Observaciones" disabled={!socio}>
            <input
              type="text"
              value={observacion}
              onChange={(event) => setObservacion(event.target.value)}
              maxLength={200}
              placeholder="Detalle adicional del pago (opcional)"
              aria-label="Observaciones"
              className={claseInput(false)}
            />
          </FormPanel>
        </div>

        <div className={`${TICKET_CLASS} lg:min-h-0 lg:overflow-y-auto transition-opacity ${socio ? '' : 'opacity-50'}`} role="region" aria-labelledby="payment-summary-title" aria-disabled={!socio || undefined}>
          <PaymentSummary
            enteredTotal={enteredTotal}
            settledLines={settledLines}
            partialLines={partialLines}
            completeRows={allRows.filter(isRowComplete)}
            methodLabel={methodLabel}
            remaining={Math.max(pendingBalance, 0)}
            empty={!socio || noDebt}
          />

          <div className="mt-auto flex flex-col gap-3">
            <PaymentSubmitError message={submitError} />
            <button
              type="submit"
              disabled={!canSubmit}
              className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}
            >
              <span>{confirmLabel()}</span>
            </button>
          </div>
        </div>
      </div>

      <RemoveCuotaItemModal
        cuota={removal?.cuota ?? null}
        item={removal?.item ?? null}
        onClose={() => setRemoval(null)}
        onRemoved={onAccountChanged}
      />
    </form>
  )
}

export default PagoForm
