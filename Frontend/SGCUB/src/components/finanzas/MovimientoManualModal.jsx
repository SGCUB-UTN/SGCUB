import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { formatAmount, formatDate, formatDni, formatNumber, getErrorMessage } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import SocioPicker from './SocioPicker'
import { AddItemInlineForm, renderPeriodoLabel } from './DesgloseComprobante'
import { crearMovimientoManual, getMovimientos } from '../../api/movimientos'
import { getEstadoCuenta } from '../../api/estadoCuenta'
import {
  FormSection,
  NO_SPINNER_CLASS,
  SUBMIT_BUTTON_CLASS,
  SummaryLine,
  TICKET_CLASS,
  TicketSection,
} from './formParts'

const DETAIL_MAX_LENGTH = 130
const CONCEPT_MAX_LENGTH = 200

const OTHER_CONCEPTS = new Set(['Otro ingreso', 'Otro egreso', 'Otro motivo'])

const OPERATIONS = [
  {
    value: 'IngresoManual',
    title: 'Registrar ingreso',
    shortTitle: 'Ingreso manual',
    description: 'Excedente de pago, donación, indumentaria u otro ingreso ajeno a la cuota.',
    icon: 'add_card',
    type: 'Abono',
    impactLabel: 'Abono a favor',
    submitText: 'Confirmar ingreso',
    tone: 'text-emerald-700',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
    concepts: [
      'Excedente de transferencia / Saldo a favor',
      'Venta de indumentaria',
      'Donación',
      'Evento / Buffet',
      'Alquiler de instalaciones',
      'Otro ingreso',
    ],
  },
  {
    value: 'Egreso',
    title: 'Registrar egreso',
    shortTitle: 'Egreso de caja',
    description: 'Devolución de saldo, reintegro o salida de caja asociada a un socio.',
    icon: 'payments',
    type: 'Cargo',
    impactLabel: 'Cargo en cuenta',
    submitText: 'Registrar egreso',
    tone: 'text-error',
    badgeClass: 'bg-error/10 text-error border-error/20',
    concepts: [
      'Devolución de saldo / Excedente',
      'Reintegro de gastos al socio',
      'Viáticos deportivos',
      'Compra de insumos / Materiales',
      'Otro egreso',
    ],
  },
  {
    value: 'NotaCredito',
    title: 'Nota de crédito',
    shortTitle: 'Nota de crédito',
    description: 'Ajuste sobre una cuota ya emitida (ej. ítems) o devolución de pago de indumentaria u otros conceptos.',
    icon: 'assignment_return',
    type: 'Cargo',
    impactLabel: 'Ajuste / Reversión',
    submitText: 'Emitir nota de crédito',
    tone: 'text-primary',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    concepts: [
      'Modificación de ítem de cuota',
      'Devolución parcial / Diferencia de importe',
      'Devolución total de operación',
      'Transferencia o cobro duplicado',
      'Error de registración',
      'Otro motivo',
    ],
  },
]

const PAYMENT_METHODS = [
  { value: 'Efectivo', label: 'Efectivo', icon: 'payments' },
  { value: 'Transferencia', label: 'Transferencia', icon: 'account_balance' },
  { value: 'BilleteraVirtual', label: 'Billetera virtual', icon: 'account_balance_wallet' },
]

const movementReceiptNumber = (movement) => movement?.numero_comprobante ?? movement?.movimiento_cuenta_id

const isSurplusMovement = (movement) => (
  movement?.es_excedente ?? (movement?.concepto || '').startsWith('Excedente de transferencia / Saldo a favor')
)

const movementReversibleAmount = (movement, allMovements = []) => {
  if (movement?.saldo_reversible != null) return Number(movement.saldo_reversible)
  const original = Number(movement?.monto ?? 0)
  const reversedSum = allMovements
    .filter((item) => item.movimiento_revertido === movement?.movimiento_cuenta_id)
    .reduce((sum, item) => sum + Number(item.monto || 0), 0)
  return Math.max(0, Math.round((original - reversedSum) * 100) / 100)
}

const buildEmptyForm = (socio = null, reversedMovement = null) => {
  const surplusOrigin = isSurplusMovement(reversedMovement)
  const suggestedAmount = reversedMovement
    ? String(reversedMovement.saldo_reversible ?? reversedMovement.monto)
    : ''
  return {
    socio: reversedMovement?.socio ?? socio,
    operation: reversedMovement ? (surplusOrigin ? 'Egreso' : 'NotaCredito') : 'IngresoManual',
    conceptType: reversedMovement
      ? (surplusOrigin ? 'Devolución de saldo / Excedente' : 'Devolución total de operación')
      : '',
    detail: reversedMovement
      ? `Ref. Recibo X #${movementReceiptNumber(reversedMovement)} (${reversedMovement.concepto})`.slice(0, DETAIL_MAX_LENGTH)
      : '',
    amount: suggestedAmount,
    paymentMethod: reversedMovement?.medio_de_pago || 'Efectivo',
    reversedMovement,
  }
}

const operationFor = (value) => OPERATIONS.find((operation) => operation.value === value) ?? OPERATIONS[0]

const methodLabel = (value) => PAYMENT_METHODS.find((method) => method.value === value)?.label ?? value

const composeConcept = (conceptType, detail) => {
  const cleanType = conceptType.trim()
  const cleanDetail = detail.trim()
  if (!cleanType) return cleanDetail.slice(0, CONCEPT_MAX_LENGTH)
  if (!cleanDetail) return cleanType.slice(0, CONCEPT_MAX_LENGTH)
  return `${cleanType} · ${cleanDetail}`.slice(0, CONCEPT_MAX_LENGTH)
}

function OperationCard({ operation, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(operation.value)}
      aria-pressed={selected}
      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
          : 'border-outline-variant/50 bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      <span
        className={`material-symbols-outlined text-[22px] shrink-0 mt-0.5 ${selected ? 'text-primary' : operation.tone}`}
        aria-hidden="true"
      >
        {operation.icon}
      </span>
      <span className="flex flex-col gap-1 min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-base font-semibold text-on-surface">{operation.title}</span>
          <span className={`px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide rounded-full border ${operation.badgeClass}`}>
            {operation.type}
          </span>
        </span>
        <span className="text-sm leading-snug text-on-surface-variant">{operation.description}</span>
      </span>
    </button>
  )
}

function MovementRow({ movement, selected, onSelect }) {
  const isCuota = movement.cuota != null
  const cuotaDetail = movement.cuota_detalle
  const chargeItems = (cuotaDetail?.items ?? []).filter((item) => !item.es_descuento)
  const itemsSummary = chargeItems.map((item) => `${item.concepto_nombre || item.concepto} (${formatAmount(item.monto)})`).join(' + ')
  const paymentLabel = movement.medio_de_pago_nombre || (movement.medio_de_pago ? methodLabel(movement.medio_de_pago) : null)

  return (
    <button
      type="button"
      onClick={() => onSelect(movement)}
      aria-pressed={selected}
      className={`w-full flex items-center justify-between gap-4 px-3.5 py-2.5 text-left transition-colors cursor-pointer ${
        selected ? 'bg-primary/8' : 'bg-surface-container-lowest hover:bg-surface-container-low'
      }`}
    >
      <span className="flex items-center gap-3 min-w-0">
        <span
          className={`material-symbols-outlined text-[20px] shrink-0 ${selected ? 'text-primary' : 'text-outline'}`}
          aria-hidden="true"
        >
          {selected ? 'radio_button_checked' : 'radio_button_unchecked'}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-base text-on-surface truncate">{movement.concepto}</span>
            {isCuota ? (
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                Cuota emitida {cuotaDetail?.estado_cuota === 'Paga' ? '• Paga' : '• Pendiente'}
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded bg-surface-container text-xs font-medium text-on-surface-variant">
                X #{movementReceiptNumber(movement)}
              </span>
            )}
          </span>
          <span className="block text-sm text-on-surface-variant truncate">
            {isCuota
              ? (itemsSummary || `Emitida el ${formatDate(movement.fecha)}`)
              : `${formatDate(movement.fecha)}${paymentLabel ? ` • ${paymentLabel}` : ''}`}
          </span>
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block text-base font-bold tabular-nums text-on-surface">
          {formatAmount(movement.saldo_reversible ?? movement.monto)}
        </span>
        <span className={`text-xs font-semibold ${selected ? 'text-primary' : 'text-on-surface-variant'}`}>
          {selected ? 'Seleccionado' : (isCuota ? 'Elegir cuota' : 'Elegir ingreso')}
        </span>
      </span>
    </button>
  )
}

function CuotaBreakdownCard({
  cuotaMovement,
  allMovements = [],
  selectedKeys = [],
  addedItems = [],
  onToggleItem,
  onToggleAll,
  onAddCustomItem,
  onRemoveAddedItem,
}) {
  const cuotaDetail = cuotaMovement?.cuota_detalle
  if (!cuotaMovement || !cuotaDetail) return null

  const [showAddForm, setShowAddForm] = useState(false)

  const existingNcs = allMovements.filter(
    (m) => m.movimiento_revertido === cuotaMovement.movimiento_cuenta_id,
  )
  const existingNcTotal = existingNcs.reduce((sum, m) => sum + Number(m.monto || 0), 0)
  const originalAmount = Number(cuotaMovement.monto || 0)
  const availableToAdjust = Math.max(0, Math.round((originalAmount - existingNcTotal) * 100) / 100)

  const items = cuotaDetail.items ?? []
  const positiveItems = items.filter((item) => !item.es_descuento && Number(item.monto) > 0)
  const selectedItems = positiveItems.filter((item) => selectedKeys.includes(item.item_cuota_id ?? item.concepto))
  const selectedSum = selectedItems.reduce((sum, item) => sum + Number(item.monto || 0), 0)
  const addedSum = addedItems.reduce((sum, item) => sum + Number(item.monto || 0), 0)
  const totalAdjustment = selectedSum + addedSum
  const resultingNetValue = Math.max(0, Math.round((availableToAdjust - totalAdjustment) * 100) / 100)
  const allSelected = positiveItems.length > 0 && selectedItems.length === positiveItems.length
  const totalCount = selectedItems.length + addedItems.length

  return (
    <div className="border border-outline-variant/30 rounded-lg overflow-hidden bg-surface-container-lowest shadow-xs">
      <div className="px-3.5 py-2.5 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <strong className="text-on-surface text-sm font-semibold">
            {cuotaDetail.periodo ? `Período: ${renderPeriodoLabel(cuotaDetail.periodo)}` : cuotaMovement.concepto}
          </strong>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
              cuotaDetail.estado_cuota === 'Paga'
                ? 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20'
                : 'bg-primary/10 text-primary border-primary/20'
            }`}
          >
            {cuotaDetail.estado_cuota || 'Emitida'}
          </span>
          {existingNcs.map((nc) => (
            <span
              key={nc.movimiento_cuenta_id}
              className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200"
            >
              NC-X #{nc.numero_comprobante ?? nc.movimiento_cuenta_id} emitida (−{formatAmount(nc.monto)})
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm tabular-nums">
          {existingNcTotal > 0 ? (
            <>
              <span className="line-through text-on-surface-variant text-xs">{formatAmount(originalAmount)}</span>
              <span className="font-bold text-on-surface">{formatAmount(availableToAdjust)}</span>
            </>
          ) : (
            <span className="font-semibold text-on-surface">{formatAmount(availableToAdjust)}</span>
          )}
        </div>
      </div>

      <ul className="flex flex-col p-2.5 divide-y divide-outline-variant/15">
        {items.map((linea) => {
          const key = linea.item_cuota_id ?? linea.concepto
          const isPositive = !linea.es_descuento && Number(linea.monto) > 0
          const isSelected = selectedKeys.includes(key)
          return (
            <li
              key={key}
              className={`flex items-center justify-between gap-2 text-sm rounded px-2.5 py-1.5 transition-colors ${
                isSelected ? 'bg-amber-50/80 border border-amber-200/70' : ''
              }`}
            >
              <span
                className={`flex items-center gap-2 before:content-[''] before:block before:w-1.5 before:h-1.5 before:rounded-full ${
                  isSelected
                    ? 'line-through text-on-surface-variant before:bg-amber-500'
                    : linea.es_descuento
                      ? 'text-emerald-700 before:bg-emerald-500'
                      : 'text-on-surface before:bg-outline-variant/60'
                }`}
              >
                <span className="font-medium">{linea.concepto_nombre || linea.concepto}</span>
                {linea.motivo && <span className="text-xs text-on-surface-variant">({linea.motivo})</span>}
              </span>
              <div className="flex items-center gap-2.5 shrink-0">
                <span
                  className={`tabular-nums font-semibold ${
                    isSelected
                      ? 'line-through text-amber-800'
                      : linea.es_descuento
                        ? 'text-emerald-700'
                        : 'text-on-surface'
                  }`}
                >
                  {linea.es_descuento ? `− ${formatAmount(linea.monto)}` : formatAmount(linea.monto)}
                </span>
                {isPositive && (
                  <button
                    type="button"
                    onClick={() => onToggleItem(linea)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200/70'
                        : 'bg-surface-container-lowest text-primary border-primary/30 hover:bg-primary/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
                      {isSelected ? 'undo' : 'remove_circle_outline'}
                    </span>
                    {isSelected ? 'Restaurar ítem' : 'Quitar ítem'}
                  </button>
                )}
              </div>
            </li>
          )
        })}

        {addedItems.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2 text-sm rounded px-2.5 py-1.5 bg-amber-50/90 border border-amber-200"
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
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="tabular-nums font-bold text-amber-900">
                − {formatAmount(item.monto)}
              </span>
              {onRemoveAddedItem && (
                <button
                  type="button"
                  onClick={() => onRemoveAddedItem(item.id)}
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
      </ul>

      {onAddCustomItem && (
        <div className="p-2.5 bg-surface-container-lowest border-t border-outline-variant/15">
          {showAddForm ? (
            <AddItemInlineForm
              maxAmount={Math.max(0, Math.round((availableToAdjust - totalAdjustment) * 100) / 100)}
              onAdd={(newItem) => {
                onAddCustomItem(newItem)
                setShowAddForm(false)
              }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-on-surface-variant/75 text-[11px] italic">
                ¿Deseas agregar un concepto o ajuste a la cuota?
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-primary border border-primary/30 bg-surface-container-lowest hover:bg-primary/5 transition-colors cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[15px]" aria-hidden="true">add_circle_outline</span>
                Agregar ítem
              </button>
            </div>
          )}
        </div>
      )}

      <div className="p-3 bg-surface-container-low border-t border-outline-variant/30 flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">
            Desglose de ajuste por Nota de Crédito
          </span>
          {positiveItems.length > 1 && (
            <button
              type="button"
              onClick={onToggleAll}
              className="text-xs text-primary hover:underline font-semibold cursor-pointer"
            >
              {allSelected ? 'Desmarcar todos' : 'Marcar todos los ítems'}
            </button>
          )}
        </div>

        {totalAdjustment > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            <div className="flex flex-col justify-center p-2.5 rounded-md bg-amber-50/70 border border-amber-200 text-xs">
              <span className="text-amber-800 font-medium">Nota de Crédito (NC-X) a emitir</span>
              <strong className="text-base text-amber-900 tabular-nums font-bold">
                {formatAmount(totalAdjustment)}
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
        ) : (
          <div className="flex items-center gap-2 p-2 rounded-md bg-surface-container-lowest border border-dashed border-outline-variant/50 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] text-primary" aria-hidden="true">info</span>
            <span>Hacé clic en <strong>Quitar ítem</strong> o <strong>Agregar ítem de ajuste</strong> para modificar el valor de la cuota. El monto de la Nota de Crédito se calculará automáticamente.</span>
          </div>
        )}
      </div>
    </div>
  )
}

function MovimientoManualModal({ opened, initialSocio = null, initialReversedMovement = null, onClose, onSuccess }) {
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [form, setForm] = useState(() => buildEmptyForm(initialSocio, initialReversedMovement))
  const [searchingSocio, setSearchingSocio] = useState(() => !(initialReversedMovement?.socio ?? initialSocio))
  const [selectedCuotaItemKeys, setSelectedCuotaItemKeys] = useState([])
  const [addedCuotaItems, setAddedCuotaItems] = useState([])
  const [movements, setMovements] = useState([])
  const [saldoAFavor, setSaldoAFavor] = useState(null)
  const [loadingMovements, setLoadingMovements] = useState(false)
  const [movementsError, setMovementsError] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const socio = form.socio
  const operation = operationFor(form.operation)
  const isCreditNote = form.operation === 'NotaCredito'
  const isSurplusRefund = form.operation === 'Egreso' && form.conceptType === 'Devolución de saldo / Excedente'
  const requiresOriginMovement = isCreditNote || isSurplusRefund
  const isOtherConcept = OTHER_CONCEPTS.has(form.conceptType)
  const amount = Number(form.amount)
  const hasValidAmount = Number.isFinite(amount) && amount > 0
  const rawOriginMax = form.reversedMovement ? movementReversibleAmount(form.reversedMovement, movements) : 0
  const maxCredit = isSurplusRefund && saldoAFavor !== null && rawOriginMax > 0
    ? Math.min(rawOriginMax, saldoAFavor)
    : rawOriginMax
  const amountExceedsCredit = requiresOriginMovement && maxCredit > 0 && amount > maxCredit
  const remainingAfterCredit = requiresOriginMovement && maxCredit > 0 && hasValidAmount && !amountExceedsCredit
    ? Math.max(Math.round((maxCredit - amount) * 100) / 100, 0)
    : null
  const finalConcept = composeConcept(form.conceptType, form.detail)

  const surplusMovements = useMemo(() => (
    movements
      .filter((movement) => {
        if (movementReversibleAmount(movement, movements) <= 0) return false
        const isManualSurplus = (
          movement.tipo_movimiento === 'Abono'
          && movement.origen_manual === 'IngresoManual'
          && isSurplusMovement(movement)
          && !movement.pago
          && !movement.movimiento_revertido
        )
        const isCuotaCreditNote = (
          movement.origen_manual === 'NotaCredito'
          && movement.movimiento_revertido != null
          && !movement.medio_de_pago
        )
        return isManualSurplus || isCuotaCreditNote
      })
      .sort((a, b) => b.movimiento_cuenta_id - a.movimiento_cuenta_id)
  ), [movements])

  const creditNoteMovements = useMemo(() => (
    movements
      .filter((movement) => {
        if (movement.movimiento_revertido || movementReversibleAmount(movement, movements) <= 0) return false
        const isEmittedCuota = movement.cuota != null && Number(movement.monto) > 0
        const isManualNonSurplus = (
          movement.tipo_movimiento === 'Abono'
          && movement.origen_manual === 'IngresoManual'
          && !isSurplusMovement(movement)
          && !movement.pago
        )
        return isEmittedCuota || isManualNonSurplus
      })
      .sort((a, b) => b.movimiento_cuenta_id - a.movimiento_cuenta_id)
  ), [movements])

  const hasAvailableSurplus = surplusMovements.length > 0 && (saldoAFavor === null || saldoAFavor > 0)
  const availableMovements = isSurplusRefund
    ? (hasAvailableSurplus ? surplusMovements : [])
    : creditNoteMovements

  useEffect(() => {
    if (!opened) return
    setSelectedCuotaItemKeys([])
    setAddedCuotaItems([])
    setForm(buildEmptyForm(initialSocio, initialReversedMovement))
    setSearchingSocio(!(initialReversedMovement?.socio ?? initialSocio))
    setMovements([])
    setSaldoAFavor(null)
    setMovementsError('')
    setShowErrors(false)
    setSubmitError('')
  }, [opened, initialSocio, initialReversedMovement])

  useEffect(() => {
    if (!opened || !socio) {
      setMovements([])
      setSaldoAFavor(null)
      setMovementsError('')
      return undefined
    }
    let active = true
    setLoadingMovements(true)
    setMovementsError('')
    Promise.all([
      getMovimientos(socio.socio_id),
      getEstadoCuenta(socio.socio_id).catch(() => null),
    ])
      .then(([movsData, accountData]) => {
        if (!active) return
        setMovements(Array.isArray(movsData) ? movsData : [])
        setSaldoAFavor(accountData?.saldo_a_favor != null ? Number(accountData.saldo_a_favor) : null)
      })
      .catch(() => active && setMovementsError('No se pudieron cargar los movimientos disponibles para asociar.'))
      .finally(() => active && setLoadingMovements(false))
    return () => { active = false }
  }, [opened, socio])

  const errors = {
    reversedMovement: requiresOriginMovement && !form.reversedMovement
      ? (isSurplusRefund ? 'Seleccioná el excedente original que querés devolver.' : 'Seleccioná el ingreso original que querés devolver.')
      : '',
    amount: (() => {
      if (isCreditNote && form.reversedMovement?.cuota != null) {
        if (!hasValidAmount) return 'Seleccioná o agregá al menos un ítem de la cuota para emitir la Nota de Crédito.'
        if (amountExceedsCredit) return `El monto no puede superar el disponible de la cuota (${formatAmount(maxCredit)}).`
        return ''
      }
      if (!hasValidAmount) return 'Ingresá un monto mayor a cero.'
      if (amountExceedsCredit) return `El monto no puede superar el movimiento original (${formatAmount(maxCredit)}).`
      return ''
    })(),
    paymentMethod: !isCreditNote && !form.paymentMethod ? 'Seleccioná el medio de pago.' : '',
    conceptType: !form.conceptType ? 'Seleccioná un concepto de la lista.' : '',
    detail: isOtherConcept && !form.detail.trim() ? 'Especificá el detalle para el concepto "Otro".' : '',
  }

  const isValid = Boolean(socio) && Object.values(errors).every((message) => !message)
  const fieldError = (key) => (showErrors ? errors[key] : '')

  const update = (field, value) => {
    setForm((current) => {
      const next = { ...current, [field]: value }
      if (field === 'conceptType' && current.operation === 'Egreso' && value !== 'Devolución de saldo / Excedente') {
        next.reversedMovement = null
      }
      return next
    })
    setSubmitError('')
  }

  const changeSocio = (nextSocio) => {
    setSelectedCuotaItemKeys([])
    setAddedCuotaItems([])
    setForm((current) => ({
      ...current,
      socio: nextSocio,
      reversedMovement: null,
      amount: (current.operation === 'NotaCredito' || current.conceptType === 'Devolución de saldo / Excedente') ? '' : current.amount,
    }))
    setSearchingSocio(!nextSocio)
    setShowErrors(false)
    setSubmitError('')
  }

  const selectOperation = (value) => {
    setSelectedCuotaItemKeys([])
    setAddedCuotaItems([])
    setForm((current) => ({
      ...current,
      operation: value,
      conceptType: '',
      detail: '',
      reversedMovement: null,
      amount: '',
    }))
    setShowErrors(false)
    setSubmitError('')
  }

  const updateCuotaAdjustmentForm = (keys, added, targetMovement = form.reversedMovement) => {
    if (!targetMovement) return
    const cuotaDetail = targetMovement.cuota_detalle
    const selectedItems = (cuotaDetail?.items ?? []).filter(
      (i) => !i.es_descuento && Number(i.monto) > 0 && keys.includes(i.item_cuota_id ?? i.concepto),
    )
    const sum = selectedItems.reduce((acc, i) => acc + Number(i.monto || 0), 0) + added.reduce((acc, i) => acc + Number(i.monto || 0), 0)
    const parts = []
    if (selectedItems.length > 0) {
      parts.push(`Baja de ${selectedItems.map((i) => i.concepto_nombre || i.concepto).join(', ')}`)
    }
    if (added.length > 0) {
      parts.push(added.map((i) => `${i.concepto_nombre} (${formatAmount(i.monto)})`).join(', '))
    }
    const detailText = parts.length > 0
      ? `Modificación de ítem de cuota · ${parts.join(', ')} en ${targetMovement.concepto}`.slice(0, DETAIL_MAX_LENGTH)
      : ''

    setForm((current) => ({
      ...current,
      amount: sum > 0 ? String(sum) : '',
      conceptType: 'Modificación de ítem de cuota',
      detail: detailText,
    }))
    setSubmitError('')
  }

  const selectMovement = (movement) => {
    const isCuota = movement.cuota != null
    const rawMonto = movementReversibleAmount(movement, movements)
    const suggestedAmount = (form.operation === 'Egreso' && saldoAFavor !== null && rawMonto > 0)
      ? Math.min(rawMonto, saldoAFavor)
      : rawMonto
    setSelectedCuotaItemKeys([])
    setAddedCuotaItems([])
    setForm((current) => ({
      ...current,
      reversedMovement: movement,
      amount: isCuota ? '' : String(suggestedAmount),
      paymentMethod: movement.medio_de_pago || current.paymentMethod || 'Efectivo',
      conceptType: current.operation === 'Egreso'
        ? 'Devolución de saldo / Excedente'
        : isCuota
          ? 'Modificación de ítem de cuota'
          : (current.conceptType || 'Devolución total de operación'),
      detail: isCuota
        ? ''
        : `Ref. Recibo X #${movementReceiptNumber(movement)} (${movement.concepto})`.slice(0, DETAIL_MAX_LENGTH),
    }))
    setSubmitError('')
  }

  const handleToggleCuotaItem = (item) => {
    if (!form.reversedMovement) return
    const itemKey = item.item_cuota_id ?? item.concepto
    const isSelected = selectedCuotaItemKeys.includes(itemKey)
    const nextKeys = isSelected
      ? selectedCuotaItemKeys.filter((k) => k !== itemKey)
      : [...selectedCuotaItemKeys, itemKey]
    setSelectedCuotaItemKeys(nextKeys)
    updateCuotaAdjustmentForm(nextKeys, addedCuotaItems)
  }

  const handleToggleAllCuotaItems = () => {
    if (!form.reversedMovement) return
    const cuotaDetail = form.reversedMovement.cuota_detalle
    const positiveItems = (cuotaDetail?.items ?? []).filter((i) => !i.es_descuento && Number(i.monto) > 0)
    const allKeys = positiveItems.map((i) => i.item_cuota_id ?? i.concepto)
    const allSelected = allKeys.length > 0 && allKeys.every((k) => selectedCuotaItemKeys.includes(k))
    const nextKeys = allSelected ? [] : allKeys
    setSelectedCuotaItemKeys(nextKeys)
    updateCuotaAdjustmentForm(nextKeys, addedCuotaItems)
  }

  const handleAddCustomCuotaItem = (item) => {
    const nextAdded = [...addedCuotaItems, item]
    setAddedCuotaItems(nextAdded)
    updateCuotaAdjustmentForm(selectedCuotaItemKeys, nextAdded)
  }

  const handleRemoveCustomCuotaItem = (itemId) => {
    const nextAdded = addedCuotaItems.filter((i) => i.id !== itemId)
    setAddedCuotaItems(nextAdded)
    updateCuotaAdjustmentForm(selectedCuotaItemKeys, nextAdded)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!socio) return
    setShowErrors(true)
    if (!isValid) return

    setLoading(true)
    setSubmitError('')
    try {
      await crearMovimientoManual({
        socio_id: socio.socio_id,
        tipo: operation.type,
        origen: form.operation,
        concepto: finalConcept,
        monto: form.amount,
        medio_de_pago: isCreditNote ? null : form.paymentMethod,
        movimiento_revertido_id: requiresOriginMovement ? form.reversedMovement.movimiento_cuenta_id : null,
      })
      onSuccess?.()
      onClose()
    } catch (requestError) {
      setSubmitError(getErrorMessage(requestError, 'No se pudo registrar el movimiento.'))
    } finally {
      setLoading(false)
    }
  }

  const confirmLabel = () => {
    if (loading) return 'Registrando...'
    if (isSurplusRefund && !loadingMovements && !hasAvailableSurplus) return 'Sin excedentes disponibles para devolver'
    if (isCreditNote && !loadingMovements && availableMovements.length === 0) return 'Sin ingresos disponibles para revertir'
    if (requiresOriginMovement && !form.reversedMovement) {
      return isSurplusRefund ? 'Seleccioná el excedente a devolver' : 'Seleccioná el ingreso a revertir'
    }
    if (amountExceedsCredit) return 'El monto supera el disponible del movimiento'
    if (!hasValidAmount) return 'Ingresá el monto del movimiento'
    return `${operation.submitText} • ${formatAmount(amount)}`
  }

  const modalTitle = (
    <div className="flex items-center gap-4 min-w-0">
      <span className="shrink-0 text-sm uppercase tracking-wider font-semibold text-primary">
        Movimiento de caja
      </span>
      <span className="h-6 w-px bg-outline-variant/40 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {socio && !searchingSocio ? (
          <div className="flex items-center justify-between gap-3 min-w-0">
            <p className="min-w-0 truncate text-base text-on-surface-variant">
              <span className="text-lg font-bold text-on-surface">{socio.apellido}, {socio.nombre}</span>
              {' '}(DNI {formatDni(socio.dni)} • Socio {formatNumber(socio.numero_socio)})
            </p>
            <button
              type="button"
              onClick={() => setSearchingSocio(true)}
              disabled={loading}
              className="inline-flex items-center gap-1.5 shrink-0 h-9 px-3 rounded-lg border border-outline-variant/50 bg-surface-container-lowest text-sm font-semibold text-primary hover:bg-primary/5 hover:border-primary/40 transition-colors cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">swap_horiz</span>
              Cambiar socio
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex-1 min-w-0">
              <SocioPicker compact onSelect={changeSocio} />
            </div>
            {socio && (
              <button
                type="button"
                onClick={() => setSearchingSocio(false)}
                className="shrink-0 h-9 px-3 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors cursor-pointer"
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Modal
      opened={opened}
      onClose={() => !loading && onClose()}
      aria-label="Registrar movimiento manual de caja"
      title={modalTitle}
      styles={{ header: { gap: 16 }, title: { flex: 1, minWidth: 0 } }}
      size="min(1160px, 95vw)"
      fullScreen={isMobile}
      centered
      padding="lg"
    >
      <form onSubmit={submit} className="flex flex-col" noValidate>
        <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-stretch ${socio ? '' : 'grayscale'}`}>
          <div className="flex flex-col gap-5 min-w-0">
            <FormSection
              icon="category"
              title="Tipo de movimiento"
              description="Elegí la operación para ajustar los conceptos y su impacto en la cuenta corriente."
              disabled={!socio}
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {OPERATIONS.map((item) => (
                  <OperationCard
                    key={item.value}
                    operation={item}
                    selected={form.operation === item.value}
                    onSelect={selectOperation}
                  />
                ))}
              </div>
            </FormSection>

            {requiresOriginMovement && (
              <FormSection
                icon="history"
                title={isSurplusRefund ? 'Excedente a devolver' : 'Cuota emitida o pago a ajustar'}
                description={
                  isSurplusRefund
                    ? 'Seleccioná el excedente / saldo a favor registrado al que corresponde esta devolución.'
                    : 'Seleccioná la cuota ya emitida (para modificar/bonificar sus ítems) o el pago de indumentaria / otro concepto a revertir.'
                }
                disabled={!socio}
              >
                {loadingMovements && (
                  <div className="flex items-center gap-2.5 p-4 rounded-lg border border-outline-variant/30 bg-surface-container-low text-base text-on-surface-variant" role="status">
                    <span className="material-symbols-outlined text-[20px] animate-spin text-primary" aria-hidden="true">progress_activity</span>
                    <span>Buscando movimientos disponibles del socio...</span>
                  </div>
                )}

                {!loadingMovements && movementsError && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-error/30 bg-error-container text-on-error-container" role="alert">
                    <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                    <p className="text-sm">{movementsError}</p>
                  </div>
                )}

                {!loadingMovements && !movementsError && availableMovements.length === 0 && (
                  <p className="text-base text-on-surface-variant text-center py-6 px-4 border border-dashed border-outline-variant/40 rounded-lg">
                    {socio
                      ? (isSurplusRefund
                        ? 'Este socio no tiene excedentes / saldos a favor pendientes de devolución.'
                        : 'Este socio no tiene cuotas emitidas ni pagos de otros conceptos disponibles para nota de crédito.')
                      : 'Seleccioná un socio para ver sus cuotas o pagos disponibles.'}
                  </p>
                )}

                {!loadingMovements && availableMovements.length > 0 && (
                  <div className="max-h-52 overflow-y-auto border border-outline-variant/30 rounded-lg divide-y divide-outline-variant/20 bg-surface-container-lowest shadow-xs">
                    {availableMovements.map((movement) => (
                      <MovementRow
                        key={movement.movimiento_cuenta_id}
                        movement={movement}
                        selected={form.reversedMovement?.movimiento_cuenta_id === movement.movimiento_cuenta_id}
                        onSelect={selectMovement}
                      />
                    ))}
                  </div>
                )}

                {isCreditNote && form.reversedMovement?.cuota != null && (
                  <CuotaBreakdownCard
                    cuotaMovement={form.reversedMovement}
                    allMovements={movements}
                    selectedKeys={selectedCuotaItemKeys}
                    addedItems={addedCuotaItems}
                    onToggleItem={handleToggleCuotaItem}
                    onToggleAll={handleToggleAllCuotaItems}
                    onAddCustomItem={handleAddCustomCuotaItem}
                    onRemoveAddedItem={handleRemoveCustomCuotaItem}
                  />
                )}

                {fieldError('reversedMovement') && (
                  <p className="text-sm text-error font-medium" role="alert">{errors.reversedMovement}</p>
                )}
              </FormSection>
            )}

            <FormSection
              icon="payments"
              title={isCreditNote ? 'Importe a devolver' : 'Importe y medio de pago'}
              disabled={!socio}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 items-start">
                <Campo
                  id="movimiento-monto"
                  label={
                    isCreditNote && form.reversedMovement?.cuota != null
                      ? 'Monto Nota de Crédito (calculado)'
                      : (requiresOriginMovement ? 'Monto a devolver' : 'Monto')
                  }
                  requerido
                  error={fieldError('amount') || (amountExceedsCredit ? errors.amount : '')}
                >
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-outline" aria-hidden="true">$</span>
                    {isCreditNote && form.reversedMovement?.cuota != null ? (
                      <input
                        id="movimiento-monto"
                        type="text"
                        readOnly
                        disabled
                        value={hasValidAmount ? formatAmount(amount).replace('$', '').trim() : '0,00'}
                        placeholder="0,00"
                        className={`${claseInput(Boolean(fieldError('amount')))} pl-7 font-semibold text-right bg-surface-container-low text-on-surface cursor-not-allowed`}
                      />
                    ) : (
                      <input
                        id="movimiento-monto"
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max={requiresOriginMovement && maxCredit ? maxCredit : undefined}
                        step="0.01"
                        value={form.amount}
                        onChange={(event) => update('amount', event.target.value)}
                        placeholder="0.00"
                        aria-invalid={Boolean(fieldError('amount') || amountExceedsCredit) || undefined}
                        className={claseInput(
                          Boolean(fieldError('amount') || amountExceedsCredit),
                          `${NO_SPINNER_CLASS} pl-7 font-semibold text-right`,
                        )}
                      />
                    )}
                  </div>
                  {isCreditNote && form.reversedMovement?.cuota != null ? (
                    <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                      <span>
                        {hasValidAmount
                          ? 'Calculado automáticamente a partir de los conceptos seleccionados arriba.'
                          : 'Seleccioná al menos un ítem de la cuota para calcular el monto.'}
                      </span>
                      {maxCredit > 0 && (
                        <span>Disponible: <strong className="text-on-surface">{formatAmount(maxCredit)}</strong></span>
                      )}
                    </div>
                  ) : (
                    requiresOriginMovement && maxCredit > 0 && (
                      <div className="flex items-center justify-between gap-2 text-xs text-on-surface-variant">
                        <span>Máximo disponible: <strong className="text-on-surface">{formatAmount(maxCredit)}</strong></span>
                        {amount !== maxCredit && (
                          <button
                            type="button"
                            onClick={() => update('amount', String(maxCredit))}
                            className="font-semibold text-primary hover:underline cursor-pointer"
                          >
                            Usar total
                          </button>
                        )}
                      </div>
                    )
                  )}
                </Campo>

                {!isCreditNote ? (
                  <Campo
                    id="movimiento-medio"
                    label="Medio de pago"
                    requerido
                    error={fieldError('paymentMethod')}
                  >
                    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Medio de pago">
                      {PAYMENT_METHODS.map((method) => {
                        const active = form.paymentMethod === method.value
                        return (
                          <button
                            key={method.value}
                            type="button"
                            onClick={() => update('paymentMethod', method.value)}
                            aria-pressed={active}
                            className={`h-11 px-2 rounded-lg border flex items-center justify-center gap-1.5 text-center transition-colors cursor-pointer ${
                              active
                                ? 'border-primary bg-primary/8 text-primary font-semibold'
                                : 'border-outline-variant/50 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">{method.icon}</span>
                            <span className="text-xs font-semibold leading-tight truncate">{method.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </Campo>
                ) : (
                  <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-outline-variant/30 bg-surface-container-low/60">
                    <span className="text-xs font-semibold uppercase tracking-wider text-outline">
                      {form.reversedMovement?.cuota != null ? 'Referencia de la cuota' : 'Referencia del comprobante'}
                    </span>
                    {form.reversedMovement ? (
                      <>
                        <p className="text-sm font-semibold text-on-surface truncate">
                          {form.reversedMovement.cuota != null
                            ? (form.reversedMovement.cuota_detalle?.periodo ? `Cuota ${renderPeriodoLabel(form.reversedMovement.cuota_detalle.periodo)}` : form.reversedMovement.concepto)
                            : `X #${movementReceiptNumber(form.reversedMovement)} · ${form.reversedMovement.concepto}`}
                        </p>
                        <p className="text-xs text-on-surface-variant">
                          Registrado el {formatDate(form.reversedMovement.fecha)} por {formatAmount(maxCredit)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-on-surface-variant">
                        Elegí una cuota o ingreso de la lista superior.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection
              icon="edit_note"
              title="Concepto y trazabilidad"
              disabled={!socio}
              className="mt-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 items-start">
                <Campo
                  id="movimiento-concepto-tipo"
                  label="Concepto"
                  requerido
                  error={fieldError('conceptType')}
                >
                  <SelectConFlecha
                    id="movimiento-concepto-tipo"
                    value={form.conceptType}
                    onChange={(event) => update('conceptType', event.target.value)}
                    conError={Boolean(fieldError('conceptType'))}
                  >
                    <option value="">Seleccioná un concepto</option>
                    {operation.concepts.map((conceptOption) => {
                      const disableSurplusOption = (
                        form.operation === 'Egreso'
                        && conceptOption === 'Devolución de saldo / Excedente'
                        && !loadingMovements
                        && !hasAvailableSurplus
                      )
                      return (
                        <option key={conceptOption} value={conceptOption} disabled={disableSurplusOption}>
                          {disableSurplusOption
                            ? `${conceptOption} (sin saldo excedente disponible)`
                            : conceptOption}
                        </option>
                      )
                    })}
                  </SelectConFlecha>
                </Campo>

                <Campo
                  id="movimiento-detalle"
                  label="Detalle u observación"
                  requerido={isOtherConcept}
                  error={fieldError('detail')}
                >
                  <input
                    id="movimiento-detalle"
                    type="text"
                    maxLength={DETAIL_MAX_LENGTH}
                    value={form.detail}
                    onChange={(event) => update('detail', event.target.value)}
                    placeholder={
                      isOtherConcept
                        ? 'Especificá el motivo del movimiento'
                        : 'Opcional (ej: N° de transferencia, talle, comprobante)'
                    }
                    className={claseInput(Boolean(fieldError('detail')))}
                  />
                </Campo>
              </div>
            </FormSection>
          </div>

          <div
            className={`${TICKET_CLASS} transition-opacity ${socio ? '' : 'opacity-50'}`}
            role="region"
            aria-labelledby="movement-summary-title"
            aria-disabled={!socio || undefined}
          >
            <h3 id="movement-summary-title" className="text-lg font-bold text-on-surface">
              Resumen del movimiento
            </h3>

            <div className="flex flex-1 flex-col justify-between gap-3">
              <TicketSection title="Operación">
                <SummaryLine label="Tipo" value={operation.shortTitle} />
                <SummaryLine label="Efecto en cuenta" value={operation.impactLabel} valueClassName={operation.tone} />
                <SummaryLine
                  label="Socio"
                  value={socio ? `#${formatNumber(socio.numero_socio)}` : '—'}
                />
              </TicketSection>

              <TicketSection title="Concepto">
                {form.conceptType ? (
                  <div className="flex flex-col gap-0.5">
                    <p className="text-base font-semibold text-on-surface">{form.conceptType}</p>
                    {form.detail.trim() && (
                      <p className="text-sm text-on-surface-variant break-words">{form.detail.trim()}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-base text-on-surface-variant">Sin concepto seleccionado.</p>
                )}
              </TicketSection>

              <TicketSection title={isCreditNote ? 'Reversión' : 'Liquidación'}>
                {!isCreditNote ? (
                  <>
                    <SummaryLine
                      label="Medio de pago"
                      value={methodLabel(form.paymentMethod)}
                    />
                    <SummaryLine
                      label="Asiento"
                      value="Cuenta corriente"
                    />
                  </>
                ) : (
                  <>
                    <SummaryLine
                      label={form.reversedMovement?.cuota != null ? 'Comprobante' : 'Ingreso original'}
                      value={
                        form.reversedMovement
                          ? form.reversedMovement.cuota != null
                            ? (form.reversedMovement.cuota_detalle?.periodo ? `Cuota ${renderPeriodoLabel(form.reversedMovement.cuota_detalle.periodo)}` : form.reversedMovement.concepto)
                            : `X #${movementReceiptNumber(form.reversedMovement)}`
                          : '—'
                      }
                    />
                    <SummaryLine
                      label={form.reversedMovement?.cuota != null ? 'Importe cuota' : 'Importe original'}
                      value={form.reversedMovement ? formatAmount(maxCredit) : '—'}
                    />
                    {remainingAfterCredit !== null && (
                      <SummaryLine
                        label="Alcance"
                        value={remainingAfterCredit === 0 ? 'Total' : 'Parcial'}
                      />
                    )}
                    {remainingAfterCredit !== null && remainingAfterCredit > 0 && (
                      <SummaryLine
                        label={form.reversedMovement?.cuota != null ? 'Nuevo valor cuota' : 'Saldo del ingreso'}
                        value={formatAmount(remainingAfterCredit)}
                      />
                    )}
                  </>
                )}
              </TicketSection>

              <div className="flex flex-col gap-1">
                <SummaryLine
                  label={isCreditNote ? 'Total a devolver' : 'Importe total'}
                  value={hasValidAmount ? formatAmount(amount) : formatAmount(0)}
                  isTotal
                  valueClassName={hasValidAmount ? operation.tone : ''}
                />
                <p className="text-sm text-on-surface-variant">
                  {operation.type === 'Abono'
                    ? form.conceptType === 'Excedente de transferencia / Saldo a favor'
                      ? 'Acredita saldo a favor en la cuenta corriente del socio.'
                      : 'Registra el ingreso en caja asociado a la cuenta del socio.'
                    : isCreditNote
                      ? (form.reversedMovement?.cuota != null
                          ? 'Emite una Nota de Crédito (NC-X) bonificando los ítems seleccionados en la cuota.'
                          : 'Descuenta el importe devuelto sobre el ingreso original.')
                      : 'Registra el cargo correspondiente en la cuenta corriente.'}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {submitError && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
                  <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold">No se pudo registrar el movimiento</p>
                    <p className="text-sm text-on-error-container/80 mt-0.5 break-words">{submitError}</p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={!socio || loading || amountExceedsCredit || (requiresOriginMovement && !form.reversedMovement)}
                className={`${SUBMIT_BUTTON_CLASS} w-full h-11 justify-center text-base`}
              >
                <span>{confirmLabel()}</span>
              </button>
            </div>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export default MovimientoManualModal
