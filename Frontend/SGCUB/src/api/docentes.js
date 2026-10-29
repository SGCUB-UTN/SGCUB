import { api } from './conf'

const docentesEndpoint = 'padron/docente/'

export const getDocentes = async () => {
  const response = await api.get(docentesEndpoint)
  return response.data
}

export const getDocente = async (docenteId) => {
  const response = await api.get(`${docentesEndpoint}${docenteId}/`)
  return response.data
}

export const postDocente = async (docente) => {
  const response = await api.post(docentesEndpoint, docente)
  return response.data
}

export const patchDocente = async (docenteId, docente) => {
  const response = await api.patch(`${docentesEndpoint}${docenteId}/`, docente  )
  return response.data
}

export const deactivateDocente = async (docenteId) => {
  await api.delete(`${docentesEndpoint}${docenteId}/`)
}

export const activateDocente = async (docenteId, asignaciones) => {
  const { data: estados } = await api.get('padron/estado-socio/')
  const activo = estados.find((estado) => estado.nombre === 'Activo')
  return patchDocente(docenteId, { estado: activo?.estado_id, ...(asignaciones && { asignaciones }) })
}

export const getCargosDocente = async () => {
  const response = await api.get('padron/cargo-docente/')
  return response.data
}

export const postCargoDocente = async (cargo) => {
  const response = await api.post('padron/cargo-docente/', cargo)
  return response.data
}

export const patchCargoDocente = async (cargoId, cargo) => {
  const response = await api.patch(`padron/cargo-docente/${cargoId}/`, cargo)
  return response.data
}

export const deleteCargoDocente = async (cargoId) => {
  await api.delete(`padron/cargo-docente/${cargoId}/`)
}