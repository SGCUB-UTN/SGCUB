// Search box used in table filter bars. `onChange` receives the typed text.
export default function TableSearchInput({ value, onChange, placeholder, label, className = 'sm:w-auto sm:flex-1 sm:min-w-[16rem] sm:max-w-md' }) {
  return (
    <div className={`relative w-full ${className}`}>
      <span className="material-symbols-outlined absolute left-4 top-1.5 text-outline text-[18px]" aria-hidden="true">
        search
      </span>
      <input
        className="w-full h-10 pl-11 pr-4 bg-surface-container-low border border-outline-variant/40 rounded text-on-surface placeholder:text-outline font-body-sm text-base focus:outline-none focus:border-primary focus:bg-surface-container-lowest transition-colors"
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
      />
    </div>
  )
}
