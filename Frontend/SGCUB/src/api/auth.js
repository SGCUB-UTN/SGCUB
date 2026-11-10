import { api } from './conf'
import { clearTokens, getRefreshToken, setTokens } from '../auth/tokens'

const authEndpoint = 'auth/'

export const login = async (dni, password) => {
  const response = await api.post(`${authEndpoint}login/`, { username: dni, password })
  setTokens(response.data)
}

export const logout = async () => {
  const refresh = getRefreshToken()
  clearTokens()
  if (!refresh) return

  try {
    // Invalida el refresh en el backend para que no pueda reutilizarse
    await api.post(`${authEndpoint}logout/`, { refresh })
  } catch {
    // La sesión local ya se cerró; si falla, el refresh vence solo
  }
}

// Devuelve { id, username, full_name, roles, permissions, is_superuser }
export const getCurrentUser = async () => {
  const response = await api.get(`${authEndpoint}me/`)
  return response.data
}

export const changePassword = async (currentPassword, newPassword) => {
  const data = { new_password: newPassword }
  if (currentPassword) data.current_password = currentPassword
  await api.post(`${authEndpoint}change-password/`, data)
}

export async function requestPasswordReset(email) {
  const { data } = await api.post('auth/password-reset/', { email })
  return data
}

export async function confirmPasswordReset({ uid, token, newPassword }) {
  const { data } = await api.post('auth/password-reset/confirm/', {
    uid,
    token,
    new_password: newPassword,
  })
  return data
}