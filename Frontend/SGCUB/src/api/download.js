// Saves a PDF response with the name the backend sent in Content-Disposition
export const savePdfResponse = (response, fallbackName) => {
  const match = /filename="([^"]+)"/.exec(response.headers['content-disposition'] ?? '')
  const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = match ? match[1] : fallbackName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
