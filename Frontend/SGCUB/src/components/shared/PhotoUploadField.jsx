import { useEffect, useRef, useState } from 'react'

const MAX_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function PhotoUploadField({ value, onChange, disabled = false, currentUrl = null }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [imgError, setImgError] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!value) {
      setPreview(null)
      return undefined
    }
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  useEffect(() => {
    // Reset del fallback si cambia la fuente (nueva foto elegida o persona distinta)
    setImgError(false)
  }, [preview, currentUrl])

  const displaySrc = !imgError ? (preview || currentUrl) : null
  const hasAnyPhoto = Boolean(displaySrc)

  const handleSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    setLocalError('')

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError('Formato no soportado. Usá JPG, PNG o WEBP.')
      event.target.value = ''
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setLocalError(`La imagen no puede superar los ${MAX_SIZE_MB} MB.`)
      event.target.value = ''
      return
    }

    onChange(file)
  }

  const handleClear = () => {
    onChange(null)
    setLocalError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        <div className={`w-20 h-20 rounded-full overflow-hidden border-2 ${localError ? 'border-error' : 'border-outline-variant/40'} bg-surface-container-low flex items-center justify-center text-outline shrink-0`}>
          {displaySrc ? (
            <img
              src={displaySrc}
              alt="Vista previa"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="material-symbols-outlined text-[32px]">photo_camera</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              {hasAnyPhoto ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm font-medium text-error hover:bg-error-container/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Descarta la imagen seleccionada y vuelve a la actual"
              >
                <span className="material-symbols-outlined text-base">close</span>
                Descartar
              </button>
            )}
          </div>
          <p className="text-sm text-on-surface-variant">
            {currentUrl && !value
              ? 'Foto actual. Elegí un archivo para reemplazarla.'
              : `Opcional. JPG, PNG o WEBP, hasta ${MAX_SIZE_MB} MB. La imagen se ajusta automáticamente.`}
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="hidden"
        onChange={handleSelect}
        disabled={disabled}
      />
      {localError && <p className="text-sm text-error font-medium">{localError}</p>}
    </div>
  )
}