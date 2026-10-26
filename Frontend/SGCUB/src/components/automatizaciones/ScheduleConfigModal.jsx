import { useState } from 'react'
import { Modal, Select, Stack, Text, TextInput } from '@mantine/core'
import { getAutomationInfo } from './automationCatalog'

const BUTTON_CLASS = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-base font-semibold transition-colors disabled:cursor-wait disabled:opacity-60'

// Values of django-q's Schedule.schedule_type that the backend lets us edit
const FREQUENCY_OPTIONS = [
  { value: 'D', label: 'Diaria' },
  { value: 'W', label: 'Semanal' },
  { value: 'M', label: 'Mensual' },
  { value: 'Q', label: 'Trimestral' },
  { value: 'Y', label: 'Anual' },
]

// datetime-local works with local time without seconds ("2026-10-26T05:00")
const toLocalInput = (value) => {
  if (!value) return ''
  const date = new Date(value)
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const firstMessage = (messages) => (Array.isArray(messages) ? messages.join(' ') : messages)

function ScheduleConfigForm({ automation, onSave, onClose }) {
  const isEditableFrequency = FREQUENCY_OPTIONS.some((option) => option.value === automation.schedule_type)
  const [frequency, setFrequency] = useState(isEditableFrequency ? automation.schedule_type : null)
  const [nextRun, setNextRun] = useState(toLocalInput(automation.next_run))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const validation = {}
    if (!frequency) validation.schedule_type = 'Elegí una frecuencia.'
    if (!nextRun) validation.next_run = 'Ingresá la fecha y hora de la próxima ejecución.'
    else if (new Date(nextRun) <= new Date()) validation.next_run = 'Tiene que ser posterior a este momento.'
    setErrors(validation)
    if (Object.keys(validation).length) return

    setSaving(true)
    try {
      await onSave(automation, { schedule_type: frequency, next_run: new Date(nextRun).toISOString() })
      onClose()
    } catch (requestError) {
      const data = requestError.response?.data ?? {}
      setErrors({
        schedule_type: firstMessage(data.schedule_type),
        next_run: firstMessage(data.next_run),
        general: firstMessage(data.detail) || (!data.schedule_type && !data.next_run ? 'No se pudo guardar la configuración.' : ''),
      })
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        <p className="text-base text-slate-700">
          Configurá cuándo se ejecuta <strong>{getAutomationInfo(automation).title}</strong>.
        </p>
        <Select
          label="Frecuencia"
          placeholder="Seleccioná una frecuencia..."
          data={FREQUENCY_OPTIONS}
          value={frequency}
          onChange={setFrequency}
          error={errors.schedule_type}
          required
        />
        <TextInput
          type="datetime-local"
          label="Próxima ejecución"
          description="A partir de esta fecha y hora se repite según la frecuencia elegida."
          value={nextRun}
          onChange={(event) => setNextRun(event.currentTarget.value)}
          error={errors.next_run}
          required
        />
        {errors.general && <Text color="red" size="sm" role="alert">{errors.general}</Text>}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${BUTTON_CLASS} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}
          >
            Cancelar
          </button>
          <button type="submit" disabled={saving} className={`${BUTTON_CLASS} bg-sky-700 text-white hover:bg-sky-800`}>
            <span className={`material-symbols-outlined text-[20px] ${saving ? 'animate-spin' : ''}`} aria-hidden="true">
              {saving ? 'progress_activity' : 'save'}
            </span>
            {saving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </Stack>
    </form>
  )
}

export default function ScheduleConfigModal({ automation, onSave, onClose }) {
  return (
    <Modal
      opened={Boolean(automation)}
      onClose={onClose}
      title={<Text fw={700} size="xl">Configurar ejecución</Text>}
      centered
    >
      {automation && <ScheduleConfigForm key={automation.id} automation={automation} onSave={onSave} onClose={onClose} />}
    </Modal>
  )
}
