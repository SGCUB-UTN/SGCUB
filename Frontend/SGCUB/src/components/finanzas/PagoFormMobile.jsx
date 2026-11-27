import { useRef, useState } from 'react'
import { formatAmount } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'
import { claseInput } from '../socios/socioForm'
import { SelectConFlecha } from '../socios/SocioFormFields'
import ComprobantePago from './ComprobantePago'
import RemoveCuotaItemModal from './CuotaItemRemoval'
import { AmountInput, SECONDARY_BUTTON_CLASS, SUBMIT_BUTTON_CLASS, TICKET_CLASS } from './formParts'
import { CuotaAmount, CuotaBadges, CuotaBreakdown, PaymentMethodsNotice, PaymentSubmitError, PaymentSummary, SettlementStatus } from './PagoForm'
import { isFuture, isRowComplete, visibleCuotaLines } from './pagoFormMath'
import usePagoForm from '../../hooks/usePagoForm'
import { BenefitButton } from '../personas/HeaderPersona'

const STEPS = [
  { key: 'deuda', title: 'Deuda a saldar' },
  { key: 'cobro', title: 'Medios de pago' },
  { key: 'confirmar', title: 'Revisar y confirmar' },
]

const REMOVE_BUTTON_CLASS = 'inline-flex items-center gap-1 min-h-10 px-2 rounded-md text-base font-semibold text-error hover:bg-error-container/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60'

const BAR_CLASS = '-mx-5 -mb-5 mt-4 shrink-0 flex flex-col gap-3 border-t border-outline-variant/40 bg-surface-container-lowest px-5 py-3 shadow-[0_-6px_16px_rgba(15,23,42,0.08)]'

function StepHeader({ step }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-bold text-on-surface">{STEPS[step].title}</h3>
        <span className="shrink-0 text-sm text-on-surface-variant tabular-nums">Paso {step + 1} de {STEPS.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
        {STEPS.map((current, index) => (
          <span key={current.key} className={`h-1 rounded-full ${index <= step ? 'bg-primary' : 'bg-outline-variant/40'}`} />
        ))}
      </div>
    </div>
  )
}

function CuotaCard({ line, upcoming, expanded, onToggle, onRemoveItem, onAssignBenefit }) {
  const { cuota } = line
  const detailId = `cuota-${cuota.cuota_id}-detalle`
  return (
    <li className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
        className={`w-full flex items-start gap-3 p-3 text-left rounded-lg cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${expanded ? 'bg-primary/5' : ''}`}
      >
        <span className="min-w-0 flex-1 flex flex-col gap-1">
          <span className="font-medium text-base text-on-surface">{formatPeriod(cuota.periodo)}</span>
          <span className="flex flex-wrap items-center gap-1.5"><CuotaBadges cuota={cuota} upcoming={upcoming} /></span>
        </span>
        <span className="shrink-0 text-right">
          <CuotaAmount line={line} />
        </span>
        <span className={`material-symbols-outlined shrink-0 text-[20px] text-outline transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
      </button>
      {expanded && (
        <div id={detailId} className="px-3 pb-3 flex flex-col gap-2">
          <CuotaBreakdown line={line} onRemoveItem={onRemoveItem} />
          {onAssignBenefit && (
            <button type="button" onClick={() => onAssignBenefit(cuota.cuota_id)} className={`${TEXT_BUTTON_CLASS} self-start min-h-10 text-base`}>
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">sell</span>
              Agregar descuento
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function DebtStep({ form, onAssignBenefit, onRemoveItem }) {
  const { lines, period, expandedIds, toggleExpand, debtTotal, pendingCuotas } = form
  if (pendingCuotas.length === 0) {
    return <p className="text-base text-on-surface-variant text-center py-6 border border-dashed border-outline-variant/40 rounded-lg">El socio no tiene cuotas pendientes.</p>
  }
  const { dueLines, visibleFuture } = visibleCuotaLines(lines, period)
  return (
    <div className="flex flex-col gap-3">
      {onAssignBenefit && (
        <div>
          <BenefitButton onClick={() => onAssignBenefit()} />
        </div>
      )}
      {dueLines.length === 0 && <p className="text-base text-on-surface-variant">No hay cuotas vencidas ni del mes actual.</p>}
      <ul className="flex flex-col gap-2">
        {[...dueLines, ...visibleFuture].map((line) => (
          <CuotaCard
            key={line.cuota.cuota_id}
            line={line}
            upcoming={isFuture(line.cuota, period)}
            expanded={expandedIds.includes(line.cuota.cuota_id)}
            onToggle={() => toggleExpand(line.cuota.cuota_id)}
            onRemoveItem={onRemoveItem}
            onAssignBenefit={onAssignBenefit}
          />
        ))}
      </ul>
      <div className="flex items-center justify-between gap-3 px-3 pt-1 text-base">
        <span className="font-semibold text-on-surface-variant">Deuda a hoy</span>
        <span className="font-bold tabular-nums text-on-surface">{formatAmount(debtTotal)}</span>
      </div>
    </div>
  )
}

function MethodsStep({ form }) {
  const {
    paymentRows, allRows, paymentMethods, updateRow, removeRow, addRow, canAddRow, showErrors, formErrors,
    methodsError, methodsLoading, retryMethods, settledLines, partialLines,
  } = form
  return (
    <div className="flex flex-col gap-4">
      <PaymentMethodsNotice
        error={methodsError}
        empty={!methodsLoading && !methodsError && paymentMethods.length === 0}
        onRetry={retryMethods}
      />
      {paymentRows.map((row, index) => {
        const taken = paymentRows.filter((other) => other !== row).map((other) => other.medio).filter(Boolean)
        const number = paymentRows.length > 1 ? ` ${index + 1}` : ''
        return (
          <fieldset key={index} className="flex flex-col gap-2 p-3 rounded-lg border border-outline-variant/40">
            <legend className="sr-only">Medio de pago{number}</legend>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={`mobile-method-${index}`} className="text-base font-semibold text-on-surface">
                Medio de pago{number} <span className="text-error font-bold">*</span>
              </label>
              {allRows.length > 1 && (
                <button type="button" onClick={() => removeRow(index)} className={REMOVE_BUTTON_CLASS}>
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
                  Quitar
                </button>
              )}
            </div>
            <SelectConFlecha
              id={`mobile-method-${index}`}
              value={row.medio}
              onChange={(event) => updateRow(index, { medio: event.target.value })}
              conError={showErrors && !row.medio}
            >
              <option value="">Seleccioná un medio</option>
              {paymentMethods.map((method) => (
                <option key={method.value} value={method.value} disabled={taken.includes(method.value)}>{method.label}</option>
              ))}
            </SelectConFlecha>
            <label htmlFor={`mobile-amount-${index}`} className="text-base font-semibold text-on-surface">
              Monto <span className="text-error font-bold">*</span>
            </label>
            <AmountInput
              id={`mobile-amount-${index}`}
              className="w-full"
              value={row.monto}
              onChange={(monto) => updateRow(index, { monto, edited: true })}
              invalid={showErrors && !(Number(row.monto) > 0)}
            />
          </fieldset>
        )
      })}
      {canAddRow && (
        <button type="button" onClick={addRow} className={`${TEXT_BUTTON_CLASS} self-start min-h-10 text-base`}>
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">add</span>
          Agregar otro medio de pago
        </button>
      )}
      {showErrors && formErrors.medios && <p className="text-sm text-error font-medium" role="alert">{formErrors.medios}</p>}
      {formErrors.montos && <p className="text-sm text-error font-medium" role="alert">{formErrors.montos}</p>}
      <div className="pt-3 border-t border-outline-variant/30">
        <SettlementStatus settledLines={settledLines} partialLines={partialLines} />
      </div>
    </div>
  )
}

function ConfirmStep({ form }) {
  const { enteredTotal, settledLines, partialLines, allRows, methodLabel, pendingBalance, noDebt, observacion, setObservacion, submitError } = form
  return (
    <div className="flex flex-col gap-4">
      <div className={TICKET_CLASS}>
        <PaymentSummary
          enteredTotal={enteredTotal}
          settledLines={settledLines}
          partialLines={partialLines}
          completeRows={allRows.filter(isRowComplete)}
          methodLabel={methodLabel}
          remaining={Math.max(pendingBalance, 0)}
          empty={noDebt}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="mobile-payment-notes" className="text-base font-medium text-on-surface-variant">Observaciones (opcional)</label>
        <input
          id="mobile-payment-notes"
          type="text"
          value={observacion}
          onChange={(event) => setObservacion(event.target.value)}
          maxLength={200}
          placeholder="Detalle adicional del pago"
          className={claseInput(false)}
        />
      </div>
      <PaymentSubmitError message={submitError} />
    </div>
  )
}

export default function PagoFormMobile({ socio = null, cuenta = null, initialCuotaIds, onSuccess, onAssignBenefit, onAccountChanged, onRevertStart, onReverted, onLeave }) {
  const form = usePagoForm({ socio, cuenta, initialCuotaIds, onSuccess, onRevertStart, onReverted })
  const [step, setStep] = useState(0)
  const scrollRef = useRef(null)
  const { receipt, reloadReceipt, revertPayment, removal, setRemoval, enteredTotal, noDebt, formErrors, setShowErrors, confirmPayment, confirmLabel, canSubmit } = form

  if (!socio) {
    return <p className="text-base text-on-surface-variant py-6 text-center">Buscá al socio arriba para ver su deuda y registrar el pago.</p>
  }

  if (receipt) {
    return <ComprobantePago socio={socio} {...receipt} onRetryDetalle={reloadReceipt} onRevert={revertPayment} onLeave={onLeave} />
  }

  const goTo = (next) => {
    setStep(next)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const advance = (event) => {
    event.preventDefault()
    if (step === 0) {
      goTo(1)
      return
    }
    if (step === 1) {
      setShowErrors(true)
      if (formErrors.medios || formErrors.montos || !(enteredTotal > 0)) return
      goTo(2)
      return
    }
    confirmPayment()
  }

  const isLast = step === STEPS.length - 1
  const primaryDisabled = isLast ? !canSubmit : step === 0 && noDebt

  return (
    <form onSubmit={advance} className="flex flex-col flex-1 min-h-0" noValidate>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 -mx-1 px-1">
        <StepHeader step={step} />
        {step === 0 && (
          <DebtStep
            form={form}
            onAssignBenefit={onAssignBenefit}
            onRemoveItem={onAccountChanged ? (cuota, item) => setRemoval({ cuota, item }) : undefined}
          />
        )}
        {step === 1 && <MethodsStep form={form} />}
        {step === 2 && <ConfirmStep form={form} />}
      </div>

      <div className={BAR_CLASS}>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-semibold text-on-surface-variant">A cobrar</span>
          <span className="text-xl font-bold tabular-nums text-on-surface" aria-live="polite">{formatAmount(enteredTotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          {step > 0 && (
            <button type="button" onClick={() => goTo(step - 1)} className={`${SECONDARY_BUTTON_CLASS} justify-center`}>
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">arrow_back</span>
              Atrás
            </button>
          )}
          <button type="submit" disabled={primaryDisabled} className={`${SUBMIT_BUTTON_CLASS} flex-1 justify-center`}>
            {isLast ? confirmLabel() : 'Continuar'}
          </button>
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
