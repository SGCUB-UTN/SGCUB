import { useState } from 'react'
import { cancelBeca } from '../../api/becas'
import DataTable from '../shared/DataTable'
import FlushSection, { SectionEmpty } from '../shared/FlushSection'
import { formatAmount } from '../personas/format'
import { formatPeriod, periodOf } from '../shared/periodFormat'
import { SCHOLARSHIP_STATES, cuotaDiscounts, isPaid, scholarshipState, todayIso } from './accountStatement'
import AuthorizationModal from './AuthorizationModal'
import { DISCOUNT_TARGET, SCHOLARSHIP_TARGET } from './benefitMath'
import RemoveCuotaItemModal from './CuotaItemRemoval'
import { removalBlocker } from './cuotaItems'
import EditBenefitModal from './EditBenefitModal'


const BADGE_CLASS = 'inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border whitespace-nowrap'

const STATE_CLASSES = {
  applied: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  finished: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40',
  cancelled: 'bg-error-container/40 text-on-error-container border-error/20',
}

const SCHOLARSHIP_STATE_KEYS = {
  [SCHOLARSHIP_STATES.APPLIED]: 'applied',
  [SCHOLARSHIP_STATES.FINISHED]: 'finished',
  [SCHOLARSHIP_STATES.CANCELLED]: 'cancelled',
}

const STATE_LABELS = {
  beca: { applied: 'Aplicada', finished: 'Finalizada', cancelled: 'Cancelada' },
  descuento: { applied: 'Aplicado', finished: 'Finalizado', cancelled: 'Cancelado' },
}

const ANNULLED_ITEM = 'Anulado'

const TYPES = {
  beca: { label: 'Beca', className: 'bg-primary/5 text-primary border-primary/20' },
  descuento: { label: 'Descuento', className: 'bg-surface-container-high text-on-surface border-outline-variant/40' },
}

const ACTION_BUTTON_CLASS = 'w-8 h-8 inline-flex items-center justify-center rounded border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

const monthYear = (date) => formatPeriod(periodOf(date))

const scholarshipValue = (beca) => (beca.porcentaje != null
  ? `${Number(beca.porcentaje).toLocaleString('es-AR')}%`
  : formatAmount(beca.monto))

const NOT_APPLIED_HINT = 'Solo se pueden modificar beneficios aplicados'

const scholarshipRows = (becas, today) => (becas ?? []).map((beca) => {
  const state = SCHOLARSHIP_STATE_KEYS[scholarshipState(beca, today)] ?? 'applied'
  return {
    key: `beca-${beca.beca_id}`,
    type: TYPES.beca,
    sortDate: beca.fecha_aplicacion,
    validity: `${monthYear(beca.fecha_aplicacion)} → ${beca.fecha_fin ? monthYear(beca.fecha_fin) : 'Sin fecha de fin'}`,
    exclusions: beca.exclusiones ?? [],
    reason: beca.motivo,
    cancellation: beca.motivo_cancelacion,
    value: scholarshipValue(beca),
    state,
    stateLabel: STATE_LABELS.beca[state],
    blocker: state === 'applied' ? '' : NOT_APPLIED_HINT,
    target: { kind: SCHOLARSHIP_TARGET, beca },
  }
})

const discountState = ({ item, cuota }) => {
  if (item.estado === ANNULLED_ITEM) return 'cancelled'
  return isPaid(cuota) ? 'finished' : 'applied'
}

const discountRows = (cuotas) => cuotaDiscounts(cuotas).map((discount) => {
  const state = discountState(discount)
  return {
    key: `descuento-${discount.item.item_cuota_id}`,
    type: TYPES.descuento,
    sortDate: `${discount.cuota.periodo}-01`,
    validity: formatPeriod(discount.cuota.periodo),
    exclusions: [],
    reason: discount.item.motivo,
    cancellation: discount.item.motivo_anulacion,
    value: `− ${formatAmount(discount.item.monto)}`,
    state,
    stateLabel: STATE_LABELS.descuento[state],
    blocker: state === 'applied' ? removalBlocker(discount.cuota, discount.item) : NOT_APPLIED_HINT,
    target: { kind: DISCOUNT_TARGET, ...discount },
  }
})

function ExclusionList({ exclusions }) {
  if (!exclusions.length) return null
  return (
    <span className="block text-sm font-normal text-on-surface-variant whitespace-normal">
      Sin aplicar en:{' '}
      {exclusions.map((exclusion, index) => (
        <span key={exclusion.exclusion_beca_id} title={`${exclusion.motivo} · Autorizó ${exclusion.autorizado_por}`}>
          {index > 0 && ', '}
          <span className="underline decoration-dotted underline-offset-2">{formatPeriod(exclusion.periodo)}</span>
        </span>
      ))}
    </span>
  )
}

function RowActions({ row, onEdit, onCancel }) {
  const disabled = Boolean(row.blocker)
  return (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onEdit(row.target)}
        disabled={disabled}
        title={row.blocker || 'Editar'}
        aria-label={`Editar ${row.type.label.toLowerCase()} ${row.validity}`}
        className={`${ACTION_BUTTON_CLASS} border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">edit</span>
      </button>
      <button
        type="button"
        onClick={() => onCancel(row.target)}
        disabled={disabled}
        title={row.blocker || 'Cancelar'}
        aria-label={`Cancelar ${row.type.label.toLowerCase()} ${row.validity}`}
        className={`${ACTION_BUTTON_CLASS} border-red-200 text-red-600 hover:bg-red-50`}
      >
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">block</span>
      </button>
    </div>
  )
}

function CancelScholarshipModal({ beca, onClose, onCancelled }) {
  const confirm = async (authorization) => {
    await cancelBeca(beca.beca_id, authorization)
    onClose()
    onCancelled?.()
  }

  return (
    <AuthorizationModal
      opened={Boolean(beca)}
      title="Cancelar beca"
      description={beca ? (
        <p>
          Se cancela la beca de <strong className="text-on-surface">{scholarshipValue(beca)}</strong> ({beca.motivo}).
          Se quita de las cuotas impagas sin pagos registrados y no se aplicará a las cuotas que se generen.
          Las cuotas pagas o con pagos parciales no se modifican.
        </p>
      ) : null}
      confirmLabel="Cancelar beca"
      errorMessage="No se pudo cancelar la beca."
      onConfirm={confirm}
      onClose={onClose}
    />
  )
}

export function BenefitsTable({ becas, cuotas, onChanged, className = '' }) {
  const [editing, setEditing] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const rows = [...scholarshipRows(becas, todayIso()), ...discountRows(cuotas)]
    .sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))

  return (
    <FlushSection id="beneficios-title" icon="sell" title="Becas y descuentos" className={className}>
      {becas === null && (
        <SectionEmpty><span className="text-error" role="alert">No se pudieron cargar las becas del socio.</span></SectionEmpty>
      )}
      {rows.length ? (
        <DataTable
          tableClassName="min-w-[860px] table-fixed"
          headers={(
            <>
              <th className="py-3 px-4 w-[12%]" scope="col">Tipo</th>
              <th className="py-3 px-4 w-[26%]" scope="col">Vigencia</th>
              <th className="py-3 px-4" scope="col">Motivo</th>
              <th className="py-3 px-4 w-[13%] text-right" scope="col">Valor</th>
              <th className="py-3 px-4 w-[13%] text-center" scope="col">Estado</th>
              <th className="py-3 px-4 w-[11%] text-center" scope="col">Acciones</th>
            </>
          )}
        >
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="py-3 px-4">
                <span className={`${BADGE_CLASS} ${row.type.className}`}>{row.type.label}</span>
              </td>
              <td className="py-3 px-4 font-medium text-on-surface whitespace-nowrap">
                {row.validity}
                <ExclusionList exclusions={row.exclusions} />
              </td>
              <td className="py-3 px-4 text-on-surface-variant break-words">{row.reason || '—'}</td>
              <td className="py-3 px-4 text-right font-semibold text-on-surface whitespace-nowrap">{row.value}</td>
              <td className="py-3 px-4 text-center">
                <span
                  className={`${BADGE_CLASS} ${STATE_CLASSES[row.state]}`}
                  title={row.state === 'cancelled' && row.cancellation ? row.cancellation : undefined}
                >
                  {row.stateLabel}
                </span>
              </td>
              <td className="py-3 px-4">
                <RowActions row={row} onEdit={setEditing} onCancel={setCancelling} />
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        becas !== null && <SectionEmpty>Sin becas ni descuentos.</SectionEmpty>
      )}

      <EditBenefitModal target={editing} onClose={() => setEditing(null)} onSaved={onChanged} />
      <CancelScholarshipModal
        beca={cancelling?.kind === SCHOLARSHIP_TARGET ? cancelling.beca : null}
        onClose={() => setCancelling(null)}
        onCancelled={onChanged}
      />
      <RemoveCuotaItemModal
        cuota={cancelling?.kind === DISCOUNT_TARGET ? cancelling.cuota : null}
        item={cancelling?.kind === DISCOUNT_TARGET ? cancelling.item : null}
        onClose={() => setCancelling(null)}
        onRemoved={onChanged}
      />
    </FlushSection>
  )
}
