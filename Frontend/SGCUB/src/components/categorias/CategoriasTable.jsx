import { useMemo } from 'react'
import TableSearchInput from '../shared/TableSearchInput'
import PersonTabs from '../personas/TabsNavPersonas'
import CategoriasGeneroTable from './CategoriasGeneroTable'
import { GENERO_TAB_TONES } from './categoriaFormat'
import { matchesSearch } from '../shared/search'

export const ALL_CATEGORIES = 'todas'

const TABS = [
  { id: ALL_CATEGORIES, label: 'Todas', icon: 'sports_soccer' },
  { id: 'M', label: 'Masculinas', icon: 'man', tone: GENERO_TAB_TONES.M },
  { id: 'F', label: 'Femeninas', icon: 'woman', tone: GENERO_TAB_TONES.F },
]

function CategoriasTable({ data, isLoading, error, genero, onGeneroChange, search, onSearchChange, onRetry }) {

  const byTab = useMemo(() => {
    const filtered = (data ?? []).filter((categoria) => matchesSearch(search, [categoria.nombre]))
    return Object.fromEntries(TABS.map(({ id }) => [
      id,
      id === ALL_CATEGORIES ? filtered : filtered.filter((categoria) => categoria.genero === id),
    ]))
  }, [data, search])

  const tabs = TABS.map((tab) => ({
    ...tab,
    badge: !isLoading && { label: byTab[tab.id].length, tono: 'neutro' },
    content: (
      <CategoriasGeneroTable
        categorias={byTab[tab.id]}
        isLoading={isLoading}
        error={error}
        showGenero={tab.id === ALL_CATEGORIES}
        emptyText={(data ?? []).length === 0
          ? 'Todavía no hay categorías cargadas. Se crean en Configuración → Deporte.'
          : 'No hay categorías que coincidan con el filtro.'}
        onRetry={onRetry}
        onClearFilters={search.trim() ? () => onSearchChange('') : undefined}
      />
    ),
  }))

  return (
    <div className="min-w-0 flex flex-col gap-4">
      <TableSearchInput
        value={search}
        onChange={onSearchChange}
        placeholder="Filtrar por nombre..."
        label="Filtrar categorías"
        className="sm:max-w-md"
      />

      <PersonTabs tabs={tabs} value={genero} onChange={onGeneroChange} panelClassName="min-w-0 bg-surface-container-lowest rounded-b-xl shadow-sm overflow-hidden" />
    </div>
  )
}

export default CategoriasTable
