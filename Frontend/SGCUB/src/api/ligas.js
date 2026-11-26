import { api } from './conf'

const ligasEndpoint = 'padron/liga/'

export const getLigas = async () => (await api.get(ligasEndpoint)).data
export const getLiga = async (ligaId) => (await api.get(`${ligasEndpoint}${ligaId}/`)).data
export const postLiga = async (data) => (await api.post(ligasEndpoint, data)).data
export const patchLiga = async (ligaId, data) => (await api.patch(`${ligasEndpoint}${ligaId}/`, data)).data
export const deleteLiga = async (ligaId) => (await api.delete(`${ligasEndpoint}${ligaId}/`)).data
