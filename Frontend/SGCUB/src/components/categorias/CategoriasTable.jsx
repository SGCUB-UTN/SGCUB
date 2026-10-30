import { useMemo, useState } from 'react'
import TableSearchInput from '../shared/TableSearchInput'
import UnderlineTabs from '../shared/UnderlineTabs'
import CategoriasGeneroTable from './CategoriasGeneroTable'
import { GENERO_OPTIONS } from './categoriaFormat'
import { matchesSearch } from '../shared/search'

const PANEL_ID = 'categorias-genero-panel'
const TAB_LABELS = { M: 'Categorías masculinas', F: 'Categorías femeninas' }

function CategoriasTable({ data, isLoading, error }) {
  const [search, setSearch] = useState('')
  const [genero, setGenero] = useState('M')

  const byGenero = useMemo(() => {
    const filtered = (data ?? []).filter((categoria) => matchesSearch(search, [categoria.nombre]))
    return Object.fromEntries(GENERO_OPTIONS.map(({ value }) => [
      value,
      filtered.filter((categoria) => categoria.genero === value),
    ]))
  }, [data, search])

  const tabs = GENERO_OPTIONS.map(({ value }) => ({
    value,
    id: `categorias-tab-${value}`,
    label: TAB_LABELS[value],
    count: isLoading ? null : byGenero[value].length,
  }))

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <TableSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Filtrar por nombre..."
        label="Filtrar categorías"
        className="sm:max-w-md"
      />

      <div>
        <UnderlineTabs
          label="Categorías por género"
          tabs={tabs}
          value={genero}
          onChange={setGenero}
          panelId={PANEL_ID}
          className="mb-4"
        />
        <div id={PANEL_ID} role="tabpanel" aria-labelledby={`categorias-tab-${genero}`}>
          <CategoriasGeneroTable
            categorias={byGenero[genero]}
            isLoading={isLoading}
            error={error}
          />
        </div>
      </div>
    </div>
  )
}

export default CategoriasTable
