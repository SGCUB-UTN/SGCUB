import { useState } from 'react'
import { Popover } from '@mantine/core'
import { matchesSearch } from '../shared/search'
import { selectionSummary, toggled } from './reportFilters'

const TRIGGER_CLASS = 'inline-flex items-center gap-2 h-10 w-full min-w-0 pl-3 pr-2.5 bg-surface-container-low border border-outline-variant/40 rounded text-on-surface text-sm font-medium cursor-pointer focus:outline-none focus:border-primary'
const SEARCH_THRESHOLD = 8
const ICON_STYLE = { fontSize: 18 }

export function FilterTrigger({ label, summary, active, opened, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={opened}
      className={`${TRIGGER_CLASS} ${active ? 'border-primary/60 bg-primary/5' : ''}`}
    >
      <span className="text-on-surface-variant whitespace-nowrap">{label}:</span>
      <span className={`truncate ${active ? 'text-primary font-semibold' : ''}`}>{summary}</span>
      <span className="material-symbols-outlined text-outline ml-auto" style={ICON_STYLE} aria-hidden="true">expand_more</span>
    </button>
  )
}

const OPTION_ICONS = {
  multiple: { on: 'check_box', off: 'check_box_outline_blank' },
  single: { on: 'radio_button_checked', off: 'radio_button_unchecked' },
}

export function CheckOption({ label, checked, onToggle, single = false }) {
  const icons = OPTION_ICONS[single ? 'single' : 'multiple']
  return (
    <button
      type="button"
      role={single ? 'menuitemradio' : 'menuitemcheckbox'}
      aria-checked={checked}
      onClick={onToggle}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-surface-container ${checked ? 'text-primary font-semibold' : 'text-on-surface hover:bg-surface-container-low'}`}
    >
      <span className={`material-symbols-outlined ${checked ? 'text-primary' : 'text-outline'}`} style={ICON_STYLE} aria-hidden="true">
        {checked ? icons.on : icons.off}
      </span>
      <span className="min-w-0">{label}</span>
    </button>
  )
}

export default function MultiFilter({ label, options, value, onChange, allLabel = 'Todos', width = 280 }) {
  const [opened, setOpened] = useState(false)
  const [query, setQuery] = useState('')
  const searchable = options.length > SEARCH_THRESHOLD
  const visible = options.filter((option) => matchesSearch(query, [option.label, option.group]))

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width={width} withinPortal>
      <Popover.Target>
        <div className="w-full min-w-0">
          <FilterTrigger
            label={label}
            summary={selectionSummary(value, options, allLabel)}
            active={value.length > 0}
            opened={opened}
            onClick={() => setOpened((current) => !current)}
          />
        </div>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div role="dialog" aria-label={`Filtrar por ${label.toLowerCase()}`} className="flex flex-col gap-2 p-3">
          {searchable && (
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar..."
              aria-label={`Buscar ${label.toLowerCase()}`}
              className="h-9 px-3 rounded border border-outline-variant/40 bg-surface-container-lowest text-sm text-on-surface focus:outline-none focus:border-primary"
            />
          )}
          <div role="menu" className="flex flex-col max-h-64 overflow-y-auto">
            {visible.map((option, index) => (
              <div key={option.value}>
                {option.group && option.group !== visible[index - 1]?.group && (
                  <p className="px-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">{option.group}</p>
                )}
                <CheckOption
                  label={option.label}
                  checked={value.includes(option.value)}
                  onToggle={() => onChange(toggled(value, option.value))}
                />
              </div>
            ))}
            {!visible.length && <p className="px-2 py-1.5 text-sm text-on-surface-variant">Sin resultados.</p>}
          </div>
          <div className="flex justify-end pt-2 border-t border-outline-variant/30">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={!value.length}
              className="px-2 py-1 rounded text-sm font-semibold text-primary hover:bg-primary/5 cursor-pointer disabled:opacity-50 disabled:cursor-default disabled:hover:bg-transparent"
            >
              Quitar selección
            </button>
          </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  )
}

export function SingleFilter({ label, options, value, onChange, defaultValue }) {
  const [opened, setOpened] = useState(false)
  const selected = options.find((option) => option.value === value)

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width={240} withinPortal>
      <Popover.Target>
        <div className="w-full min-w-0">
          <FilterTrigger
            label={label}
            summary={selected?.label}
            active={value !== defaultValue}
            opened={opened}
            onClick={() => setOpened((current) => !current)}
          />
        </div>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div role="menu" aria-label={`Filtrar por ${label.toLowerCase()}`} className="flex flex-col p-3">
          {options.map((option) => (
            <CheckOption
              key={option.value}
              single
              label={option.label}
              checked={option.value === value}
              onToggle={() => {
                onChange(option.value)
                setOpened(false)
              }}
            />
          ))}
        </div>
      </Popover.Dropdown>
    </Popover>
  )
}
