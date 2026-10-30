import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { revertirSaldoCuota } from '../../api/cuotas'
import { formatAmount } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { itemLabel } from './cuotaItems'
import { SUBMIT_BUTTON_CLASS } from './formParts'
import { ReversalForm } from './RevertPaymentFlow'

function SettlementSummary({ cuota, item }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30">
      <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">sell</span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-on-surface">Cuota {formatPeriod(cuota.periodo)}</p>
        <p className="text-sm text-on-surface-variant">
          Se saldó con {itemLabel(item)} ({formatAmount(item.monto)}): no ingresó dinero.
        </p>
      </div>
    </div>
  )
}

function SettlementDone({ cuota, item, onClose }) {
  return (
    <div className="flex flex-col gap-5">
      <SettlementSummary cuota={cuota} item={item} />
      <div className="flex items-start gap-3 p-4 rounded-lg border border-emerald-200 bg-emerald-50" role="status">
        <span className="material-symbols-outlined text-emerald-700" aria-hidden="true">check_circle</span>
        <div>
          <p className="font-semibold text-on-surface">Pago revertido</p>
          <p className="text-base text-on-surface-variant">
            Se quitó {itemLabel(item)} y la cuota {formatPeriod(cuota.periodo)} volvió a quedar pendiente, con sus recargos.
          </p>
        </div>
      </div>
      <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end">
        <button type="button" onClick={onClose} className={SUBMIT_BUTTON_CLASS}>Cerrar</button>
      </div>
    </div>
  )
}

function RevertSettlementFlow({ cuota, item, opened, onClose, onChanged }) {
  const [done, setDone] = useState(false)

  const revert = async ({ responsable, motivo, outcome }) => {
    await revertirSaldoCuota(cuota.cuota_id, { responsable, motivo, desenlace: outcome })
    onChanged?.()
    setDone(true)
  }

  return (
    <Modal opened={opened} onClose={onClose} title={<Text fw={700} size="xl">Revertir pago</Text>} centered size="lg">
      {done ? (
        <SettlementDone cuota={cuota} item={item} onClose={onClose} />
      ) : (
        <ReversalForm
          summary={<SettlementSummary cuota={cuota} item={item} />}
          available={0}
          reverted={false}
          onSubmit={revert}
          onCancel={onClose}
        />
      )}
    </Modal>
  )
}

export default RevertSettlementFlow
