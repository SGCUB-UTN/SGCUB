export const saveFileResponse = (response, fallbackName, type) => {
  const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] ?? '')
  const url = URL.createObjectURL(new Blob([response.data], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = match ? match[1] : fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const errorDetailFrom = async (requestError) => {
  const data = requestError.response?.data
  if (!(data instanceof Blob)) return requestError
  try {
    requestError.response.data = JSON.parse(await data.text())
  } catch {
    requestError.response.data = null
  }
  return requestError
}

export const savePdfResponse = (response, fallbackName) => saveFileResponse(response, fallbackName, 'application/pdf')
