export const FILE_MISSING_TOAST = {
  tone: 'error',
  title: 'No se encontró el archivo',
  description: 'El archivo ya no existe o fue eliminado del servidor.',
}

const getMediaUrl = (path) => {
  if (path.startsWith('http')) return path
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'
  return `${baseUrl.replace(/\/api\/?$/, '')}${path}`
}

export const openFile = async (path, onMissing) => {
  const url = getMediaUrl(path)
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok) window.open(url, '_blank')
    else onMissing?.()
  } catch {
    onMissing?.()
  }
}
