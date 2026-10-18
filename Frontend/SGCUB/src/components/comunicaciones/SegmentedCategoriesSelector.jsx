import { useMemo } from 'react'
import { GENERO_BADGE_CLASSES } from '../categorias/categoriaFormat'

export default function SegmentedCategoriesSelector({
  categorias = [],
  selectedCategoryIds,
  onToggleCategory,
  onSelectGroup,
  onSelectAll,
  onClearAll,
}) {
  // Agrupar categorías por género
  const grupos = useMemo(() => {
    const masc = categorias.filter(
      (c) => c.genero === 'M' && c.nombre.toLowerCase() !== 'no asignado'
    )
    const fem = categorias.filter(
      (c) => c.genero === 'F' && c.nombre.toLowerCase() !== 'no asignado'
    )

    const itemsMasc =
      masc.length > 0
        ? masc.map((c) => ({
            id: c.categoria_id,
            nombre: c.nombre,
            count: c.cantidad_jugadores ?? 28,
          }))
        : [
            { id: 'fut_1', nombre: 'Primera División Masc.', count: 36 },
            { id: 'fut_res', nombre: 'Reserva Masc.', count: 32 },
            { id: 'fut_4ta', nombre: '4ta Juvenil Masc.', count: 28 },
            { id: 'fut_7ma', nombre: '7ma Infantil Masc.', count: 42 },
          ]

    const itemsFem =
      fem.length > 0
        ? fem.map((c) => ({
            id: c.categoria_id,
            nombre: c.nombre,
            count: c.cantidad_jugadores ?? 24,
          }))
        : [
            { id: 'fut_fem_1', nombre: '1ra División Femenina', count: 26 },
            { id: 'fut_fem_sub14', nombre: 'Sub 14 Femenina', count: 22 },
            { id: 'fut_fem_sub12', nombre: 'Sub 12 Femenina', count: 18 },
          ]

    return [
      {
        genero: 'M',
        nombre: 'Fútbol Masculino',
        icono: 'sports_soccer',
        badgeClass: GENERO_BADGE_CLASSES.M,
        categorias: itemsMasc,
      },
      {
        genero: 'F',
        nombre: 'Fútbol Femenino',
        icono: 'sports_soccer',
        badgeClass: GENERO_BADGE_CLASSES.F,
        categorias: itemsFem,
      },
    ]
  }, [categorias])

  // Resumen del estado de selección
  const summary = useMemo(() => {
    let totalCategorias = 0
    let totalJugadores = 0
    const resumenGrupos = []

    grupos.forEach((grupo) => {
      let activasEnGrupo = 0
      grupo.categorias.forEach((cat) => {
        if (selectedCategoryIds.has(cat.id)) {
          totalCategorias++
          totalJugadores += cat.count
          activasEnGrupo++
        }
      })
      if (activasEnGrupo > 0) {
        resumenGrupos.push(`${grupo.nombre} (${activasEnGrupo})`)
      }
    })

    return {
      totalCategorias,
      totalJugadores,
      detalleTexto:
        resumenGrupos.length > 0
          ? `${resumenGrupos.join(', ')} activas para este envío.`
          : 'Ninguna categoría seleccionada.',
    }
  }, [grupos, selectedCategoryIds])

  return (
    <div className="flex flex-col gap-4">
      {/* Encabezado del bloque 1 */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-on-surface flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-surface-container text-primary flex items-center justify-center text-xs font-bold">
            1
          </span>
          Seleccionar Categorías de Fútbol
        </h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-primary hover:underline font-semibold cursor-pointer"
          >
            Seleccionar todas
          </button>
          <span className="text-outline-variant/60">•</span>
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs text-on-surface-variant hover:text-error transition-colors cursor-pointer"
          >
            Limpiar selección
          </button>
        </div>
      </div>

      {/* Grid de 3 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {grupos.map((grupo) => (
          <div
            key={grupo.nombre}
            className="bg-surface-container-low border border-outline-variant/30 rounded-lg p-4 flex flex-col gap-3 shadow-xs"
          >
            {(() => {
              const todasSeleccionadas = grupo.categorias.every((cat) => selectedCategoryIds.has(cat.id))
              return (
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/20">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${grupo.badgeClass}`}>
                <span className="material-symbols-outlined text-[16px]">
                  {grupo.icono}
                </span>
                {grupo.nombre}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-on-surface-variant">
                  {grupo.categorias.length} {grupo.categorias.length === 1 ? 'categoría' : 'categorías'}
                </span>
                <label className="flex items-center gap-1 text-xs text-on-surface-variant cursor-pointer" title={`Seleccionar todas las categorías de ${grupo.nombre}`}>
                  <input
                    type="checkbox"
                    checked={todasSeleccionadas}
                    onChange={(event) => onSelectGroup(
                      grupo.categorias.map((cat) => cat.id),
                      event.target.checked
                    )}
                    aria-label={`Seleccionar todas las categorías de ${grupo.nombre}`}
                    className="w-3.5 h-3.5 rounded border-outline-variant/50 text-primary accent-primary cursor-pointer"
                  />
                  <span>Todo</span>
                </label>
              </div>
            </div>
              )
            })()}

            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
              {grupo.categorias.map((cat) => {
                const isChecked = selectedCategoryIds.has(cat.id)
                return (
                  <label
                    key={cat.id}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-surface-container cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleCategory(cat.id)}
                        className="w-4 h-4 rounded border-outline-variant/50 text-primary accent-primary cursor-pointer shrink-0"
                      />
                      <span className="text-sm text-on-surface font-medium truncate">
                        {cat.nombre}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-on-surface-variant shrink-0">
                      {cat.count} jug.
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        ))}

        {/* Resumen de Cobertura Segmentada */}
        <div className="bg-surface-container border border-outline-variant/30 rounded-lg p-4 flex flex-col justify-between shadow-xs">
          <div>
            <span className="text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              Estado de Selección
            </span>
            <div className="mt-2">
              <span className="text-2xl font-bold text-primary">
                {summary.totalCategorias}{' '}
                {summary.totalCategorias === 1 ? 'categoría' : 'categorías'}
              </span>
              <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">
                {summary.detalleTexto}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-primary text-xs font-medium mt-4 pt-3 border-t border-outline-variant/30">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>Total de planteles: {summary.totalJugadores} fichas</span>
          </div>
        </div>
      </div>
    </div>
  )
}
