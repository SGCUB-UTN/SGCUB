import { useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { putBeca } from '../../api/becas'
import { putDescuento } from '../../api/cuotas'
import { getErrorMessage } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { claseInput } from '../socios/socioForm'
import { Campo } from '../socios/SocioFormFields'
import { AmountModeInput, AuthorizerSelect, SUBMIT_BUTTON_CLASS } from './formParts'
import { FIXED, PERCENTAGE, SCHOLARSHIP_TARGET, benefitPayload, benefitValueError, remainingWithoutFees, roundCents } from './benefitMath'

const REASON_MAX_LENGTH = 140

const MODAL_Z_INDEX = 300

const initialValues = (target) => {
  if (target.kind === SCHOLARSHIP_TARGET) {
    const { beca } = target
    return {
      mode: beca.porcentaje != null ? PERCENTAGE : FIXED,
      value: String(Number(beca.porcentaje ?? beca.monto)),
      startDate: beca.fecha_aplicacion,
      endDate: beca.fecha_fin ?? '',
      noEndDate: !beca.fecha_fin,
      reason: beca.motivo ?? '',
    }
  }
  return { mode: FIXED, value: String(Number(target.item.monto)), startDate: '', endDate: '', noEndDate: true, reason: target.item.motivo ?? '' }
}

function EditBenefitForm({ target, onCancel, onSaved }) {
  const isScholarship = target.kind === SCHOLARSHIP_TARGET
  const [values, setValues] = useState(() => initialValues(target))
  const [authorizer, setAuthorizer] = useState('')
  const [showErrors, setShowErrors] = useState(false)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const change = (changes) => setValues((current) => ({ ...current, ...changes }))
  const numericValue = Number(values.value)
  const maxDiscount = isScholarship ? null : roundCents(remainingWithoutFees(target.cuota) + Number(target.item.monto))

  const errors = {
    startDate: isScholarship && !values.startDate ? 'Indicá desde cuándo rige la beca.' : '',
    endDate: (() => {
      if (!isScholarship || values.noEndDate) return ''
      if (!values.endDate) return 'Indicá hasta cuándo rige o marcá "Sin fecha de finalización".'
      return values.endDate < values.startDate ? 'No puede ser anterior a la fecha de inicio.' : ''
    })(),
    value: benefitValueError(values.mode, numericValue, maxDiscount),
    authorizer: !authorizer ? 'Elegí quién autoriza el cambio.' : '',
    reason: !values.reason.trim() ? 'Indicá el motivo.' : '',
  }
  const fieldError = (key) => (showErrors ? errors[key] : '')

  const submit = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    setShowErrors(true)
    if (Object.values(errors).some(Boolean)) return
    setSaving(true)
    setSubmitError('')
    const payload = benefitPayload(values.mode, numericValue, values.reason, authorizer)
    try {
      if (isScholarship) {
        await putBeca(target.beca.beca_id, {
          ...payload,
          fecha_aplicacion: values.startDate,
          fecha_fin: values.noEndDate ? null : values.endDate,
        })
      } else {
        await putDescuento(target.item.item_cuota_id, payload)
      }
      onSaved()
    } catch (error) {
      setSubmitError(getErrorMessage(error, isScholarship ? 'No se pudo modificar la beca.' : 'No se pudo modificar el descuento.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <p className="text-base text-on-surface-variant">
        {isScholarship
          ? 'Los cambios se aplican a las cuotas impagas sin pagos registrados. Las cuotas pagas no se modifican.'
          : <>El descuento de la cuota <strong className="text-on-surface">{formatPeriod(target.cuota.periodo)}</strong> se reemplaza por el nuevo valor.</>}
      </p>

      {isScholarship && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <Campo id="edit-benefit-start" label="Desde" requerido error={fieldError('startDate')}>
            <input
              id="edit-benefit-start"
              type="date"
              value={values.startDate}
              onChange={(event) => change({ startDate: event.target.value })}
              className={claseInput(Boolean(fieldError('startDate')))}
            />
          </Campo>
          <Campo id="edit-benefit-end" label="Hasta" requerido={!values.noEndDate} error={fieldError('endDate')}>
            <input
              id="edit-benefit-end"
              type="date"
              min={values.startDate}
              value={values.endDate}
              onChange={(event) => change({ endDate: event.target.value })}
              disabled={values.noEndDate}
              className={claseInput(Boolean(fieldError('endDate')))}
            />
            <label className="self-start flex items-center gap-2 text-sm font-medium text-on-surface-variant cursor-pointer">
              <input
                type="checkbox"
                checked={values.noEndDate}
                onChange={(event) => change({ noEndDate: event.target.checked, ...(event.target.checked && { endDate: '' }) })}
                className="h-4 w-4 accent-primary"
              />
              Sin fecha de finalización
            </label>
          </Campo>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-base font-semibold text-on-surface">Valor <span className="text-error font-bold">*</span></span>
        <AmountModeInput
          mode={values.mode}
          value={values.value}
          onModeChange={(mode) => change({ mode, value: '' })}
          onValueChange={(value) => change({ value })}
          invalid={Boolean(fieldError('value'))}
        />
        {fieldError('value') && <p className="text-sm text-error font-medium" role="alert">{errors.value}</p>}
      </div>

      <Campo id="edit-benefit-authorizer" label="Autorizado por" requerido error={fieldError('authorizer')}>
        <AuthorizerSelect id="edit-benefit-authorizer" value={authorizer} onChange={setAuthorizer} invalid={Boolean(fieldError('authorizer'))} />
      </Campo>

      <Campo id="edit-benefit-reason" label="Motivo" requerido error={fieldError('reason')}>
        <input
          id="edit-benefit-reason"
          type="text"
          value={values.reason}
          onChange={(event) => change({ reason: event.target.value })}
          maxLength={REASON_MAX_LENGTH}
          className={claseInput(Boolean(fieldError('reason')))}
        />
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
          Volver
        </button>
        <button type="submit" disabled={saving} className={SUBMIT_BUTTON_CLASS}>
          <span className="material-symbols-outlined text-base" aria-hidden="true">{saving ? 'progress_activity' : 'save'}</span>
          <span>{saving ? 'Guardando...' : 'Guardar cambios'}</span>
        </button>
      </div>
    </form>
  )
}

function EditBenefitModal({ target, onClose, onSaved }) {
  const isScholarship = target?.kind === SCHOLARSHIP_TARGET
  return (
    <Modal
      opened={Boolean(target)}
      onClose={onClose}
      title={<Text fw={700} size="xl">{isScholarship ? 'Editar beca' : 'Editar descuento'}</Text>}
      size="lg"
      centered
      zIndex={MODAL_Z_INDEX}
    >
      {target && (
        <EditBenefitForm
          target={target}
          onCancel={onClose}
          onSaved={() => {
            onClose()
            onSaved?.()
          }}
        />
      )}
    </Modal>
  )
}

export default EditBenefitModal
