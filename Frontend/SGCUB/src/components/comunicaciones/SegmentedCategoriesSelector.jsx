import { useMemo, useState } from 'react'
import TableTabs from '../shared/TableTabs'

const GENERO_LABELS = {
  M: 'Masculino',
  F: 'Femenino',
}

export default function SegmentedCategoriesSelector({
  categorias = [],
  categoryCounts = {},
  selectedCategoryIds = [],
  onToggleCategory,
  onSelectAll,
  onClearAll,
}) {
  const [filterTab, setFilterTab] = useState('todas')

  const validCategorias = useMemo(
    () => categorias.filter((cat) => (cat.nombre || '').toLowerCase() !== 'no asignado'),
    [categorias]
  )

  const countsByType = useMemo(() => {
    const juveniles = validCategorias.filter((c) => (c.tipo || '').toLowerCase() === 'juvenil').length
    const mayores = validCategorias.filter((c) => (c.tipo || '').toLowerCase() === 'mayor').length
    return {
      todas: validCategorias.length,
      juvenil: juveniles,
      mayor: mayores,
    }
  }, [validCategorias])

  const filteredCategorias = useMemo(() => {
    if (filterTab === 'todas') return validCategorias
    return validCategorias.filter((cat) => (cat.tipo || '').toLowerCase() === filterTab)
  }, [validCategorias, filterTab])

  const allFilteredSelected =
    filteredCategorias.length > 0 &&
    filteredCategorias.every((cat) => selectedCategoryIds.includes(cat.categoria_id))

  const handleToggleAllFiltered = () => {
    const filteredIds = filteredCategorias.map((c) => c.categoria_id)
    if (allFilteredSelected) {
      onClearAll?.(filteredIds)
    } else {
      onSelectAll?.(filteredIds)
    }
  }

  return (
    <div className="border border-outline-variant/40 rounded-lg bg-surface-container-lowest overflow-hidden">
      <div className="px-4 py-3 bg-surface-container-low border-b border-outline-variant/40 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-on-surface">Categorías deportivas</h4>
          <p className="text-xs text-on-surface-variant">
            Seleccioná las categorías cuyos jugadores activos recibirán el comunicado.
          </p>
        </div>
        {filteredCategorias.length > 0 && (
          <button
            type="button"
            onClick={handleToggleAllFiltered}
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            {allFilteredSelected ? 'Deseleccionar visibles' : 'Seleccionar todas las visibles'}
          </button>
        )}
      </div>

      <TableTabs
        id="categorias-segmentadas-tabs"
        label="Filtrar categorías por tipo"
        options={[
          { value: 'todas', label: 'Todas', count: countsByType.todas },
          { value: 'juvenil', label: 'Juveniles', count: countsByType.juvenil },
          { value: 'mayor', label: 'Mayores', count: countsByType.mayor },
        ]}
        value={filterTab}
        onChange={setFilterTab}
      />

      {filteredCategorias.length === 0 ? (
        <p className="p-6 text-center text-sm text-on-surface-variant">
          No hay categorías registradas en este segmento.
        </p>
      ) : (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filteredCategorias.map((cat) => {
            const catId = cat.categoria_id
            const isSelected = selectedCategoryIds.includes(catId)
            const count =
              categoryCounts[catId] !== undefined
                ? categoryCounts[catId]
                : Number(cat.cantidad_jugadores ?? 0)
            const generoLabel = GENERO_LABELS[cat.genero] || ''

            return (
              <label
                key={catId}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'border-primary bg-primary/8 text-on-surface'
                    : 'border-outline-variant/40 bg-surface-container-lowest hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleCategory(catId)}
                    className="w-4 h-4 rounded accent-primary cursor-pointer shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-on-surface truncate">
                      {cat.nombre}
                    </p>
                    <p className="text-xs text-on-surface-variant truncate">
                      {[generoLabel, cat.anio_vigente ? `Temp. ${cat.anio_vigente}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums shrink-0 ${
                    isSelected
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {count} {count === 1 ? 'jugador' : 'jugadores'}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
