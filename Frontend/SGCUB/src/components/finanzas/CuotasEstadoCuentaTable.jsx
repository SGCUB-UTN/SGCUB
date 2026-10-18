import { Fragment, useState } from 'react'
import DataTable from '../shared/DataTable'
import TablePagination from '../shared/TablePagination'
import usePagination from '../../hooks/usePagination'
import { formatAmount, formatDate } from '../personas/format'
import { cuotaAmount, cuotaConcepts } from './accountStatement'
import { cuotaState, cuotaStateBadgeClass, cuotaStateLabel } from './cuotaStates'
import CuotaDetailPanel from './CuotaDetailPanel'

const COLUMN_COUNT = 9

const panelKey = (cuota) => `${cuota.cuota_id}-${cuota.monto_total}-${cuota.saldo_pendiente}`

function CuotasEstadoCuentaTable({ cuotas, onPay, onAssignBenefit }) {
  const [expandedId, setExpandedId] = useState(null)
  const { visibleRows, paginationProps } = usePagination(cuotas, 5)

  const toggle = (cuotaId) => setExpandedId((current) => (current === cuotaId ? null : cuotaId))

  const handleKeyDown = (event, cuotaId) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle(cuotaId)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        className="border border-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm"
        tableClassName="min-w-[960px]"
        bodyClassName="text-base"
        headers={(
          <>
            <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
            <th className="py-3 px-4" scope="col">Período</th>
            <th className="py-3 px-4" scope="col">Venc. 1</th>
            <th className="py-3 px-4" scope="col">Venc. 2</th>
            <th className="py-3 px-4" scope="col">Conceptos</th>
            <th className="py-3 px-4 text-right" scope="col">Importe</th>
            <th className="py-3 px-4 text-right" scope="col">Pagado</th>
            <th className="py-3 px-4 text-right" scope="col">Pendiente</th>
            <th className="py-3 px-4 text-center" scope="col">Estado</th>
          </>
        )}
      >
        {visibleRows.map((cuota) => {
          const state = cuotaState(cuota)
          const expanded = expandedId === cuota.cuota_id
          return (
            <Fragment key={cuota.cuota_id}>
              <tr
                tabIndex={0}
                aria-expanded={expanded}
                onClick={() => toggle(cuota.cuota_id)}
                onKeyDown={(event) => handleKeyDown(event, cuota.cuota_id)}
                className={`cursor-pointer transition-colors ${expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
              >
                <td className="py-3.5 pl-4 pr-0 text-outline">
                  <span className={`material-symbols-outlined text-[22px] transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
                </td>
                <td className="py-3.5 px-4 font-semibold text-on-surface">{cuota.periodo || '—'}</td>
                <td className="py-3.5 px-4 text-on-surface-variant">{formatDate(cuota.fecha_venc1)}</td>
                <td className="py-3.5 px-4 text-on-surface-variant">{formatDate(cuota.fecha_venc2)}</td>
                <td className="py-3.5 px-4 text-on-surface-variant">{cuotaConcepts(cuota)}</td>
                <td className="py-3.5 px-4 text-right font-semibold text-on-surface">{formatAmount(cuotaAmount(cuota))}</td>
                <td className="py-3.5 px-4 text-right text-on-surface-variant">{formatAmount(Number(cuota.monto_pagado ?? 0))}</td>
                <td className="py-3.5 px-4 text-right font-semibold text-on-surface">{formatAmount(Number(cuota.saldo_pendiente ?? 0))}</td>
                <td className="py-3.5 px-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${cuotaStateBadgeClass(state)}`}>
                    {cuotaStateLabel(state)}
                  </span>
                </td>
              </tr>
              {expanded && (
                <CuotaDetailPanel
                  key={panelKey(cuota)}
                  cuota={cuota}
                  colSpan={COLUMN_COUNT}
                  onPay={onPay}
                  onAssignBenefit={onAssignBenefit}
                />
              )}
            </Fragment>
          )
        })}
      </DataTable>
      <TablePagination id="cuotas-rows-per-page" rowsPerPageOptions={[5, 10, 25, 50]} {...paginationProps} />
    </div>
  )
}

export default CuotasEstadoCuentaTable
