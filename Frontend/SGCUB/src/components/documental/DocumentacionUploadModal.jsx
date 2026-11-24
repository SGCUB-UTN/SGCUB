import { useRef } from 'react'
import { Modal, Text } from '@mantine/core'
import { API_ORIGIN } from '../../api/conf'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import { claseInput } from '../socios/socioForm'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'

const mediaUrl = (ruta) => (ruta?.startsWith('http') ? ruta : `${API_ORIGIN}${ruta}`)

const INVALID_DATES_MESSAGE = 'La fecha de vencimiento debe ser posterior a la fecha de emisión.'

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
  error,
  saving = false,
  subtitle,
}) {
  const fileInputRef = useRef(null)

  const handleClearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''
    onChange({ target: { name: 'archivo', type: 'file', files: [] } })
  }

  const tipo = tipos.find((item) => String(item.id_tipo_documento) === String(form.tipo_documento))
  const requiresDueDate = Boolean(tipo?.requiere_vencimiento)
  const noDueDate = Boolean(form.sin_vencimiento) && !requiresDueDate
  const hasInvalidDates = Boolean(form.fecha_emision && form.fecha_vencimiento && form.fecha_vencimiento <= form.fecha_emision)
  const replacing = isEditing && form.archivoUrl_existing

  return (
    <Modal
      opened={isOpen}
      onClose={() => !saving && onClose()}
      centered
      size="lg"
      title={(
        <div className="flex flex-col gap-0.5">
          <Text fw={700} size="xl">{isEditing ? 'Editar documento' : 'Cargar documento'}</Text>
          {subtitle && <span className="text-sm text-on-surface-variant">{subtitle}</span>}
        </div>
      )}
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Campo id="document-type" label="Tipo de documento" requerido>
          <SelectConFlecha id="document-type" required name="tipo_documento" value={form.tipo_documento} onChange={onChange}>
            <option value="">Seleccioná un tipo</option>
            {tipos.map((item) => <option key={item.id_tipo_documento} value={item.id_tipo_documento}>{item.nombre}</option>)}
          </SelectConFlecha>
        </Campo>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo id="document-issue-date" label="Fecha de emisión">
            <input
              id="document-issue-date"
              type="date"
              name="fecha_emision"
              value={form.fecha_emision}
              max={shiftDate(form.fecha_vencimiento, -1)}
              onChange={onChange}
              className={claseInput(false)}
            />
          </Campo>
          <Campo id="document-due-date" label="Fecha de vencimiento" requerido={!noDueDate} error={hasInvalidDates ? INVALID_DATES_MESSAGE : ''}>
            <input
              id="document-due-date"
              type="date"
              name="fecha_vencimiento"
              required={!noDueDate}
              disabled={noDueDate}
              value={form.fecha_vencimiento}
              min={noDueDate ? undefined : shiftDate(form.fecha_emision, 1)}
              onChange={onChange}
              aria-invalid={hasInvalidDates || undefined}
              className={claseInput(hasInvalidDates, 'disabled:cursor-not-allowed disabled:opacity-50')}
            />
            <label
              className={`flex items-center gap-2 text-base text-on-surface-variant ${requiresDueDate ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              title={requiresDueDate ? 'Este tipo de documento siempre tiene vencimiento' : undefined}
            >
              <input
                type="checkbox"
                name="sin_vencimiento"
                checked={noDueDate}
                disabled={requiresDueDate}
                onChange={onChange}
                className="size-5 accent-primary cursor-pointer disabled:cursor-not-allowed shrink-0"
              />
              Sin vencimiento
            </label>
          </Campo>
        </div>

        {replacing && (
          <div className="bg-surface-container-low rounded-lg border border-outline-variant/40 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="material-symbols-outlined text-error text-2xl shrink-0" aria-hidden="true">picture_as_pdf</span>
              <div className="min-w-0">
                <p className="text-base font-semibold text-on-surface truncate">{tipo?.nombre || 'Documento actual'}</p>
                <p className="text-sm text-on-surface-variant">Archivo cargado actualmente</p>
              </div>
            </div>
            <a
              href={mediaUrl(form.archivoUrl_existing)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/10 transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">open_in_new</span>
              Ver PDF
            </a>
          </div>
        )}

        <Campo
          id="document-file"
          label={replacing ? 'Reemplazar archivo' : 'Archivo PDF'}
          opcional
        >
          <input id="document-file" type="file" name="archivo" accept=".pdf" onChange={onChange} ref={fileInputRef} className="sr-only" />
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-3 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-1.5">
              <SecondaryButton icon="upload_file" onClick={() => fileInputRef.current?.click()} className="h-9 shrink-0">
                Elegir archivo
              </SecondaryButton>
              <span className="text-base text-on-surface-variant truncate">
                {form.archivo ? `${form.archivo.name} (${(form.archivo.size / 1024).toFixed(0)} KB)` : 'Ningún archivo elegido'}
              </span>
            </div>
            {form.archivo && (
              <button
                type="button"
                onClick={handleClearFile}
                aria-label="Quitar el archivo elegido"
                title="Quitar el archivo elegido"
                className="size-10 shrink-0 rounded-lg border border-outline-variant/40 text-on-surface-variant hover:bg-error-container/40 hover:text-error flex items-center justify-center transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
              </button>
            )}
          </div>
        </Campo>

        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-error-container text-on-error-container border border-error/30 text-base" role="alert">
            <span className="material-symbols-outlined text-[20px] text-error shrink-0" aria-hidden="true">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
          <SecondaryButton onClick={onClose} disabled={saving}>Cancelar</SecondaryButton>
          <PrimaryButton type="submit" icon={saving ? 'progress_activity' : 'save'} disabled={saving}>
            {saving ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Cargar documento'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}
