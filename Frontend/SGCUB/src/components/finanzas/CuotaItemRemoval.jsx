import { annulItemCuota } from '../../api/cuotas'
import { formatAmount } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import AuthorizationModal from './AuthorizationModal'
import { SCHOLARSHIP_CONCEPT, isLateFee, itemLabel } from './cuotaItems'

export function RemoveItemButton({ label, blocker = '', onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      disabled={Boolean(blocker)}
      title={blocker || label}
      aria-label={label}
      className="w-6 h-6 shrink-0 inline-flex items-center justify-center rounded-full text-error hover:bg-error-container/60 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden="true">close</span>
    </button>
  )
}

function removalDescription(cuota, item) {
  const scope = isLateFee(item) && Number(cuota.monto_pagado ?? 0) > 0
    ? ' Como la cuota tiene pagos aplicados, se condona la parte del recargo que falta pagar.'
    : ''
  const scholarshipNote = item.concepto === SCHOLARSHIP_CONCEPT
    ? ' La beca se quita solo de este mes y sigue aplicándose al resto de su vigencia.'
    : ''
  return (
    <p>
      Se quita <strong className="text-on-surface">{itemLabel(item)}</strong> ({formatAmount(item.monto)}) de la cuota{' '}
      <strong className="text-on-surface">{formatPeriod(cuota.periodo)}</strong>.{scope}{scholarshipNote}
    </p>
  )
}

function RemoveCuotaItemModal({ cuota, item, onClose, onRemoved }) {
  const confirm = async (authorization) => {
    await annulItemCuota(item.item_cuota_id, authorization)
    onClose()
    onRemoved?.()
  }

  return (
    <AuthorizationModal
      opened={Boolean(cuota && item)}
      title={item && isLateFee(item) ? 'Quitar recargo' : 'Quitar beneficio'}
      description={cuota && item ? removalDescription(cuota, item) : null}
      confirmLabel="Quitar"
      confirmIcon="remove_circle"
      errorMessage="No se pudo quitar el concepto de la cuota."
      onConfirm={confirm}
      onClose={onClose}
    />
  )
}

export default RemoveCuotaItemModal
