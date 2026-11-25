import { useState } from 'react'
import { Popover } from '@mantine/core'
import { claseInput } from '../socios/socioForm'
import { Campo } from '../socios/SocioFormFields'

export default function LigasField({ ligas, value, onChange, disabled = false }) {
  const [opened, setOpened] = useState(false)
  const selected = ligas.filter((liga) => value.includes(String(liga.liga_id)))
  const empty = ligas.length === 0

  const toggle = (ligaId) => onChange(value.includes(ligaId) ? value.filter((id) => id !== ligaId) : [...value, ligaId])

  const summary = () => {
    if (empty) return 'No hay ligas cargadas'
    if (selected.length === 0) return 'Sin ligas'
    return selected.map((liga) => liga.abreviatura).join(', ')
  }

  return (
    <Campo id="ligas" label="Ligas" opcional>
      <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md" width="target" withinPortal>
        <Popover.Target>
          <div className="relative">
            <button
              id="ligas"
              type="button"
              aria-haspopup="listbox"
              aria-expanded={opened}
              disabled={disabled || empty}
              onClick={() => setOpened((current) => !current)}
              title={selected.map((liga) => liga.nombre).join(', ') || undefined}
              className={claseInput(false, `pr-10 text-left cursor-pointer truncate ${selected.length ? '' : 'text-outline'}`)}
            >
              {summary()}
            </button>
            <span className={`material-symbols-outlined absolute right-3 top-3 text-outline text-base pointer-events-none transition-transform ${opened ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
          </div>
        </Popover.Target>
        <Popover.Dropdown p={4}>
          <ul role="listbox" aria-multiselectable="true" aria-label="Ligas" className="flex flex-col max-h-64 overflow-y-auto thin-scroll">
            {ligas.map((liga) => {
              const ligaId = String(liga.liga_id)
              const checked = value.includes(ligaId)
              return (
                <li key={ligaId} role="option" aria-selected={checked}>
                  <label className="flex items-center gap-3 px-3 py-2 rounded-md text-base text-on-surface hover:bg-surface-container-low cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(ligaId)}
                      className="h-4 w-4 accent-primary shrink-0"
                    />
                    <span className="flex-1 min-w-0 truncate">{liga.nombre}</span>
                    <span className="text-sm text-on-surface-variant">{liga.abreviatura}</span>
                  </label>
                </li>
              )
            })}
          </ul>
        </Popover.Dropdown>
      </Popover>
      {empty && <p className="text-sm text-on-surface-variant">Se agregan en Configuración → Deporte.</p>}
    </Campo>
  )
}
