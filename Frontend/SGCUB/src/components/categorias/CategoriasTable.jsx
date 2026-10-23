import { useMemo, useState } from 'react'
import TableSearchInput from '../shared/TableSearchInput'
import CategoriasGeneroTable from './CategoriasGeneroTable'
import { GENERO_OPTIONS } from './categoriaFormat'
import { matchesSearch } from '../shared/search'

function CategoriasTable({ data, isLoading, error }) {
  const [search, setSearch] = useState('')

  const byGenero = useMemo(() => {
    const filtered = (data ?? []).filter((categoria) => matchesSearch(search, [categoria.nombre]))
    return Object.fromEntries(GENERO_OPTIONS.map(({ value }) => [
      value,
      filtered.filter((categoria) => categoria.genero === value),
    ]))
  }, [data, search])

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm p-4">
        <TableSearchInput
          value={search}
          onChange={setSearch}
          placeholder="Filtrar por nombre..."
          label="Filtrar categorías"
          className="sm:max-w-md"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {['M', 'F'].map((genero) => (
          <CategoriasGeneroTable
            key={genero}
            genero={genero}
            categorias={byGenero[genero]}
            isLoading={isLoading}
            error={error}
          />
        ))}
      </div>
    </div>
  )
}

export default CategoriasTable
