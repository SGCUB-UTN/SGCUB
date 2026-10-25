import { useMemo, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { SUBMIT_BUTTON_CLASS } from '../finanzas/formParts'
import { getErrorMessage } from '../personas/format'
import { Campo, SelectConFlecha } from '../socios/SocioFormFields'
import { categoryName, eligibleCategories } from './recategorization'

function SummaryItem({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}

function EditRecategorizationForm({ result, categories, onConfirm, onCancel }) {
  const [mainCategory, setMainCategory] = useState(String(result.categoria_actual?.id ?? ''))
  const [secondaryCategory, setSecondaryCategory] = useState(String(result.categoria_secundaria_actual?.id ?? ''))
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const mainCategoryError = !mainCategory ? 'Elegí la categoría principal.' : ''

  const options = useMemo(
    () => eligibleCategories(categories, result, [mainCategory, secondaryCategory])
      .slice()
      .sort((first, second) => first.genero.localeCompare(second.genero) || first.edad_maxima - second.edad_maxima),
    [categories, result, mainCategory, secondaryCategory],
  )
  const optionLabel = (category) => (result.genero ? category.nombre : `${category.nombre} (${category.genero || 'sin género'})`)
  const secondaryOptions = options.filter((category) => String(category.categoria_id) !== mainCategory)

  const changeMainCategory = (value) => {
    setMainCategory(value)
    if (value === secondaryCategory) setSecondaryCategory('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setShowErrors(true)
    if (mainCategoryError) return
    setSaving(true)
    setSubmitError('')
    try {
      await onConfirm({
        categoria: Number(mainCategory),
        categoria_secundaria: secondaryCategory ? Number(secondaryCategory) : null,
      })
    } catch (error) {
      setSubmitError(getErrorMessage(error, 'No se pudieron guardar las categorías.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-3">
        <SummaryItem label="Jugador" value={result.jugador} />
        <SummaryItem label="DNI" value={result.dni} />
        <SummaryItem label="Año de nacimiento" value={result.anio_nacimiento ?? 'Sin fecha'} />
        <SummaryItem label="Principal anterior" value={categoryName(result.categoria_anterior)} />
        <SummaryItem label="Secundaria anterior" value={categoryName(result.categoria_secundaria_anterior)} />
        {result.categoria_sugerida && <SummaryItem label="Sugerida" value={categoryName(result.categoria_sugerida)} />}
      </dl>

      {result.detalle && <p className="text-sm text-slate-600">{result.detalle}</p>}

      <Campo id="recategorization-main-category" label="Categoría principal" requerido error={showErrors ? mainCategoryError : ''}>
        <SelectConFlecha
          id="recategorization-main-category"
          value={mainCategory}
          onChange={(event) => changeMainCategory(event.target.value)}
          conError={showErrors && Boolean(mainCategoryError)}
        >
          <option value="">Seleccioná una categoría</option>
          {options.map((category) => (
            <option key={category.categoria_id} value={category.categoria_id}>{optionLabel(category)}</option>
          ))}
        </SelectConFlecha>
      </Campo>

      <Campo id="recategorization-secondary-category" label="Categoría secundaria" opcional>
        <SelectConFlecha
          id="recategorization-secondary-category"
          value={secondaryCategory}
          onChange={(event) => setSecondaryCategory(event.target.value)}
        >
          <option value="">Sin categoría secundaria</option>
          {secondaryOptions.map((category) => (
            <option key={category.categoria_id} value={category.categoria_id}>{optionLabel(category)}</option>
          ))}
        </SelectConFlecha>
      </Campo>

      {submitError && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5" role="alert">
          <span className="material-symbols-outlined text-base text-error shrink-0" aria-hidden="true">error</span>
          <p className="text-sm break-words">{submitError}</p>
        </div>
      )}

      <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40 cursor-pointer"
        >
          Cancelar
        </button>
        <button type="submit" disabled={saving} className={SUBMIT_BUTTON_CLASS}>
          <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`} aria-hidden="true">
            {saving ? 'progress_activity' : 'save'}
          </span>
          <span>{saving ? 'Guardando...' : 'Guardar categorías'}</span>
        </button>
      </div>
    </form>
  )
}

export default function EditRecategorizationModal({ result, categories, onConfirm, onClose }) {
  return (
    <Modal
      opened={Boolean(result)}
      onClose={onClose}
      title={<Text fw={700} size="xl">Corregir categorías</Text>}
      centered
      size="lg"
    >
      {result && (
        <EditRecategorizationForm
          key={result.id}
          result={result}
          categories={categories}
          onConfirm={onConfirm}
          onCancel={onClose}
        />
      )}
    </Modal>
  )
}
