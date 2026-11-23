import { useState } from 'react'
import DataTable from '../shared/DataTable'
import ExpandableRow, { DetailList, DetailSection } from '../shared/ExpandableRow'
import { SectionEmpty } from '../shared/FlushSection'
import RowIconButton, { RowIcon } from '../shared/RowIconButton'
import StatusBadge from '../shared/StatusBadge'
import { formatAmount, formatDate } from '../personas/format'
import useToast from '../../hooks/useToast'
import { sendReceiptToWhatsApp } from '../../utils/whatsapp'
import AnnulIncomeModal from './AnnulIncomeModal'
import { WhatsAppIcon } from './WhatsAppComprobanteButton'

const COLUMN_COUNT = 5

const KIND_BADGES = {
  Anulado: { label: 'Anulado', tono: 'error' },
  NotaCredito: { label: 'Nota de crédito', tono: 'alerta' },
  Manual: { label: 'Manual', tono: 'neutro' },
}

const incomeMovement = (comprobante, refunds) => {
  const anulado = comprobante.estado === 'Anulado'
  return {
    key: `ingreso-${comprobante.comprobante_id}`,
    raw: comprobante,
    isRefund: false,
    anulado,
    kind: 'Ingreso',
    badge: anulado ? KIND_BADGES.Anulado : null,
    codigo: comprobante.codigo,
    fecha: comprobante.fecha_emision,
    concepto: comprobante.concepto,
    monto: comprobante.monto_total,
    refunds,
  }
}

const refundMovement = (devolucion, income) => ({
  key: `devolucion-${devolucion.devolucion_id}`,
  raw: devolucion,
  isRefund: true,
  anulado: false,
  kind: 'Devolución',
  badge: KIND_BADGES[devolucion.tipo] ?? KIND_BADGES.Manual,
  codigo: devolucion.codigo,
  fecha: devolucion.fecha,
  concepto: devolucion.concepto,
  monto: devolucion.monto,
  income,
})

const otherMovements = (movimientos) => {
  const ingresos = movimientos?.ingresos ?? []
  const devoluciones = movimientos?.devoluciones ?? []
  const incomeById = new Map(ingresos.map((comprobante) => [comprobante.comprobante_id, comprobante]))
  const refundsOf = (comprobanteId) => devoluciones.filter((devolucion) => devolucion.comprobante_anulado === comprobanteId)
  return [
    ...ingresos.map((comprobante) => incomeMovement(comprobante, refundsOf(comprobante.comprobante_id))),
    ...devoluciones.map((devolucion) => refundMovement(devolucion, incomeById.get(devolucion.comprobante_anulado) ?? null)),
  ].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
}

const refundReason = (devolucion) => devolucion.concepto || 'Sin motivo registrado'

function RefundList({ refunds }) {
  return (
    <ul className="flex flex-col gap-2">
      {refunds.map((devolucion) => (
        <li key={devolucion.devolucion_id} className="text-base text-on-surface">
          <span className="font-semibold tabular-nums">{formatAmount(devolucion.monto)}</span>
          <span className="text-on-surface-variant">
            {' '}por {devolucion.medio_de_pago_nombre || 'medio sin registrar'} · {formatDate(devolucion.fecha)} · {devolucion.codigo}
          </span>
        </li>
      ))}
    </ul>
  )
}

function IncomeDetail({ comprobante, anulado, refunds }) {
  return (
    <div className="flex flex-col gap-4">
      <DetailList
        items={[
          { label: 'Comprobante', value: comprobante.codigo },
          { label: 'Medio de pago del ingreso', value: comprobante.medios_de_pago || '—' },
          { label: 'Fecha de emisión', value: formatDate(comprobante.fecha_emision) },
          { label: 'Concepto', value: comprobante.concepto, wide: true },
        ]}
      />
      {anulado && (
        <DetailSection title="Anulación y devolución" tone="error">
          <DetailList items={[{ label: 'Motivo', value: comprobante.motivo_anulacion || 'Sin motivo registrado', wide: true }]} />
          {refunds.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-on-surface-variant">Dinero devuelto</p>
              <RefundList refunds={refunds} />
            </div>
          ) : (
            <p className="text-base text-on-surface">Todavía no se devolvió el dinero. Si corresponde, emití una nota de crédito desde el comprobante.</p>
          )}
        </DetailSection>
      )}
    </div>
  )
}

function RefundDetail({ devolucion, income }) {
  return (
    <div className="flex flex-col gap-4">
      <DetailList
        items={[
          { label: 'Comprobante', value: devolucion.codigo },
          { label: 'Tipo', value: devolucion.tipo_nombre },
          { label: 'Medio de devolución', value: devolucion.medio_de_pago_nombre || '—' },
          { label: 'Fecha', value: formatDate(devolucion.fecha) },
          { label: 'Responsable', value: devolucion.responsable },
          { label: 'Motivo', value: refundReason(devolucion), wide: true },
        ]}
      />
      {devolucion.comprobante_anulado_codigo && (
        <DetailSection title="Ingreso que se devuelve">
          <DetailList
            items={[
              { label: 'Comprobante', value: devolucion.comprobante_anulado_codigo },
              { label: 'Medio de pago del ingreso', value: income?.medios_de_pago || '—' },
              { label: 'Fecha', value: formatDate(devolucion.comprobante_anulado_fecha) },
              { label: 'Monto', value: formatAmount(devolucion.comprobante_anulado_monto ?? 0) },
            ]}
          />
        </DetailSection>
      )}
    </div>
  )
}

function MovementActions({ movement, socio, readOnly, onOpen, onAnnul }) {
  const { showToast } = useToast()
  const [sending, setSending] = useState(false)
  const phone = socio?.telefono || socio?.persona?.telefono || ''
  const hasPhone = String(phone).trim().length >= 6

  const annulBlocker = movement.isRefund
    ? 'Las devoluciones no se pueden deshacer'
    : movement.anulado ? 'El ingreso ya está anulado'
      : readOnly ? 'La ficha está en solo lectura' : ''

  const sendWhatsApp = async () => {
    setSending(true)
    try {
      await sendReceiptToWhatsApp({
        socio,
        phone,
        comprobanteId: movement.isRefund ? undefined : movement.raw.comprobante_id,
        devolucionId: movement.isRefund ? movement.raw.devolucion_id : undefined,
        comprobanteCodigo: movement.codigo,
        montoTotal: movement.monto,
        tipo: movement.isRefund
          ? (movement.raw.tipo === 'NotaCredito' ? 'nota_credito' : 'devolucion')
          : (movement.anulado ? 'anulado' : 'comprobante'),
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
      <RowIconButton
        tone="whatsapp"
        label="Enviar por WhatsApp"
        disabledReason={hasPhone ? '' : 'El socio no tiene un teléfono registrado'}
        busy={sending}
        onClick={sendWhatsApp}
      >
        <WhatsAppIcon className="w-[18px] h-[18px]" />
      </RowIconButton>
      <RowIconButton tone="neutral" label="Ver comprobante" onClick={() => onOpen(movement)}>
        <RowIcon name="receipt_long" />
      </RowIconButton>
      <RowIconButton tone="danger" label="Anular ingreso" disabledReason={annulBlocker} onClick={() => onAnnul(movement.raw)}>
        <RowIcon name="undo" />
      </RowIconButton>
    </div>
  )
}

function MovementsTable({ movimientos, socio, readOnly = false, onOpen, onChanged }) {
  const { showToast } = useToast()
  const [expandedKey, setExpandedKey] = useState(null)
  const [annulling, setAnnulling] = useState(null)
  const movements = otherMovements(movimientos)

  const incomeAnnulled = (_updated, { refunded, amount }) => {
    const codigo = annulling.codigo
    setAnnulling(null)
    onChanged?.()
    showToast(refunded
      ? { title: 'Ingreso anulado y devuelto', description: `${codigo} quedó anulado y se emitió una nota de crédito por ${formatAmount(amount)}.` }
      : { title: 'Ingreso anulado', description: `${codigo} quedó anulado. Si hay que devolver el dinero, emití una nota de crédito desde el comprobante.` })
  }

  if (movimientos === null) {
    return <SectionEmpty><span className="text-error" role="alert">No se pudieron cargar los ingresos y devoluciones del socio.</span></SectionEmpty>
  }
  if (!movements.length) {
    return <SectionEmpty>Sin ingresos ni devoluciones registrados. No modifican la deuda del socio.</SectionEmpty>
  }

  return (
    <>
      <DataTable
        tableClassName="min-w-[760px]"
        headers={(
          <>
            <th className="py-3 pl-4 pr-0 w-10" scope="col"><span className="sr-only">Detalle</span></th>
            <th className="py-3 px-4 w-64" scope="col">Movimiento</th>
            <th className="py-3 px-4" scope="col">Concepto</th>
            <th className="py-3 px-4 w-40 text-right" scope="col">Monto</th>
            <th className="py-3 px-4 w-40 text-right" scope="col">Acciones</th>
          </>
        )}
      >
        {movements.map((movement) => (
          <ExpandableRow
            key={movement.key}
            expanded={expandedKey === movement.key}
            onToggle={() => setExpandedKey((current) => (current === movement.key ? null : movement.key))}
            label={`${movement.kind} ${movement.codigo}, ${movement.concepto || 'sin concepto'}`}
            colSpan={COLUMN_COUNT}
            detail={movement.isRefund
              ? <RefundDetail devolucion={movement.raw} income={movement.income} />
              : <IncomeDetail comprobante={movement.raw} anulado={movement.anulado} refunds={movement.refunds} />}
          >
            <td className="py-3 px-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-medium text-on-surface text-base">{movement.kind}</span>
                {movement.badge && <StatusBadge size="md" badge={movement.badge} />}
              </div>
            </td>
            <td className="py-3 px-4 break-words">
              <span className="block text-on-surface font-medium">{movement.concepto || '—'}</span>
              <span className="block text-sm text-on-surface-variant">{formatDate(movement.fecha)}</span>
            </td>
            <td
              className={`py-3 px-4 text-right font-semibold tabular-nums whitespace-nowrap ${
                movement.anulado ? 'text-outline line-through' : movement.isRefund ? 'text-error' : 'text-emerald-700'
              }`}
            >
              {movement.anulado ? '' : movement.isRefund ? '− ' : '+ '}{formatAmount(movement.monto)}
            </td>
            <td className="py-2 px-4">
              <MovementActions movement={movement} socio={socio} readOnly={readOnly} onOpen={onOpen} onAnnul={setAnnulling} />
            </td>
          </ExpandableRow>
        ))}
      </DataTable>

      <AnnulIncomeModal
        opened={Boolean(annulling)}
        comprobante={annulling}
        onClose={() => setAnnulling(null)}
        onAnnulled={incomeAnnulled}
      />
    </>
  )
}

export default MovementsTable
