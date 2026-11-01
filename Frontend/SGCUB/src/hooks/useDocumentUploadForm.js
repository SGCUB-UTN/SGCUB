import { useState } from 'react'
import { collectErrorMessages } from '../components/personas/format'

const getEmptyUploadForm = (tipoDocumento = '') => ({
  tipo_documento: tipoDocumento,
  archivo: null,
  archivoUrl_existing: null,
  borrar_archivo: false,
  fecha_emision: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '',
  sin_vencimiento: false,
})

const addMonths = (date, months) => {
  const shifted = new Date(`${date}T00:00:00Z`)
  shifted.setUTCMonth(shifted.getUTCMonth() + months)
  return shifted.toISOString().split('T')[0]
}

const SAVE_ERROR_MESSAGE = 'No se pudo guardar el documento.'

const getSaveErrorMessage = (requestError) => {
  const data = requestError.response?.data
  if (!data) return requestError.response ? SAVE_ERROR_MESSAGE : 'No se pudo conectar con el servidor.'
  if (typeof data === 'string') return SAVE_ERROR_MESSAGE
  if (data.detail) return data.detail
  return collectErrorMessages(data).join(' ') || SAVE_ERROR_MESSAGE
}

export default function useDocumentUploadForm({ tipos, create, update }) {
  const [isOpen, setIsOpen] = useState(false)
  const [form, setForm] = useState(getEmptyUploadForm())
  const [target, setTarget] = useState({ personaId: null, document: null })
  const [error, setError] = useState(null)

  const findTipo = (tipoId) => tipos.find(t => String(t.id_tipo_documento) === String(tipoId))
  const requiresDueDate = (tipoId) => Boolean(findTipo(tipoId)?.requiere_vencimiento)

  const suggestedDueDate = (current) => {
    const tipo = findTipo(current.tipo_documento)
    return tipo?.vigencia_meses && current.fecha_emision ? addMonths(current.fecha_emision, tipo.vigencia_meses) : ''
  }

  const openNew = (personaId, tipoId = '') => {
    const emptyForm = getEmptyUploadForm(tipoId)
    setTarget({ personaId, document: null })
    setForm({ ...emptyForm, fecha_vencimiento: suggestedDueDate(emptyForm) })
    setError(null)
    setIsOpen(true)
  }

  const openEdit = (doc) => {
    setTarget({ personaId: doc.persona, document: doc })
    setForm({
      tipo_documento: doc.tipo_documento || '',
      archivo: null,
      archivoUrl_existing: doc.archivoUrl || null,
      borrar_archivo: false,
      fecha_emision: doc.fecha_emision ? doc.fecha_emision.split('T')[0] : '',
      fecha_vencimiento: doc.fecha_vencimiento ? doc.fecha_vencimiento.split('T')[0] : '',
      sin_vencimiento: !doc.fecha_vencimiento && !requiresDueDate(doc.tipo_documento),
    })
    setError(null)
    setIsOpen(true)
  }

  const close = () => setIsOpen(false)

  const handleChange = (e) => {
    const { name, value, type, files, checked } = e.target
    if (type === 'file') {
      setForm(prev => ({ ...prev, archivo: files.length > 0 ? files[0] : null }))
    } else if (name === 'sin_vencimiento') {
      setForm(prev => ({ ...prev, sin_vencimiento: checked, fecha_vencimiento: checked ? '' : suggestedDueDate(prev) }))
    } else if (type === 'checkbox') {
      setForm(prev => ({ ...prev, [name]: checked }))
    } else {
      setForm(prev => {
        const next = { ...prev, [name]: value }
        if (name === 'tipo_documento' && requiresDueDate(value)) next.sin_vencimiento = false
        // The due date follows the type's default validity until the user types a different one
        const followsSuggestion = !prev.fecha_vencimiento || prev.fecha_vencimiento === suggestedDueDate(prev)
        if ((name === 'tipo_documento' || name === 'fecha_emision') && followsSuggestion && !next.sin_vencimiento) {
          next.fecha_vencimiento = suggestedDueDate(next)
        }
        return next
      })
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    const isEditing = Boolean(target.document)
    try {
      const formData = new FormData()
      formData.append('persona', target.personaId)
      formData.append('tipo_documento', form.tipo_documento)

      const appendDate = (field) => {
        if (form[field]) formData.append(field, `${form[field]}T00:00:00`)
        else if (isEditing) formData.append(field, '')
      }
      appendDate('fecha_emision')
      appendDate('fecha_vencimiento')
      if (form.archivo) {
        formData.append('archivoUrl', form.archivo)
      } else if (isEditing && form.borrar_archivo) {
        formData.append('archivoUrl', '')
      }

      if (isEditing) {
        await update(target.document.id_documento, formData)
      } else {
        await create(formData)
      }
      setIsOpen(false)
      setForm(getEmptyUploadForm())
      setTarget({ personaId: null, document: null })
    } catch (requestError) {
      console.error('Error uploading document:', requestError)
      setError(getSaveErrorMessage(requestError))
    }
  }

  return {
    isOpen,
    form,
    isEditing: Boolean(target.document),
    error,
    openNew,
    openEdit,
    close,
    handleChange,
    handleSubmit,
  }
}
