export const RESULT_TYPES = {
  exito: 'exito',
  pendiente: 'pendiente',
  error: 'error',
}

export const DECISIONS = {
  aceptada: 'aceptada',
  mantenida: 'mantenida',
  editada: 'editada',
}

export const DECISION_STYLES = {
  aceptada: 'bg-emerald-50 text-emerald-700',
  mantenida: 'bg-slate-100 text-slate-700',
  editada: 'bg-sky-50 text-sky-700',
}

export const categoryName = (category) => category?.nombre ?? '—'

// Same rule as the player form: categories of the player's gender that admit their age, plus the selected ones
export const eligibleCategories = (categories, result, selectedIds = []) => {
  if (!result?.genero || !result?.anio_nacimiento) return categories
  return categories.filter((category) => (
    selectedIds.includes(String(category.categoria_id))
    || (category.genero === result.genero && category.edad_maxima >= category.anio_vigente - result.anio_nacimiento)
  ))
}
