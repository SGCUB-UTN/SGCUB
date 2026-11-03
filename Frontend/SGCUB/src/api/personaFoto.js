import { api } from './conf'

export async function uploadPersonaFoto(personaId, file) {
  if (!personaId) throw new Error('Falta el ID de la persona.')
  if (!file) throw new Error('Falta el archivo.')

  const formData = new FormData()
  formData.append('foto', file)

  const { data } = await api.post(`padron/persona/${personaId}/foto/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}