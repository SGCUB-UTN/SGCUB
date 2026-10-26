import { useEffect, useRef } from 'react'
import { API_ORIGIN } from '../../api/conf'

const mediaUrl = (ruta) => (ruta?.startsWith('http') ? ruta : `${API_ORIGIN}${ruta}`)

const INVALID_DATES_MESSAGE = 'La fecha de vencimiento debe ser posterior a la fecha de emisión'

const shiftDate = (date, days) => {
  if (!date) return undefined
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCDate(shifted.getUTCDate() + days)
  return shifted.toISOString().split('T')[0]
}

export default function DocumentacionUploadModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  form, 
  onChange, 
  tipos, 
  isEditing,
  error
}) {
  const fileInputRef = useRef(null)

  const handleClearFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onChange({ target: { name: 'archivo', type: 'file', files: [] } })
  }

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = 'auto' }
    }
  }, [isOpen])

  if (!isOpen) return null;

  const requiresDueDate = Boolean(tipos.find(t => String(t.id_tipo_documento) === String(form.tipo_documento))?.requiere_vencimiento)
  const hasInvalidDates = Boolean(form.fecha_emision && form.fecha_vencimiento && form.fecha_vencimiento <= form.fecha_emision)

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-inverse-surface/40 backdrop-blur-sm flex items-center justify-center p-space-md"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface-container-lowest rounded-xl max-w-md w-full p-space-lg shadow-xl flex flex-col gap-space-md max-h-[90vh] overflow-y-auto">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">{isEditing ? 'Editar documentación' : 'Cargar nueva documentación'}</h3>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-label-sm text-outline uppercase mb-1">Tipo de Documento</label>
            <select required name="tipo_documento" value={form.tipo_documento} onChange={onChange} className="w-full h-10 px-3 rounded-lg bg-surface-container-low border-none cursor-pointer focus:ring-2 focus:ring-primary-container outline-none">
              <option value="">Seleccione...</option>
              {tipos.map(t => (
                <option key={t.id_tipo_documento} value={t.id_tipo_documento}>{t.nombre}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-label-sm text-outline uppercase mb-1">Fecha Emisión</label>
              <input type="date" name="fecha_emision" value={form.fecha_emision} max={shiftDate(form.fecha_vencimiento, -1)} onChange={onChange} className="w-full h-10 px-3 rounded-lg bg-surface-container-low border-none cursor-pointer focus:ring-2 focus:ring-primary-container outline-none" />
            </div>
            <div>
              <label className="block text-label-sm text-outline uppercase mb-1">Fecha Vencimiento{requiresDueDate && ' *'}</label>
              <input type="date" name="fecha_vencimiento" required={requiresDueDate} value={form.fecha_vencimiento} min={shiftDate(form.fecha_emision, 1)} onChange={onChange} className="w-full h-10 px-3 rounded-lg bg-surface-container-low border-none cursor-pointer focus:ring-2 focus:ring-primary-container outline-none" />
            </div>
            {hasInvalidDates && (
              <p className="col-span-2 -mt-2 text-sm text-error" role="alert">{INVALID_DATES_MESSAGE}</p>
            )}
          </div>
          
            {isEditing && form.archivoUrl_existing && (
              <div className="bg-surface-container-low rounded-lg border border-outline-variant/40 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-error text-2xl shrink-0">picture_as_pdf</span>
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-on-surface truncate">
                      {tipos.find(t => String(t.id_tipo_documento) === String(form.tipo_documento))?.nombre || 'Documento actual'}
                    </p>
                    <p className="text-sm text-on-surface-variant">Documento cargado actualmente</p>
                  </div>
                </div>
                <a
                  href={mediaUrl(form.archivoUrl_existing)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/10 transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  Ver PDF
                </a>
              </div>
            )}
          <div>
            <label className="block text-label-sm text-outline uppercase mb-1">{isEditing && form.archivoUrl_existing ? 'Reemplazar archivo (Opcional)' : 'Archivo PDF'}</label>
            <div className="relative w-full flex items-center gap-2">
              <input 
                type="file" 
                name="archivo" 
                accept=".pdf"
                onChange={onChange}
                ref={fileInputRef}
                className="hidden"
              />
              <div className="relative flex-1 min-w-0 flex items-center bg-surface-container-low rounded-lg p-1.5 border border-outline-variant/40">
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()} 
                  className="inline-flex items-center gap-2 h-9 px-4 bg-primary text-on-primary hover:bg-primary/90 rounded-md text-sm font-semibold shadow-sm transition-colors cursor-pointer shrink-0"
                >
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                  <span>Seleccionar</span>
                </button>
                <span className="ml-4 mr-2 text-sm text-on-surface-variant truncate">
                  {form.archivo ? form.archivo.name : 'Ningún archivo seleccionado'}
                </span>
              </div>
              {form.archivo && (
                <button 
                  type="button" 
                  onClick={handleClearFile}
                  className="w-10 h-10 shrink-0 rounded-lg bg-surface-container-high hover:bg-error-container text-on-surface-variant hover:text-error flex items-center justify-center transition-colors cursor-pointer"
                  title="Quitar archivo seleccionado"
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </button>
              )}
            </div>
            {form.archivo && (
              <p className="text-sm text-on-surface-variant mt-1">
                {form.archivo.name} ({(form.archivo.size / 1024).toFixed(0)} KB)
              </p>
            )}
            
          </div>
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container text-error text-sm" role="alert">
              <span className="material-symbols-outlined text-[20px]" aria-hidden="true">error</span>
              <span>{error}</span>
            </div>
          )}
          <div className="flex items-center justify-end gap-space-sm mt-4">
            <button type="button" onClick={onClose} className="px-space-md h-10 rounded-lg bg-surface-container text-on-surface font-title-md hover:bg-surface-container-high transition-colors cursor-pointer">Cancelar</button>
            <button type="submit" className="px-space-md h-10 rounded-lg bg-primary text-on-primary font-title-md hover:bg-primary/90 transition-colors cursor-pointer">{isEditing ? 'Guardar Cambios' : 'Cargar Documento'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
