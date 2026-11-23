import { TEXT_BUTTON_CLASS } from './textButton'

export default function ClearFiltersButton({ onClick, visible = true }) {
  if (!visible) return null
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Limpiar filtros"
      className={`${TEXT_BUTTON_CLASS} h-10 text-base whitespace-nowrap`}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">filter_alt_off</span>
      Limpiar
    </button>
  )
}
