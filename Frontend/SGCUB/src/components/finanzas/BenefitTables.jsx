import { useState } from 'react'
import { cancelBeca } from '../../api/becas'
import DataTable from '../shared/DataTable'
import ExpandableRow, { DetailList, DetailSection } from '../shared/ExpandableRow'
import RowIconButton, { RowIcon } from '../shared/RowIconButton'
import StatusBadge from '../shared/StatusBadge'
import { SectionEmpty } from '../shared/FlushSection'
import { formatAmount, formatDate } from '../personas/format'
import { formatPeriod, periodOf } from '../shared/periodFormat'
import { SCHOLARSHIP_STATES, cuotaDiscounts, isPaid, scholarshipState, todayIso } from './accountStatement'
import AuthorizationModal from './AuthorizationModal'
import { DISCOUNT_TARGET, SCHOLARSHIP_TARGET } from './benefitMath'
import RemoveCuotaItemModal from './CuotaItemRemoval'
import { removalBlocker } from './cuotaItems'
import EditBenefitModal from './EditBenefitModal'


const SCHOLARSHIP_STATE_KEYS = {
  [SCHOLARSHIP_STATES.APPLIED]: 'applied',
  [SCHOLARSHIP_STATES.FINISHED]: 'finished',
  [SCHOLARSHIP_STATES.CANCELLED]: 'cancelled',
}

const ANNULLED_ITEM = 'Anulado'

const TYPES = {
  beca: { label: 'Beca', tono: 'info' },
  descuento: { label: 'Descuento', tono: 'neutro' },
}

const COLUMN_COUNT = 5

const typeBadge = (row) => (row.state === 'cancelled'
  ? { label: row.target.kind === SCHOLARSHIP_TARGET ? 'Beca anulada' : 'Descuento anulado', tono: 'error' }
  : row.type)

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
    sortDate: beca.fecha_creacion ?? beca.fecha_aplicacion,
    validity: `${monthYear(beca.fecha_aplicacion)} → ${beca.fecha_fin ? monthYear(beca.fecha_fin) : 'Sin fecha de fin'}`,
    exclusions: beca.exclusiones ?? [],
    reason: beca.motivo,
    value: scholarshipValue(beca),
    state,
    blocker: state === 'applied' ? '' : NOT_APPLIED_HINT,
    target: { kind: SCHOLARSHIP_TARGET, beca },
    granted: { date: beca.fecha_creacion ?? beca.fecha_aplicacion, by: beca.autorizado_por },
    cancellation: state === 'cancelled'
      ? { date: beca.fecha_cancelacion, by: beca.cancelado_por, reason: beca.motivo_cancelacion }
      : null,
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
    sortDate: discount.item.fecha_creacion ?? `${discount.cuota.periodo}-01`,
    validity: formatPeriod(discount.cuota.periodo),
    exclusions: [],
    reason: discount.item.motivo,
    value: `− ${formatAmount(discount.item.monto)}`,
    state,
    blocker: state === 'applied' ? removalBlocker(discount.cuota, discount.item) : NOT_APPLIED_HINT,
    target: { kind: DISCOUNT_TARGET, ...discount },
    granted: { date: discount.item.fecha_creacion ?? discount.item.fecha_aplicacion, by: discount.item.autorizado_por },
    cancellation: state === 'cancelled'
      ? { date: discount.item.fecha_anulacion, by: discount.item.anulado_por, reason: discount.item.motivo_anulacion }
      : null,
  }
})

function BenefitDetail({ row }) {
  const isScholarship = row.target.kind === SCHOLARSHIP_TARGET
  return (
    <div className="flex flex-col gap-4">
      <DetailList
        items={[
          { label: isScholarship ? 'Otorgada' : 'Otorgado', value: formatDate(row.granted.date) },
          { label: 'Autorizó', value: row.granted.by || 'Sin registrar' },
          { label: isScholarship ? 'Vigencia' : 'Cuota', value: row.validity },
          { label: 'Motivo', value: row.reason || '—', wide: true },
        ]}
      />
      {row.exclusions.length > 0 && (
        <DetailSection title="Meses sin aplicar">
          <ul className="flex flex-col gap-2">
            {row.exclusions.map((exclusion) => (
              <li key={exclusion.exclusion_beca_id} className="text-base text-on-surface">
                <span className="font-semibold">{formatPeriod(exclusion.periodo)}</span>
                <span className="text-on-surface-variant"> · {exclusion.motivo} · Autorizó {exclusion.autorizado_por}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
      {row.cancellation && (
        <DetailSection title="Anulación" tone="error">
          <DetailList
            items={[
              { label: 'Fecha', value: formatDate(row.cancellation.date) },
              { label: 'Autorizó', value: row.cancellation.by || 'Sin registrar' },
              { label: 'Motivo', value: row.cancellation.reason || 'Sin motivo registrado', wide: true },
            ]}
          />
        </DetailSection>
      )}
    </div>
  )
}

function RowActions({ row, readOnly, onEdit, onCancel }) {
  const blocker = readOnly ? 'La ficha está en solo lectura' : row.blocker
  const name = `${row.type.label.toLowerCase()} ${row.validity}`
  return (
    <div className="flex items-center justify-end gap-1.5">
      <RowIconButton tone="neutral" label={`Editar ${name}`} disabledReason={blocker} onClick={() => onEdit(row.target)}>
        <RowIcon name="edit" />
      </RowIconButton>
      <RowIconButton tone="danger" label={`Anular ${name}`} disabledReason={blocker} onClick={() => onCancel(row.target)}>
        <RowIcon name="cancel" />
      </RowIconButton>
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
      title="Anular beca"
      description={beca ? (
        <p>
          Se anula la beca de <strong className="text-on-surface">{scholarshipValue(beca)}</strong> ({beca.motivo}).
          Se quita de las cuotas impagas sin pagos registrados y no se aplicará a las cuotas que se generen.
          Las cuotas pagas o con pagos parciales no se modifican.
        </p>
      ) : null}
      confirmLabel="Anular beca"
      errorMessage="No se pudo anular la beca."
      onConfirm={confirm}
      onClose={onClose}
    />
  )
}

export function BenefitsTable({ becas, cuotas, onChanged, readOnly = false }) {
  const [editing, setEditing] = useState(null)
  const [cancelling, setCancelling] = useState(null)
  const [expandedKey, setExpandedKey] = useState(null)
  const rows = [...scholarshipRows(becas, todayIso()), ...discountRows(cuotas)]
    .sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))

  return (
    <>
      {becas === null && (
        <SectionEmpty><span className="text-error" role="alert">No se pudieron cargar las becas del socio.</span></SectionEmpty>
      )}
      {rows.length ? (
        <DataTable
          tableClassName="min-w-[760px]"
          headers={(
            <>
              <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
              <th className="py-3 px-4" scope="col">Beneficio</th>
              <th className="py-3 px-4" scope="col">Motivo</th>
              <th className="py-3 px-4 w-32 text-right" scope="col">Valor</th>
              <th className="py-3 px-4 w-28 text-right" scope="col">Acciones</th>
            </>
          )}
        >
          {rows.map((row) => (
            <ExpandableRow
              key={row.key}
              expanded={expandedKey === row.key}
              onToggle={() => setExpandedKey((current) => (current === row.key ? null : row.key))}
              label={`${typeBadge(row).label} ${row.validity}`}
              colSpan={COLUMN_COUNT}
              detail={<BenefitDetail row={row} />}
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-medium text-on-surface whitespace-nowrap">{row.validity}</span>
                  <StatusBadge size="md" badge={typeBadge(row)} />
                </div>
              </td>
              <td className="py-3 px-4 break-words">
                <span className="text-on-surface-variant">{row.reason || '—'}</span>
                {row.cancellation?.reason && (
                  <span className="block text-sm text-error">
                    {row.target.kind === SCHOLARSHIP_TARGET ? 'Anulada' : 'Anulado'}: {row.cancellation.reason}
                  </span>
                )}
              </td>
              <td className="py-3 px-4 text-right font-semibold text-on-surface whitespace-nowrap tabular-nums">{row.value}</td>
              <td className="py-2 px-4">
                <RowActions row={row} readOnly={readOnly} onEdit={setEditing} onCancel={setCancelling} />
              </td>
            </ExpandableRow>
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
    </>
  )
}
