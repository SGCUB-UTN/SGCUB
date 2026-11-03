export async function downloadImage(url, filename = 'foto.jpg') {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`No se pudo descargar la imagen (HTTP ${response.status}).`)

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(objectUrl), 500)
}

/** Genera un nombre de archivo prolijo a partir de nombre/apellido y la URL original. */
export function buildPhotoFilename(photoUrl, nombre, apellido) {
  const extension = (photoUrl?.match(/\.(jpe?g|png|webp)(?:\?|$)/i)?.[1] ?? 'jpg').toLowerCase()
  const clean = (value) => (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')      // quita acentos
    .replace(/[^a-zA-Z0-9]+/g, '-')        // reemplaza por guiones
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  const partes = [clean(apellido), clean(nombre)].filter(Boolean)
  const base = partes.length ? partes.join('-') : 'persona'
  return `foto-${base}.${extension}`
}