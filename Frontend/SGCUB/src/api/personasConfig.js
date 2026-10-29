import { api } from './conf'

// Cargos docentes
export const getCargosDocente = async () => (await api.get('padron/cargo-docente/')).data
export const postCargoDocente = async (data) => (await api.post('padron/cargo-docente/', data)).data
export const patchCargoDocente = async (id, data) => (await api.patch(`padron/cargo-docente/${id}/`, data)).data
export const deleteCargoDocente = async (id) => (await api.delete(`padron/cargo-docente/${id}/`)).data

// Localidades
export const getLocalidades = async () => (await api.get('padron/localidad/')).data
export const postLocalidad = async (data) => (await api.post('padron/localidad/', data)).data
export const patchLocalidad = async (id, data) => (await api.patch(`padron/localidad/${id}/`, data)).data
export const deleteLocalidad = async (id) => (await api.delete(`padron/localidad/${id}/`)).data

// Barrios
export const getBarrios = async (localidadId = null) => {
  const params = localidadId ? { localidad: localidadId } : {}
  return (await api.get('padron/barrio/', { params })).data
}
export const postBarrio = async (data) => (await api.post('padron/barrio/', data)).data
export const patchBarrio = async (id, data) => (await api.patch(`padron/barrio/${id}/`, data)).data
export const deleteBarrio = async (id) => (await api.delete(`padron/barrio/${id}/`)).data

// Tipos de relaciones familiares
export const getTiposRelacionFamiliar = async () => (await api.get('padron/tipo-relacion-familiar/')).data
export const postTipoRelacionFamiliar = async (data) => (await api.post('padron/tipo-relacion-familiar/', data)).data
export const patchTipoRelacionFamiliar = async (id, data) => (await api.patch(`padron/tipo-relacion-familiar/${id}/`, data)).data
export const deleteTipoRelacionFamiliar = async (id) => (await api.delete(`padron/tipo-relacion-familiar/${id}/`)).data

// Obras Sociales
export const getObrasSociales = async () => (await api.get('padron/obra-social/')).data
export const postObraSocial = async (data) => (await api.post('padron/obra-social/', data)).data
export const patchObraSocial = async (id, data) => (await api.patch(`padron/obra-social/${id}/`, data)).data
export const deleteObraSocial = async (id) => (await api.delete(`padron/obra-social/${id}/`)).data

// Talles de Indumentaria
export const getTallesIndumentaria = async () => (await api.get('padron/talle-indumentaria/')).data
export const postTalleIndumentaria = async (data) => (await api.post('padron/talle-indumentaria/', data)).data
export const patchTalleIndumentaria = async (id, data) => (await api.patch(`padron/talle-indumentaria/${id}/`, data)).data
export const deleteTalleIndumentaria = async (id) => (await api.delete(`padron/talle-indumentaria/${id}/`)).data

