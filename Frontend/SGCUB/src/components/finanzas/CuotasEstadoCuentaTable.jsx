import { Fragment, useState } from 'react'
import DataTable from '../shared/DataTable'
import TablePagination from '../shared/TablePagination'
import usePagination from '../../hooks/usePagination'
import { formatAmount } from '../personas/format'
import { currentPeriod, formatPeriod } from '../shared/periodFormat'
import { isPaid } from './accountStatement'
import { cuotaState, cuotaStateBadgeClass, cuotaStateLabel, cuotaStateShortLabel, isOverdue } from './cuotaStates'
import CuotaDetailPanel from './CuotaDetailPanel'

const COLUMN_COUNT = 4

const panelKey = (cuota) => `${cuota.cuota_id}-${cuota.monto_total}-${cuota.saldo_pendiente}`

const byPeriodDesc = (a, b) => String(b.periodo).localeCompare(String(a.periodo)) || b.cuota_id - a.cuota_id

const isPartiallyPaid = (cuota) => !isPaid(cuota) && Number(cuota.monto_pagado ?? 0) > 0

const groupCuotas = (cuotas, period) => {
  const sorted = [...cuotas].sort(byPeriodDesc)
  const visible = sorted.filter((cuota) => String(cuota.periodo) <= period || isPartiallyPaid(cuota) || isPaid(cuota))
  return {
    upToDate: visible.filter((cuota) => !isPaid(cuota) && !isOverdue(cuota)),
    overdue: visible.filter((cuota) => !isPaid(cuota) && isOverdue(cuota)),
    paid: visible.filter(isPaid),
  }
}

function SectionRow({ title, count }) {
  return (
    <tr className="bg-surface-container-low/40">
      <th colSpan={COLUMN_COUNT} scope="rowgroup" className="py-1.5 px-4 text-left text-xs font-semibold uppercase tracking-wider text-outline">
        {title} <span className="font-normal">({count})</span>
      </th>
    </tr>
  )
}

function CuotaRow({ cuota, expanded, onToggle, onPay, onAssignBenefit, onChanged }) {
  const state = cuotaState(cuota)
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
            <span
              className={`inline-flex justify-center min-w-20 px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap ${cuotaStateBadgeClass(state)}`}
              title={cuotaStateLabel(state)}
            >
              {cuotaStateShortLabel(state)}
            </span>
            <span className="font-medium text-on-surface text-base">{cuota.periodo ? formatPeriod(cuota.periodo) : '—'}</span>
            {isPartiallyPaid(cuota) && <span className="text-sm text-amber-700">Pago parcial</span>}
          </div>
        </td>
        <td className="py-3 px-4 text-right text-on-surface-variant">{formatAmount(Number(cuota.monto_total ?? 0))}</td>
        <td className="py-3 px-4 text-right font-semibold text-on-surface">{formatAmount(Number(cuota.saldo_pendiente ?? 0))}</td>
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

function CuotasEstadoCuentaTable({ cuotas, onPay, onAssignBenefit, onChanged }) {
  const [expandedId, setExpandedId] = useState(null)
  const [showPaid, setShowPaid] = useState(false)
  const groups = groupCuotas(cuotas, currentPeriod())
  const { visibleRows: visiblePaid, paginationProps } = usePagination(groups.paid, 10)

  const toggle = (cuotaId) => setExpandedId((current) => (current === cuotaId ? null : cuotaId))
  const renderRow = (cuota) => (
    <CuotaRow
      key={cuota.cuota_id}
      cuota={cuota}
      expanded={expandedId === cuota.cuota_id}
      onToggle={toggle}
      onPay={onPay}
      onAssignBenefit={onAssignBenefit}
      onChanged={onChanged}
    />
  )
  const noOpenCuotas = !groups.upToDate.length && !groups.overdue.length

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        className="border border-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm"
        tableClassName="min-w-[560px]"
        headers={(
          <>
            <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
            <th className="py-3 px-4" scope="col">Período</th>
            <th className="py-3 px-4 text-right w-44" scope="col">Total</th>
            <th className="py-3 px-4 text-right w-44" scope="col">Pendiente</th>
          </>
        )}
      >
        {noOpenCuotas && (
          <tr>
            <td colSpan={COLUMN_COUNT} className="py-4 px-4 text-center text-base text-on-surface-variant">El socio no tiene cuotas pendientes.</td>
          </tr>
        )}
        {groups.upToDate.length > 0 && <SectionRow title="En fecha" count={groups.upToDate.length} />}
        {groups.upToDate.map(renderRow)}
        {groups.overdue.length > 0 && <SectionRow title="Vencidas" count={groups.overdue.length} />}
        {groups.overdue.map(renderRow)}
        {groups.paid.length > 0 && (
          <tr>
            <td colSpan={COLUMN_COUNT} className="py-1.5 px-3">
              <button
                type="button"
                onClick={() => setShowPaid((current) => !current)}
                aria-expanded={showPaid}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
              >
                <span className={`material-symbols-outlined text-[18px] transition-transform ${showPaid ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
                {showPaid ? 'Ocultar cuotas pagas' : `Mostrar cuotas pagas (${groups.paid.length})`}
              </button>
            </td>
          </tr>
        )}
        {showPaid && visiblePaid.map(renderRow)}
      </DataTable>
      {showPaid && groups.paid.length > 10 && (
        <TablePagination id="cuotas-pagas-rows-per-page" rowsPerPageOptions={[10, 25, 50]} {...paginationProps} />
      )}
    </div>
  )
}

export default CuotasEstadoCuentaTable
