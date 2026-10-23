import { api } from './conf'

const usuariosEndpoint = 'usuarios/'

export const getUsuarios = async () => {
  const response = await api.get(usuariosEndpoint)
  return response.data
}

export const getAutorizantes = async () => {
  const response = await api.get(`${usuariosEndpoint}autorizantes/`)
  return response.data
}

export const getRoles = async () => {
  const response = await api.get(`${usuariosEndpoint}roles/`)
  return response.data
}

// usuario: { dni, first_name, last_name, email, role }. La contraseña inicial es el DNI.
export const postUsuario = async (usuario) => {
  const response = await api.post(usuariosEndpoint, usuario)
  return response.data
}

export const patchUsuario = async (usuarioId, usuario) => {
  const response = await api.patch(`${usuariosEndpoint}${usuarioId}/`, usuario)
  return response.data
}

// Baja lógica: el usuario deja de poder ingresar
export const deactivateUsuario = async (usuarioId) => {
  await api.delete(`${usuariosEndpoint}${usuarioId}/`)
}

export const activateUsuario = async (usuarioId) => {
  const response = await api.post(`${usuariosEndpoint}${usuarioId}/activate/`)
  return response.data
}

// La contraseña vuelve a ser el DNI del usuario
export const resetUsuarioPassword = async (usuarioId) => {
  await api.post(`${usuariosEndpoint}${usuarioId}/reset-password/`)
}
