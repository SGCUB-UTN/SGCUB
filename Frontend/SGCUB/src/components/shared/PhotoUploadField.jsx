import { useEffect, useRef, useState } from 'react'

const MAX_SIZE_MB = 5
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export default function PhotoUploadField({
  value,
  onChange,
  disabled = false,
  currentUrl = null,
  onDeleteCurrent = null,
  isDeleted = false,
  onRestoreCurrent = null,
}) {
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
  }, [preview, currentUrl, isDeleted])

  const displaySrc = !isDeleted && !imgError ? (preview || currentUrl) : null
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
        <div className={`w-20 h-20 rounded-full overflow-hidden border-2 ${localError ? 'border-error' : isDeleted ? 'border-error/40 border-dashed' : 'border-outline-variant/40'} bg-surface-container-low flex items-center justify-center text-outline shrink-0`}>
          {displaySrc ? (
            <img
              src={displaySrc}
              alt="Vista previa"
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="material-symbols-outlined text-[32px] text-outline">photo_camera</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              {hasAnyPhoto ? 'Cambiar imagen' : 'Subir imagen'}
            </button>
            {value && currentUrl && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded text-sm font-medium border border-error/40 text-error hover:bg-error-container/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Descartar imagen seleccionada y volver a la actual"
              >
                <span className="material-symbols-outlined text-base">undo</span>
                Conservar foto actual
              </button>
            )}
            {value && !currentUrl && (
              <button
                type="button"
                onClick={handleClear}
                disabled={disabled}
                className="inline-flex items-center justify-center h-9 w-9 rounded border border-error/40 text-error hover:bg-error-container/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Descartar imagen seleccionada"
                aria-label="Descartar imagen seleccionada"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            {!value && currentUrl && !isDeleted && onDeleteCurrent && (
              <button
                type="button"
                onClick={onDeleteCurrent}
                disabled={disabled}
                className="inline-flex items-center justify-center h-9 w-9 rounded border border-error/40 text-error hover:bg-error-container/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                title="Eliminar foto actual"
                aria-label="Eliminar foto actual"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
            {isDeleted && onRestoreCurrent && (
              <button
                type="button"
                onClick={onRestoreCurrent}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded text-sm font-medium border border-error/40 text-error hover:bg-error-container/40 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-base">undo</span>
                Conservar foto actual
              </button>
            )}
          </div>
          <p className="text-sm text-on-surface-variant">
            {isDeleted
              ? 'Foto actual marcada para eliminar al guardar.'
              : value && currentUrl
              ? 'Nueva foto seleccionada. Podés conservarla o volver a la actual.'
              : currentUrl && !value
              ? 'Foto actual. Podés reemplazarla o eliminarla.'
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