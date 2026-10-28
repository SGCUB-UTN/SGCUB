import { useState } from 'react'
import { Popover } from '@mantine/core'
import { GENERO_BADGE_CLASSES } from '../categorias/categoriaFormat'
import {
  ALL_CATEGORIES,
  GENDERS,
  NO_CATEGORY,
  NO_CATEGORY_VALUE,
  findGender,
  genderFilterValue,
  selectedCategory,
} from './cuotaCategories'

const TRIGGER_CLASS = 'inline-flex items-center gap-2 h-10 w-full sm:w-auto pl-3 pr-2.5 bg-surface-container-low border border-outline-variant/40 rounded text-on-surface text-sm font-medium cursor-pointer focus:outline-none focus:border-primary'
const GENDER_BUTTON_CLASS = 'inline-flex items-center justify-center gap-1.5 h-9 rounded border text-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-40 disabled:cursor-not-allowed'
const GENDER_BUTTON_STYLES = {
  M: { idle: 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100', active: 'bg-sky-600 text-white border-sky-600' },
  F: { idle: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100', active: 'bg-pink-600 text-white border-pink-600' },
}
const BADGE_CLASS = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border whitespace-nowrap'

function OptionButton({ label, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-surface-container ${selected ? 'bg-primary/10 text-primary font-semibold' : 'text-on-surface hover:bg-surface-container-low'}`}
    >
      {label}
      {selected && <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">check</span>}
    </button>
  )
}

export default function CategoryFilter({ value, categories, hasUncategorized, onChange }) {
  const [opened, setOpened] = useState(false)
  const [gender, setGender] = useState(null)
  const selected = selectedCategory(value, categories)
  const selectedGender = findGender(selected.gender)
  const activeGender = findGender(gender)
  const ungendered = categories.filter((category) => !findGender(category.gender))

  const toggle = () => {
    if (!opened) setGender(selected.gender)
    setOpened((current) => !current)
  }

  const select = (nextValue) => {
    onChange(nextValue)
    setOpened(false)
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width={300} withinPortal>
      <Popover.Target>
        <button type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={opened} className={TRIGGER_CLASS}>
          <span className="text-on-surface-variant">Categoría:</span>
          <span className="truncate">{selected.label}</span>
          {selectedGender && value !== genderFilterValue(selectedGender.value) && (
            <span className={`${BADGE_CLASS} ${GENERO_BADGE_CLASSES[selectedGender.value]}`}>{selectedGender.shortLabel}</span>
          )}
          <span className="material-symbols-outlined text-outline ml-auto" style={{ fontSize: 18 }} aria-hidden="true">expand_more</span>
        </button>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div role="dialog" aria-label="Filtrar por categoría" className="flex flex-col gap-3 p-3">
          <div role="group" aria-label="Género" className="grid grid-cols-2 gap-2">
            {GENDERS.map((option) => {
              const count = categories.filter((category) => category.gender === option.value).length
              const active = option.value === gender
              const styles = GENDER_BUTTON_STYLES[option.value]
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setGender(option.value)}
                  aria-pressed={active}
                  disabled={count === 0}
                  className={`${GENDER_BUTTON_CLASS} ${active ? styles.active : styles.idle}`}
                >
                  {option.label}
                  <span className="text-xs font-medium opacity-80 tabular-nums">({count})</span>
                </button>
              )
            })}
          </div>

          {activeGender ? (
            <div className="flex flex-col max-h-64 overflow-y-auto">
              <OptionButton
                label={activeGender.allLabel}
                selected={value === genderFilterValue(activeGender.value)}
                onSelect={() => select(genderFilterValue(activeGender.value))}
              />
              {categories.filter((category) => category.gender === activeGender.value).map((category) => (
                <OptionButton
                  key={category.value}
                  label={category.name}
                  selected={value === category.value}
                  onSelect={() => select(category.value)}
                />
              ))}
            </div>
          ) : (
            <p className="px-1 text-sm text-on-surface-variant">Elegí un género para ver sus categorías.</p>
          )}

          <div className="flex flex-col pt-2 border-t border-outline-variant/30">
            <OptionButton label="Todas las categorías" selected={value === ALL_CATEGORIES} onSelect={() => select(ALL_CATEGORIES)} />
            {ungendered.map((category) => (
              <OptionButton key={category.value} label={category.name} selected={value === category.value} onSelect={() => select(category.value)} />
            ))}
            {hasUncategorized && (
              <OptionButton label={NO_CATEGORY} selected={value === NO_CATEGORY_VALUE} onSelect={() => select(NO_CATEGORY_VALUE)} />
            )}
          </div>
        </div>
      </Popover.Dropdown>
    </Popover>
  )
}
