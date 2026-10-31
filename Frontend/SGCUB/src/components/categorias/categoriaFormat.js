// Valores de `Categoria.genero` en el backend (GENERO_CHOICES)
export const GENERO_OPTIONS = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Femenino' },
]

export const getGeneroLabel = (genero) =>
  GENERO_OPTIONS.find((option) => option.value === genero)?.label ?? '—'

export const GENERO_TAB_TONES = {
  M: { text: 'text-sky-600', hover: 'hover:text-sky-600', indicator: 'bg-sky-500' },
  F: { text: 'text-pink-600', hover: 'hover:text-pink-600', indicator: 'bg-pink-500' },
}

export const GENERO_BADGE_CLASSES = {
  M: 'bg-sky-50 text-sky-700 border border-sky-200',
  F: 'bg-pink-50 text-pink-700 border border-pink-200',
}

// Valores de `Categoria.tipo` en el backend (TipoChoices)
export const TIPO_OPTIONS = [
  { value: 'juvenil', label: 'Juvenil' },
  { value: 'mayor', label: 'Mayor' },
]

export const getTipoLabel = (tipo) =>
  TIPO_OPTIONS.find((option) => option.value === tipo)?.label ?? '—'

const NO_AGE_LIMIT = 99

export const formatEdadMaxima = (edadMaxima) =>
  edadMaxima == null || edadMaxima === NO_AGE_LIMIT ? '—' : `${edadMaxima} años`

export const formatRangoEdad = (categoria) => {
  const { edad_minima: edadMinima, edad_maxima: edadMaxima } = categoria
  if (!edadMinima) return formatEdadMaxima(edadMaxima)
  return edadMaxima === NO_AGE_LIMIT ? `${edadMinima}+ años` : `${edadMinima} a ${edadMaxima} años`
}

// Misma regla que `Categoria.accepts_age`: edad que cumple en el año vigente dentro del rango de la categoría
export const categoriaAdmiteEdad = (categoria, anioNacimiento) => {
  const edad = categoria.anio_vigente - anioNacimiento
  return (categoria.edad_minima ?? 0) <= edad && edad <= categoria.edad_maxima
}
