import { isActiveStatus } from '../personas/format'

const nombreCargo =(cargo) => (typeof cargo === 'string' ? cargo : cargo?.nombre)

export const cargosDe = (asignaciones = []) =>
  [...new Set(asignaciones.map((asignacion) => nombreCargo(asignacion.cargo)).filter(Boolean))]

const GENERO_CATEGORIA = { M: 'Masculino', F: 'Femenino' }

export const etiquetaCategoria = (categoria) => {
  const genero = GENERO_CATEGORIA[categoria.genero]
  return genero ? `${categoria.nombre} · ${genero}` : categoria.nombre
}

export const esCategoriaAsignable = (categoria) => categoria.nombre !== 'No asignado'

export const esActivo = (docente) => isActiveStatus(docente.estado_nombre)

export const categoriasDeAsignaciones = (asignaciones = []) =>
  asignaciones.flatMap(({ cargo_nombre: cargo, categorias = [] }) => categorias.map((categoria) => ({ ...categoria, cargo })))

export const idsCategorias = (asignacion) => asignacion.categorias.map((categoria) => String(categoria.categoria_id))

export const validateCargo = (cargo, seleccionadas) => {
  if (!cargo) return 'Seleccione un cargo.'
  if (seleccionadas.length === 0) return 'Seleccione al menos una categoría.'
  return ''
}
