import { BUTTON_CLASSES } from './settingsForm'

const countLabel = (count) => (count === 1 ? '1 cambio sin guardar' : `${count} cambios sin guardar`)

// Fixed to the bottom of the page while there are unsaved changes
export default function SaveChangesBar({ count, onCancel, onSave }) {
  if (!count) return null
  return (
    <div className="sticky bottom-0 z-20 -mx-1 mt-2" role="region" aria-label="Cambios sin guardar">
      <div className="flex flex-col gap-3 rounded-t-xl border border-b-0 border-outline-variant/40 bg-surface-container-lowest px-5 py-3 shadow-[0_-6px_16px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 text-base font-semibold text-on-surface">
          <span className="material-symbols-outlined text-[20px] text-amber-600" aria-hidden="true">edit_note</span>
          {countLabel(count)}
        </p>
        <div className="flex justify-end gap-2">
          <button type="button" className={BUTTON_CLASSES.secondary} onClick={onCancel}>Cancelar</button>
          <button type="button" className={BUTTON_CLASSES.primary} onClick={onSave}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">save</span>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  )
}
