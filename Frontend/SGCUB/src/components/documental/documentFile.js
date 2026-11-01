const FILE_MISSING_MESSAGE = 'El archivo físico ya no existe o fue eliminado del servidor.'

const getMediaUrl = (path) => {
  if (path.startsWith('http')) return path
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/'
  return `${baseUrl.replace(/\/api\/?$/, '')}${path}`
}

export const openFile = async (path) => {
  const url = getMediaUrl(path)
  try {
    const response = await fetch(url, { method: 'HEAD' })
    if (response.ok) window.open(url, '_blank')
    else alert(FILE_MISSING_MESSAGE)
  } catch {
    alert(FILE_MISSING_MESSAGE)
  }
}
