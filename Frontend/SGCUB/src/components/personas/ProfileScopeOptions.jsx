function ProfileScopeOption({ name, option, selected, disabled, onSelect }) {
  return (
    <label className={`flex items-center gap-3 p-3 sm:p-4 rounded-lg border transition-colors ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${selected ? 'border-primary bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'}`}>
      <input
        type="radio"
        name={name}
        value={option.value}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(option.value)}
        className="h-4 w-4 accent-primary shrink-0"
      />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-base font-semibold text-on-surface">{option.label}</span>
        <span className="text-sm text-on-surface-variant">{option.description}</span>
      </div>
    </label>
  )
}

function ProfileScopeOptions({ name, label, options, value, disabled, onChange }) {
  return (
    <fieldset className="flex flex-col gap-2 mt-4" aria-label={label}>
      {options.map((option) => (
        <ProfileScopeOption
          key={option.value}
          name={name}
          option={option}
          selected={value === option.value}
          disabled={disabled}
          onSelect={onChange}
        />
      ))}
    </fieldset>
  )
}

export default ProfileScopeOptions
