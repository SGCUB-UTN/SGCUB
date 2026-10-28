import { Modal, Text } from '@mantine/core'
import { getAutomationInfo } from './automationCatalog'

const BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors disabled:cursor-wait disabled:opacity-60'

export default function TurnOffAutomationModal({ automation, isUpdating, onConfirm, onClose }) {
  const info = automation ? getAutomationInfo(automation) : null

  return (
    <Modal opened={Boolean(automation)} onClose={onClose} title={<Text fw={700} size="xl">¿Desactivar esta automatización?</Text>} centered>
      {info && (
        <div className="flex flex-col gap-5">
          <p className="text-base text-slate-700">
            Vas a desactivar <strong>{info.title}</strong>.
          </p>
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-base text-amber-900">
            <span className="material-symbols-outlined shrink-0 text-[22px]" aria-hidden="true">warning</span>
            <p>{info.whenOff}</p>
          </div>
          <p className="text-base text-slate-600">Podés volver a activarla cuando quieras.</p>
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isUpdating}
              className={`${BUTTON_CLASS} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isUpdating}
              className={`${BUTTON_CLASS} bg-red-700 hover:bg-red-800 dark:bg-[#e03131] dark:hover:bg-[#c92a2a] text-white`}
            >
              <span className={`material-symbols-outlined text-[20px] ${isUpdating ? 'animate-spin' : ''}`} aria-hidden="true">
                {isUpdating ? 'progress_activity' : 'pause_circle'}
              </span>
              {isUpdating ? 'Desactivando...' : 'Sí, desactivar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
