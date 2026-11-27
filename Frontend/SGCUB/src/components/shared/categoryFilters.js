export const ALL_CATEGORIES = 'all'
export const NO_CATEGORY = 'Sin categoría'
export const NO_CATEGORY_VALUE = 'none'

const GENDER_PREFIX = 'gender:'

export const GENDERS = [
  { value: 'M', label: 'Masculino', shortLabel: 'Masc.', allLabel: 'Todas las masculinas' },
  { value: 'F', label: 'Femenino', shortLabel: 'Fem.', allLabel: 'Todas las femeninas' },
]

export const findGender = (value) => GENDERS.find((gender) => gender.value === value)

export const genderFilterValue = (gender) => `${GENDER_PREFIX}${gender}`

const rowCategories = (row) => [
  { id: row.categoria_id, name: row.categoria, gender: row.categoria_genero ?? '' },
  { id: row.categoria_secundaria_id, name: row.categoria_secundaria, gender: row.categoria_secundaria_genero ?? '' },
].filter((category) => category.id)

export function categoryMatches(row, value) {
  if (value === ALL_CATEGORIES) return true
  if (value === NO_CATEGORY_VALUE) return !row.categoria_id
  const categories = rowCategories(row)
  if (value.startsWith(GENDER_PREFIX)) return categories.some((category) => category.gender === value.slice(GENDER_PREFIX.length))
  return categories.some((category) => String(category.id) === value)
}

export function categoryOptions(rows) {
  const categories = new Map()
  rows.forEach((row) => {
    rowCategories(row).forEach((category) => {
      categories.set(category.id, { value: String(category.id), name: category.name, gender: category.gender })
    })
  })
  return [...categories.values()].sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true }))
}

export function selectedCategory(value, categories) {
  if (value === ALL_CATEGORIES) return { label: 'Todas', gender: null }
  if (value === NO_CATEGORY_VALUE) return { label: NO_CATEGORY, gender: null }
  if (value.startsWith(GENDER_PREFIX)) {
    const gender = findGender(value.slice(GENDER_PREFIX.length))
    return { label: gender?.allLabel ?? value, gender: gender?.value ?? null }
  }
  const category = categories.find((option) => option.value === value)
  return { label: category?.name ?? value, gender: findGender(category?.gender)?.value ?? null }
}
