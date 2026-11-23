import { TEXT_BUTTON_CLASS } from './textButton'

export default function ClearFiltersButton({ onClick, visible = true }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Limpiar filtros"
      aria-hidden={visible ? undefined : true}
      tabIndex={visible ? undefined : -1}
      disabled={!visible}
      className={`${TEXT_BUTTON_CLASS} h-10 text-base whitespace-nowrap ${visible ? '' : 'invisible'}`}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">filter_alt_off</span>
      Limpiar
    </button>
  )
}
