import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@mantine/core'
import { getErrorMessage, formatAmount, formatDate } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import SocioPicker from './SocioPicker'
import { crearMovimientoManual, getMovimientos } from '../../api/movimientos'
import { FormSection, NO_SPINNER_CLASS, SUBMIT_BUTTON_CLASS, SummaryLine } from './formParts'

const OPERATIONS = [
  {
    value: 'IngresoManual',
    title: 'Registrar ingreso',
    description: 'Donación, indumentaria u otro concepto ajeno a la cuota.',
    icon: 'add_card',
    type: 'Abono',
    tone: 'text-emerald-700',
  },
  {
    value: 'Egreso',
    title: 'Registrar egreso',
    description: 'Salida de dinero de la caja asociada a un socio.',
    icon: 'payments',
    type: 'Cargo',
    tone: 'text-error',
  },
  {
    value: 'NotaCredito',
    title: 'Emitir nota de crédito',
    description: 'Devolución total o parcial de un ingreso ya registrado.',
    icon: 'assignment_return',
    type: 'Cargo',
    tone: 'text-primary',
  },
]

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo', icon: 'payments' },
  { value: 'Transferencia', label: 'Transferencia', icon: 'account_balance' },
  { value: 'BilleteraVirtual', label: 'Billetera virtual', icon: 'account_balance_wallet' },
]

const emptyForm = {
  socio: null,
  operation: 'IngresoManual',
  concept: '',
  amount: '',
  paymentMethod: 'Efectivo',
  reversedMovement: null,
}

const operationFor = (value) => OPERATIONS.find((operation) => operation.value === value) ?? OPERATIONS[0]

function OperationCard({ operation, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(operation.value)}
      aria-pressed={selected}
      className={`flex flex-col items-start gap-2 p-3 text-left rounded-lg border transition-colors cursor-pointer ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-low'
      }`}
    >
      <span className={`material-symbols-outlined ${selected ? 'text-primary' : operation.tone}`} aria-hidden="true">{operation.icon}</span>
      <span className="font-bold text-on-surface">{operation.title}</span>
      <span className="text-sm leading-5 text-on-surface-variant">{operation.description}</span>
    </button>
  )
}

function MovementCard({ movement, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(movement)}
      aria-pressed={selected}
      className={`w-full flex items-center justify-between gap-4 p-3 text-left rounded-lg border transition-colors cursor-pointer ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-outline-variant/40 hover:border-primary/50 hover:bg-surface-container-low'
      }`}
    >
      <span className="min-w-0">
        <span className="block font-semibold text-on-surface truncate">{movement.concepto}</span>
        <span className="block text-sm text-on-surface-variant">
          Movimiento #{movement.movimiento_cuenta_id} · {formatDate(movement.fecha)}
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-bold text-on-surface">{formatAmount(movement.monto)}</span>
        <span className="text-xs text-on-surface-variant">{selected ? 'Seleccionado' : 'Elegir'}</span>
      </span>
    </button>
  )
}

function MovimientoManualModal({ opened, onClose, onSuccess }) {
  const [form, setForm] = useState(emptyForm)
  const [movements, setMovements] = useState([])
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const operation = operationFor(form.operation)
  const isCreditNote = form.operation === 'NotaCredito'
  const amount = Number(form.amount)
  const maxCredit = Number(form.reversedMovement?.monto ?? 0)
  const amountExceedsCredit = isCreditNote && maxCredit > 0 && amount > maxCredit
  const canSubmit = Boolean(
    form.socio
      && form.concept.trim()
      && amount > 0
      && (!isCreditNote || (form.reversedMovement && !amountExceedsCredit)),
  )

  const availableMovements = useMemo(
    () => movements.filter((movement) => (
      movement.tipo_movimiento === 'Abono'
      && !movement.movimiento_revertido
      && movement.origen_manual !== 'NotaCredito'
    )),
    [movements],
  )

  useEffect(() => {
    if (!opened) return
    setForm(emptyForm)
    setMovements([])
    setError(null)
  }, [opened])

  useEffect(() => {
    if (!form.socio || !isCreditNote) {
      setMovements([])
      return
    }
    let active = true
    setLoadingMovements(true)
    setError(null)
    getMovimientos(form.socio.socio_id)
      .then((data) => active && setMovements(data))
      .catch(() => active && setError('No se pudieron cargar los ingresos disponibles para devolver.'))
      .finally(() => active && setLoadingMovements(false))
    return () => { active = false }
  }, [form.socio, isCreditNote])

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const selectOperation = (value) => {
    setForm((current) => ({
      ...current,
      operation: value,
      reversedMovement: null,
      amount: '',
    }))
    setError(null)
  }

  const selectMovement = (movement) => {
    setForm((current) => ({
      ...current,
      reversedMovement: movement,
      amount: String(movement.monto),
      concept: current.concept || `Devolución: ${movement.concepto}`,
    }))
    setError(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    try {
      await crearMovimientoManual({
        socio_id: form.socio.socio_id,
        tipo: operation.type,
        origen: form.operation,
        concepto: form.concept.trim(),
        monto: form.amount,
        medio_de_pago: isCreditNote ? null : form.paymentMethod,
        movimiento_revertido_id: isCreditNote ? form.reversedMovement.movimiento_cuenta_id : null,
      })
      onSuccess?.()
      onClose()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo registrar el movimiento.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Registrar movimiento de caja"
      centered
      size="xl"
      overlayProps={{ opacity: 0.45, blur: 2 }}
    >
      <form onSubmit={submit} className="flex flex-col gap-6">
        <p className="text-base text-on-surface-variant -mt-2">
          Registrá ingresos ajenos a las cuotas, egresos o devoluciones con trazabilidad.
        </p>

        {error && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-error-container text-on-error-container" role="alert">
            <span className="material-symbols-outlined shrink-0" aria-hidden="true">error</span>
            <p>{error}</p>
          </div>
        )}

        <FormSection icon="category" title="1. ¿Qué querés registrar?" description="Elegí el tipo de movimiento para mostrarte los campos correspondientes.">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {OPERATIONS.map((item) => (
              <OperationCard key={item.value} operation={item} selected={form.operation === item.value} onSelect={selectOperation} />
            ))}
          </div>
        </FormSection>

        <FormSection icon="person_search" title="2. Socio asociado" description="El movimiento quedará registrado en su cuenta corriente.">
          {!form.socio ? (
            <SocioPicker compact onSelect={(socio) => update('socio', socio)} description="Buscá el socio por nombre, DNI o número." />
          ) : (
            <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center gap-3 min-w-0">
                <span className="material-symbols-outlined text-primary" aria-hidden="true">person</span>
                <div className="min-w-0">
                  <p className="font-bold text-on-surface truncate">{form.socio.apellido}, {form.socio.nombre}</p>
                  <p className="text-sm text-on-surface-variant">DNI {form.socio.dni} · Socio #{form.socio.numero_socio}</p>
                </div>
              </div>
              <button type="button" onClick={() => update('socio', null)} className="shrink-0 text-sm font-semibold text-primary hover:underline cursor-pointer">Cambiar</button>
            </div>
          )}
        </FormSection>

        {isCreditNote && form.socio && (
          <FormSection icon="history" title="3. Ingreso a devolver" description="Seleccioná el ingreso original. Podés devolverlo total o parcialmente.">
            {loadingMovements && <p className="p-3 rounded-lg bg-surface-container-low text-sm text-on-surface-variant">Buscando ingresos disponibles...</p>}
            {!loadingMovements && !availableMovements.length && !error && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low text-on-surface-variant">
                <span className="material-symbols-outlined" aria-hidden="true">info</span>
                <p>Este socio no tiene ingresos manuales disponibles para devolver.</p>
              </div>
            )}
            {!loadingMovements && availableMovements.length > 0 && (
              <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                {availableMovements.map((movement) => (
                  <MovementCard
                    key={movement.movimiento_cuenta_id}
                    movement={movement}
                    selected={form.reversedMovement?.movimiento_cuenta_id === movement.movimiento_cuenta_id}
                    onSelect={selectMovement}
                  />
                ))}
              </div>
            )}
          </FormSection>
        )}

        <FormSection icon="edit_note" title={`${isCreditNote ? '4' : '3'}. Detalle del movimiento`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface md:col-span-2">
              Concepto
              <input required maxLength={200} value={form.concept} onChange={(event) => update('concept', event.target.value)} className={claseInput(false)} placeholder={isCreditNote ? 'Ej. Transferencia duplicada' : 'Ej. Donación o compra de indumentaria'} />
              <span className="font-normal text-on-surface-variant">Describí el motivo para que quede claro en la trazabilidad.</span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">
              Monto
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-outline" aria-hidden="true">$</span>
                <input required type="number" inputMode="decimal" min="0.01" max={isCreditNote && maxCredit ? maxCredit : undefined} step="0.01" value={form.amount} onChange={(event) => update('amount', event.target.value)} className={claseInput(amountExceedsCredit, `${NO_SPINNER_CLASS} pl-7 font-semibold`)} placeholder="0,00" />
              </div>
              {isCreditNote && maxCredit > 0 && <span className="font-normal text-on-surface-variant">Máximo a devolver: {formatAmount(maxCredit)}</span>}
              {amountExceedsCredit && <span className="font-normal text-error">El monto no puede superar el ingreso seleccionado.</span>}
            </label>
            {!isCreditNote && (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-semibold text-on-surface">Medio de pago</legend>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button key={method.value} type="button" onClick={() => update('paymentMethod', method.value)} aria-pressed={form.paymentMethod === method.value} className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-center transition-colors cursor-pointer ${form.paymentMethod === method.value ? 'border-primary bg-primary/5 text-primary' : 'border-outline-variant/40 text-on-surface-variant hover:border-primary/50'}`}>
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">{method.icon}</span>
                      <span className="text-xs font-semibold leading-4">{method.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </FormSection>

        {canSubmit && (
          <section className={`p-4 rounded-lg border ${isCreditNote ? 'border-primary/30 bg-primary/5' : 'border-outline-variant/40 bg-surface-container-low'}`} aria-label="Resumen del movimiento">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-on-surface-variant">Revisá antes de confirmar</h3>
            <div className="flex flex-col gap-2">
              <SummaryLine label="Operación" value={operation.title} />
              <SummaryLine label="Socio" value={`${form.socio.apellido}, ${form.socio.nombre}`} />
              <SummaryLine label="Concepto" value={form.concept.trim()} />
              {!isCreditNote && <SummaryLine label="Medio de pago" value={PAYMENT_METHODS.find((method) => method.value === form.paymentMethod)?.label} />}
              {isCreditNote && <SummaryLine label="Ingreso original" value={`#${form.reversedMovement.movimiento_cuenta_id}`} />}
              <div className="pt-2 mt-1 border-t border-outline-variant/30">
                <SummaryLine label={isCreditNote ? 'Importe a devolver' : 'Importe del movimiento'} value={formatAmount(amount)} isTotal valueClassName={isCreditNote ? 'text-primary' : operation.tone} />
              </div>
            </div>
          </section>
        )}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2 border-t border-outline-variant/20">
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-lg border border-outline-variant/40 font-semibold text-on-surface hover:bg-surface-container-low cursor-pointer">Cancelar</button>
          <button type="submit" disabled={!canSubmit || loading} className={`${SUBMIT_BUTTON_CLASS} h-11 justify-center`}>
            <span className="material-symbols-outlined text-lg" aria-hidden="true">{isCreditNote ? 'assignment_return' : 'check_circle'}</span>
            {loading ? 'Guardando...' : isCreditNote ? 'Emitir nota de crédito' : 'Registrar movimiento'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default MovimientoManualModal
