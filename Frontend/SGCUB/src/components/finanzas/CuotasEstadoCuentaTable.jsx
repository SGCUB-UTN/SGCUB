import { Fragment, useState } from 'react'
import DataTable from '../shared/DataTable'
import TablePagination from '../shared/TablePagination'
import usePagination from '../../hooks/usePagination'
import { formatAmount } from '../personas/format'
import { currentPeriod, formatPeriod } from '../shared/periodFormat'
import { isPaid } from './accountStatement'
import { CUOTA_STATES, cuotaState, cuotaStateLabel } from './cuotaStates'
import StatusBadge from '../shared/StatusBadge'
import CuotaDetailPanel from './CuotaDetailPanel'
import RowIconButton, { RowIcon } from '../shared/RowIconButton'
import { WhatsAppIcon } from './WhatsAppComprobanteButton'
import { getComprobantesByCuota } from '../../api/comprobantes'
import { sendReceiptToWhatsApp } from '../../utils/whatsapp'
import useToast from '../../hooks/useToast'

const COLUMN_COUNT = 4
const ROWS_PER_PAGE = 15

const panelKey = (cuota) => `${cuota.cuota_id}-${cuota.monto_total}-${cuota.saldo_pendiente}`

const byPeriodDesc = (a, b) => String(b.periodo).localeCompare(String(a.periodo)) || b.cuota_id - a.cuota_id

const isPartiallyPaid = (cuota) => !isPaid(cuota) && Number(cuota.monto_pagado ?? 0) > 0

const isFuture = (cuota, period) => String(cuota.periodo) > period && !isPaid(cuota) && !isPartiallyPaid(cuota)

const STATE_TONES = {
  [CUOTA_STATES.EN_FECHA]: 'info',
  [CUOTA_STATES.VENCIDA_1]: 'alerta',
  [CUOTA_STATES.VENCIDA_2]: 'error',
  [CUOTA_STATES.PAGA]: 'ok',
}

function CuotaStateBadge({ cuota }) {
  const state = cuotaState(cuota)
  return <StatusBadge size="md" badge={{ label: cuotaStateLabel(state), tono: STATE_TONES[state] ?? 'neutro' }} />
}

const NO_IDS = []

const SECTION_ROW_CLASS = 'bg-surface-container-low/40'
const SECTION_CELL_CLASS = 'py-2 px-4 text-left text-sm font-semibold text-on-surface-variant'

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
          className="inline-flex items-center gap-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-sm"
        >
          <span className={`material-symbols-outlined leading-none transition-transform ${expanded ? 'rotate-180' : ''}`} style={{ fontSize: 16 }} aria-hidden="true">expand_more</span>
          {title} <span className="font-normal">({count})</span>
        </button>
      </th>
    </tr>
  )
}

const hasPayments = (cuota) => isPaid(cuota) || Number(cuota.monto_pagado ?? 0) > 0

const latestReceipt = (comprobantes) => [...(comprobantes ?? [])]
  .filter((comprobante) => comprobante.estado !== 'Anulado')
  .sort((a, b) => String(b.fecha_emision).localeCompare(String(a.fecha_emision)) || b.comprobante_id - a.comprobante_id)[0]

const NO_RECEIPT_TOAST = { tone: 'error', title: 'Sin comprobante', description: 'La cuota no tiene comprobantes vigentes.' }

function CuotaActions({ cuota, socio, revertible, onPay, onRevert, onViewReceipt }) {
  const { showToast } = useToast()
  const [sending, setSending] = useState(false)
  const [opening, setOpening] = useState(false)
  const paid = isPaid(cuota)
  const phone = socio?.telefono || socio?.persona?.telefono || ''
  const hasPhone = String(phone).trim().length >= 6

  const receiptBlocker = !hasPayments(cuota) ? 'La cuota todavía no tiene pagos' : ''
  const whatsappBlocker = receiptBlocker || (!hasPhone ? 'El socio no tiene un teléfono registrado' : '')

  const viewReceipt = async () => {
    setOpening(true)
    try {
      const receipt = latestReceipt(await getComprobantesByCuota(cuota.cuota_id))
      if (receipt) onViewReceipt(receipt.comprobante_id)
      else showToast(NO_RECEIPT_TOAST)
    } catch {
      showToast({ tone: 'error', title: 'No se pudo abrir el comprobante', description: 'Probá de nuevo en unos minutos.' })
    } finally {
      setOpening(false)
    }
  }
  const payBlocker = paid ? 'La cuota ya está paga' : !onPay ? 'No se pueden registrar pagos' : ''
  const revertBlocker = !onRevert
    ? 'La ficha está en solo lectura'
    : !revertible ? 'Solo se puede revertir el último pago' : ''

  const sendWhatsApp = async () => {
    setSending(true)
    try {
      const receipt = latestReceipt(await getComprobantesByCuota(cuota.cuota_id))
      if (!receipt) {
        showToast(NO_RECEIPT_TOAST)
        return
      }
      await sendReceiptToWhatsApp({
        socio,
        phone,
        comprobanteId: receipt.comprobante_id,
        comprobanteCodigo: receipt.codigo || `COM-${String(receipt.numero).padStart(8, '0')}`,
        montoTotal: receipt.monto_total,
        tipo: 'comprobante',
        onToast: showToast,
      })
    } catch {
      showToast({ tone: 'error', title: 'No se pudo enviar el comprobante', description: 'Probá de nuevo en unos minutos.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5">
      <RowIconButton label="Ver comprobante" disabledReason={receiptBlocker} busy={opening} onClick={viewReceipt}>
        <RowIcon name="receipt" />
      </RowIconButton>
      <RowIconButton tone="whatsapp" label="Enviar comprobante por WhatsApp" disabledReason={whatsappBlocker} busy={sending} onClick={sendWhatsApp}>
        <WhatsAppIcon className="w-[18px] h-[18px]" />
      </RowIconButton>
      <RowIconButton tone="primary" label="Pagar cuota" disabledReason={payBlocker} onClick={() => onPay(cuota)}>
        <RowIcon name="payments" />
      </RowIconButton>
      <RowIconButton tone="danger" label="Revertir pago" disabledReason={revertBlocker} onClick={() => onRevert(cuota)}>
        <RowIcon name="undo" />
      </RowIconButton>
    </div>
  )
}

function CuotaRow({ cuota, socio, expanded, revertible, onToggle, onPay, onAssignBenefit, onRevert, onViewReceipt, onChanged, readOnly }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle(cuota.cuota_id)
    }
  }
  const period = cuota.periodo ? formatPeriod(cuota.periodo) : '—'

  return (
    <Fragment>
      <tr
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`Cuota de ${period}`}
        onClick={() => onToggle(cuota.cuota_id)}
        onKeyDown={handleKeyDown}
        className={`cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ${expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
      >
        <td className="py-3 pl-4 pr-0 text-outline">
          <span className={`material-symbols-outlined text-[22px] transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
        </td>
        <td className="py-3 px-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-medium text-on-surface text-base whitespace-nowrap">{period}</span>
            <CuotaStateBadge cuota={cuota} />
          </div>
        </td>
        <td className="py-3 px-4 text-right whitespace-nowrap tabular-nums">
          {isPartiallyPaid(cuota) && (
            <span className="text-sm text-on-surface-variant mr-2">Pagó {formatAmount(Number(cuota.monto_pagado ?? 0))} de</span>
          )}
          <span className="font-semibold text-on-surface">{formatAmount(Number(cuota.monto_total ?? 0))}</span>
        </td>
        <td className="py-2 px-4">
          <CuotaActions cuota={cuota} socio={socio} revertible={revertible} onPay={onPay} onRevert={onRevert} onViewReceipt={onViewReceipt} />
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
          readOnly={readOnly}
        />
      )}
    </Fragment>
  )
}

// `revertibleIds` are the cuotas of the latest payment; `onRevert` starts its reversal.
// `className` styles the table shell (e.g. edge to edge inside a section).
function CuotasEstadoCuentaTable({ cuotas, socio = null, revertibleIds = NO_IDS, settlementCuotaId = null, onPay, onAssignBenefit, onRevert, onViewReceipt, onChanged, readOnly = false, className = '' }) {
  const [expandedId, setExpandedId] = useState(null)
  const [showFuture, setShowFuture] = useState(false)
  const period = currentPeriod()
  const sorted = [...cuotas].sort(byPeriodDesc)
  const future = sorted.filter((cuota) => isFuture(cuota, period))
  const listed = sorted.filter((cuota) => !isFuture(cuota, period))
  const { visibleRows, paginationProps } = usePagination(listed, ROWS_PER_PAGE)

  const toggle = (cuotaId) => setExpandedId((current) => (current === cuotaId ? null : cuotaId))
  const renderRow = (cuota) => (
    <CuotaRow
      key={cuota.cuota_id}
      cuota={cuota}
      socio={socio}
      expanded={expandedId === cuota.cuota_id}
      revertible={revertibleIds.includes(cuota.cuota_id) || cuota.cuota_id === settlementCuotaId}
      onToggle={toggle}
      onPay={onPay}
      onAssignBenefit={onAssignBenefit}
      onRevert={onRevert}
      onViewReceipt={onViewReceipt}
      onChanged={onChanged}
      readOnly={readOnly}
    />
  )
  const noOpenCuotas = !listed.some((cuota) => !isPaid(cuota))

  return (
    <div className="flex flex-col gap-4">
      <DataTable
        className={className}
        tableClassName="min-w-[680px]"
        headers={(
          <>
            <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
            <th className="py-3 px-4" scope="col">Período</th>
            <th className="py-3 px-4 text-right" scope="col">Total</th>
            <th className="py-3 px-4 text-right w-52" scope="col">Acciones</th>
          </>
        )}
      >
        {future.length > 0 && (
          <>
            <SectionRow title="Cuotas futuras" count={future.length} expanded={showFuture} onToggle={() => setShowFuture((current) => !current)} />
            {showFuture && future.map(renderRow)}
          </>
        )}
        {noOpenCuotas && (
          <tr>
            <td colSpan={COLUMN_COUNT} className="py-4 px-4 text-center text-base text-on-surface-variant">El socio no tiene cuotas pendientes.</td>
          </tr>
        )}
        {visibleRows.map(renderRow)}
      </DataTable>
      {listed.length > ROWS_PER_PAGE && (
        <TablePagination id="cuotas-rows-per-page" rowsPerPageOptions={[15, 30, 60]} {...paginationProps} />
      )}
    </div>
  )
}

export default CuotasEstadoCuentaTable
