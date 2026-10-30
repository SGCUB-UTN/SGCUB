import { Fragment, useState } from 'react'
import DataTable from '../shared/DataTable'
import TablePagination from '../shared/TablePagination'
import usePagination from '../../hooks/usePagination'
import { formatAmount } from '../personas/format'
import { currentPeriod, formatPeriod } from '../shared/periodFormat'
import { isPaid } from './accountStatement'
import { CUOTA_STATES, cuotaState, cuotaStateBadgeClass, cuotaStateLabel, isOverdue } from './cuotaStates'
import CuotaDetailPanel from './CuotaDetailPanel'

const COLUMN_COUNT = 4

const OVERDUE_BADGE_LABELS = {
  [CUOTA_STATES.VENCIDA_1]: '1er venc.',
  [CUOTA_STATES.VENCIDA_2]: '2do venc.',
}

const PAID_BADGE_CLASS = 'bg-gray-100 text-gray-600 border-gray-200'

const rowBadge = (cuota) => {
  if (isPaid(cuota)) return { label: 'Paga', title: cuotaStateLabel(CUOTA_STATES.PAGA), className: PAID_BADGE_CLASS }
  if (!isOverdue(cuota)) return null
  const state = cuotaState(cuota)
  return { label: OVERDUE_BADGE_LABELS[state], title: cuotaStateLabel(state), className: cuotaStateBadgeClass(state) }
}

const panelKey = (cuota) => `${cuota.cuota_id}-${cuota.monto_total}-${cuota.saldo_pendiente}`

const byPeriodDesc = (a, b) => String(b.periodo).localeCompare(String(a.periodo)) || b.cuota_id - a.cuota_id

const isPartiallyPaid = (cuota) => !isPaid(cuota) && Number(cuota.monto_pagado ?? 0) > 0

// The latest paid cuotas are always shown: the ones of the latest payment (the only one that can be
// reverted) or, without it, the paid cuota of the latest period. The rest of the paid ones fold away.
const groupCuotas = (cuotas, period, revertibleIds) => {
  const sorted = [...cuotas].sort(byPeriodDesc)
  const visible = sorted.filter((cuota) => String(cuota.periodo) <= period || isPartiallyPaid(cuota) || isPaid(cuota))
  const paid = visible.filter(isPaid)
  const fromLatestPayment = paid.filter((cuota) => revertibleIds.includes(cuota.cuota_id))
  const latestPaid = fromLatestPayment.length ? fromLatestPayment : paid.slice(0, 1)
  return {
    upToDate: visible.filter((cuota) => !isPaid(cuota) && !isOverdue(cuota)),
    overdue: visible.filter((cuota) => !isPaid(cuota) && isOverdue(cuota)),
    latestPaid,
    latestTitle: fromLatestPayment.length ? 'Último pago' : 'Última cuota paga',
    olderPaid: paid.filter((cuota) => !latestPaid.includes(cuota)),
    future: sorted.filter((cuota) => !visible.includes(cuota)),
  }
}

const NO_IDS = []

const SECTION_ROW_CLASS = 'bg-surface-container-low/40'
const SECTION_CELL_CLASS = 'py-1.5 px-4 text-left text-xs font-semibold uppercase tracking-wider text-outline'

function SectionRow({ title, count, expanded, onToggle }) {
  return (
    <tr className={`${SECTION_ROW_CLASS} cursor-pointer hover:bg-surface-container-low transition-colors`} onClick={onToggle}>
      <th colSpan={COLUMN_COUNT} scope="rowgroup" className={SECTION_CELL_CLASS}>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation()
            onToggle()
          }}
          className="inline-flex items-center gap-1 h-4 uppercase tracking-wider cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm"
        >
          <span className={`material-symbols-outlined leading-none transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 16 }} aria-hidden="true">expand_more</span>
          {title} <span className="font-normal">({count})</span>
        </button>
      </th>
    </tr>
  )
}

function ToggleRow({ expanded, onToggle, children }) {
  return (
    <tr>
      <td colSpan={COLUMN_COUNT} className="py-1.5 px-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[18px] transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
          {children}
        </button>
      </td>
    </tr>
  )
}

function PaidAction({ revertible, onRevert }) {
  if (!revertible) return <span className="text-sm font-normal text-on-surface-variant">Pagada</span>
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onRevert()
      }}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-error/40 text-sm font-semibold text-error hover:bg-error-container/40 transition-colors cursor-pointer"
    >
      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">undo</span>
      Revertir pago
    </button>
  )
}

function CuotaRow({ cuota, expanded, revertible, onToggle, onPay, onAssignBenefit, onRevert, onChanged }) {
  const badge = rowBadge(cuota)
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle(cuota.cuota_id)
    }
  }

  return (
    <Fragment>
      <tr
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => onToggle(cuota.cuota_id)}
        onKeyDown={handleKeyDown}
        className={`cursor-pointer transition-colors ${expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
      >
        <td className="py-3 pl-4 pr-0 text-outline">
          <span className={`material-symbols-outlined text-[22px] transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-3">
            <span className="font-medium text-on-surface text-base">{cuota.periodo ? formatPeriod(cuota.periodo) : '—'}</span>
            {badge && (
              <span
                className={`inline-flex justify-center min-w-20 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${badge.className}`}
                title={badge.title}
              >
                {badge.label}
              </span>
            )}
            {isPartiallyPaid(cuota) && <span className="text-sm text-amber-700">Pago parcial</span>}
          </div>
        </td>
        <td className="py-3 px-4 text-right text-on-surface-variant">{formatAmount(Number(cuota.monto_total ?? 0))}</td>
        <td className="py-2 px-4 text-right font-semibold text-on-surface whitespace-nowrap">
          {isPaid(cuota)
            ? <PaidAction revertible={revertible} onRevert={onRevert} />
            : formatAmount(Number(cuota.saldo_pendiente ?? 0))}
        </td>
      </tr>
      {expanded && (
        <CuotaDetailPanel
          key={panelKey(cuota)}
          cuota={cuota}
          colSpan={COLUMN_COUNT}
          onPay={onPay}
          onAssignBenefit={onAssignBenefit}
          onChanged={onChanged}
        />
      )}
    </Fragment>
  )
}

// `revertibleIds` are the cuotas of the latest payment; `onRevert` starts its reversal.
// `className` styles the table shell (e.g. edge to edge inside a section).
function CuotasEstadoCuentaTable({ cuotas, revertibleIds = NO_IDS, onPay, onAssignBenefit, onRevert, onChanged, className = '' }) {
  const [expandedId, setExpandedId] = useState(null)
  const [showPaid, setShowPaid] = useState(false)
  const [collapsed, setCollapsed] = useState({ future: true })
  const groups = groupCuotas(cuotas, currentPeriod(), revertibleIds)
  const { visibleRows: visiblePaid, paginationProps } = usePagination(groups.olderPaid, 10)

  const toggleSection = (section) => setCollapsed((current) => ({ ...current, [section]: !current[section] }))
  const renderSection = (section, title, rows) => rows.length > 0 && (
    <Fragment key={section}>
      <SectionRow title={title} count={rows.length} expanded={!collapsed[section]} onToggle={() => toggleSection(section)} />
      {!collapsed[section] && rows.map(renderRow)}
    </Fragment>
  )
  const toggle = (cuotaId) => setExpandedId((current) => (current === cuotaId ? null : cuotaId))
  const renderRow = (cuota) => (
    <CuotaRow
      key={cuota.cuota_id}
      cuota={cuota}
      expanded={expandedId === cuota.cuota_id}
      revertible={revertibleIds.includes(cuota.cuota_id)}
      onToggle={toggle}
      onPay={onPay}
      onAssignBenefit={onAssignBenefit}
      onRevert={onRevert}
      onChanged={onChanged}
    />
  )
  const noOpenCuotas = !groups.upToDate.length && !groups.overdue.length

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        className={className}
        tableClassName="min-w-[560px]"
        headers={(
          <>
            <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
            <th className="py-3 px-4" scope="col">Período</th>
            <th className="py-3 px-4 text-right w-44" scope="col">Total</th>
            <th className="py-3 px-4 text-right w-48" scope="col">Pendiente</th>
          </>
        )}
      >
        {noOpenCuotas && (
          <tr>
            <td colSpan={COLUMN_COUNT} className="py-4 px-4 text-center text-base text-on-surface-variant">El socio no tiene cuotas pendientes.</td>
          </tr>
        )}
        {renderSection('future', 'Cuotas futuras', groups.future)}
        {renderSection('upToDate', 'En fecha', groups.upToDate)}
        {renderSection('overdue', 'Vencidas', groups.overdue)}
        {renderSection('latestPaid', groups.latestTitle, groups.latestPaid)}
        {groups.olderPaid.length > 0 && (
          <ToggleRow expanded={showPaid} onToggle={() => setShowPaid((current) => !current)}>
            {showPaid ? 'Ocultar cuotas pagas anteriores' : `Mostrar más cuotas pagas (${groups.olderPaid.length})`}
          </ToggleRow>
        )}
        {showPaid && visiblePaid.map(renderRow)}
      </DataTable>
      {showPaid && groups.olderPaid.length > 10 && (
        <TablePagination id="cuotas-pagas-rows-per-page" rowsPerPageOptions={[10, 25, 50]} {...paginationProps} />
      )}
    </div>
  )
}

export default CuotasEstadoCuentaTable
