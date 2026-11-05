import { useState } from 'react'
import { Popover } from '@mantine/core'
import { AGE_OF_MAJORITY, AGE_RANGE_OPTIONS, selectionSummary, toggled } from './reportFilters'
import { CheckOption, FilterTrigger } from './MultiFilter'

const MINORS = { age_min: '', age_max: String(AGE_OF_MAJORITY - 1) }
const ADULTS = { age_min: String(AGE_OF_MAJORITY), age_max: '' }
const INPUT_CLASS = 'w-20 h-9 px-2 rounded border border-outline-variant/40 bg-surface-container-lowest text-sm text-on-surface tabular-nums focus:outline-none focus:border-primary'
const PRESET_CLASS = 'flex-1 h-9 rounded border text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'

const isPreset = (filters, preset) => filters.age_min === preset.age_min && filters.age_max === preset.age_max

const limitsSummary = ({ age_min: low, age_max: high }) => {
  if (isPreset({ age_min: low, age_max: high }, MINORS)) return 'Menores'
  if (isPreset({ age_min: low, age_max: high }, ADULTS)) return 'Mayores'
  if (low !== '' && high !== '') return `${low} a ${high} años`
  if (low !== '') return `Desde ${low} años`
  return `Hasta ${high} años`
}

const digitsOnly = (value) => value.replace(/\D/g, '').slice(0, 3)

export default function AgeFilter({ filters, onChange }) {
  const [opened, setOpened] = useState(false)
  const hasLimits = filters.age_min !== '' || filters.age_max !== ''
  const summary = hasLimits
    ? limitsSummary(filters)
    : selectionSummary(filters.age_range, AGE_RANGE_OPTIONS, 'Todas')
  const invalidLimits = filters.age_min !== '' && filters.age_max !== '' && Number(filters.age_min) > Number(filters.age_max)

  const presetButton = (label, preset) => {
    const active = isPreset(filters, preset)
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onChange(active ? { age_min: '', age_max: '' } : preset)}
        className={`${PRESET_CLASS} ${active ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low text-on-surface border-outline-variant/40 hover:bg-surface-container'}`}
      >
        {label}
      </button>
    )
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width={300} withinPortal>
      <Popover.Target>
        <div className="w-full min-w-0">
          <FilterTrigger
            label="Edad"
            summary={summary}
            active={hasLimits || filters.age_range.length > 0}
            opened={opened}
            onClick={() => setOpened((current) => !current)}
          />
        </div>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div role="dialog" aria-label="Filtrar por edad" className="flex flex-col gap-3 p-3">
          <div className="flex gap-2">
            {presetButton(`Menores de ${AGE_OF_MAJORITY}`, MINORS)}
            {presetButton(`Mayores de ${AGE_OF_MAJORITY}`, ADULTS)}
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Entre edades</p>
            <div className="flex items-center gap-2 text-sm text-on-surface-variant">
              <span>De</span>
              <input
                inputMode="numeric"
                value={filters.age_min}
                onChange={(event) => onChange({ age_min: digitsOnly(event.target.value) })}
                aria-label="Edad mínima"
                placeholder="—"
                className={INPUT_CLASS}
              />
              <span>a</span>
              <input
                inputMode="numeric"
                value={filters.age_max}
                onChange={(event) => onChange({ age_max: digitsOnly(event.target.value) })}
                aria-label="Edad máxima"
                placeholder="—"
                className={INPUT_CLASS}
              />
              <span>años</span>
            </div>
            {invalidLimits && <p className="text-xs text-error" role="alert">La edad mínima no puede superar a la máxima.</p>}
          </div>

          <div className="flex flex-col pt-2 border-t border-outline-variant/30">
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Rangos</p>
            <div role="menu" className="flex flex-col">
              {AGE_RANGE_OPTIONS.map((option) => (
                <CheckOption
                  key={option.value}
                  label={option.label}
                  checked={filters.age_range.includes(option.value)}
                  onToggle={() => onChange({ age_range: toggled(filters.age_range, option.value) })}
                />
              ))}
            </div>
          </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  )
}
