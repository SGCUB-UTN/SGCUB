import { useEffect, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getImpactoConfiguracionFinanciera } from '../../api/configuracion'
import { getErrorMessage } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { CUOTA_FIELD_LABELS, formatCuotaValue, nextPeriod } from './financialFields'
import { Field, INPUT_CLASS, Notice } from './settingsParts'
import { BUTTON_CLASSES } from './settingsForm'

function ImpactNotice({ period }) {
  const [impact, setImpact] = useState({ period: null, count: null, error: false })

  useEffect(() => {
    let cancelled = false
    getImpactoConfiguracionFinanciera(period)
      .then((data) => {
        if (!cancelled) setImpact({ period, count: data.cuotas_afectadas, error: false })
      })
      .catch(() => {
        if (!cancelled) setImpact({ period, count: null, error: true })
      })
    return () => {
      cancelled = true
    }
  }, [period])

  if (impact.period !== period) return <Notice tone="info">Calculando cuántas cuotas se van a actualizar...</Notice>
  if (impact.error) return <Notice tone="warning">No se pudo calcular cuántas cuotas se van a actualizar.</Notice>
  if (!impact.count) {
    return <Notice tone="info">Todavía no hay cuotas generadas para {formatPeriod(period)} en adelante: los cambios se aplican a las cuotas que se generen.</Notice>
  }
  return (
    <Notice tone="warning">
      Se van a actualizar <strong>{impact.count} {impact.count === 1 ? 'cuota impaga' : 'cuotas impagas'}</strong> (incluidas las
      parcialmente pagas) de {formatPeriod(period)} en adelante. Las cuotas pagas no cambian.
    </Notice>
  )
}

// Asks from which period the cuota changes apply and confirms them
function ApplyFromPeriodForm({ changes, current, form, onConfirm, onClose }) {
  const minPeriod = nextPeriod()
  const [period, setPeriod] = useState(minPeriod)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const isValidPeriod = /^\d{4}-\d{2}$/.test(period) && period >= minPeriod

  const confirm = async () => {
    if (!isValidPeriod) {
      setError(`Elegí un período a partir de ${formatPeriod(minPeriod)}.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      await onConfirm(period)
      onClose()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo guardar la nueva configuración.'))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-outline-variant/40">
        <p className="border-b border-outline-variant/30 bg-surface-container-low px-4 py-2 text-sm font-semibold uppercase tracking-wider text-on-surface-variant">Cambios</p>
        <ul className="divide-y divide-outline-variant/20">
          {changes.map((field) => (
            <li key={field} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-base">
              <span className="text-on-surface-variant">{CUOTA_FIELD_LABELS[field]}</span>
              <span className="font-semibold text-on-surface">
                {formatCuotaValue(field, current[field], current)}
                <span className="mx-2 text-outline" aria-hidden="true">→</span>
                {formatCuotaValue(field, form[field], form)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <Field
        label="Válido a partir del período"
        htmlFor="periodo-vigencia"
        hint="Solo se puede elegir un período posterior al actual, para no mezclar criterios dentro de un mismo mes."
        error={!isValidPeriod && period ? `Elegí un período a partir de ${formatPeriod(minPeriod)}.` : ''}
      >
        <input
          id="periodo-vigencia"
          type="month"
          className={INPUT_CLASS}
          min={minPeriod}
          value={period}
          onChange={(event) => setPeriod(event.target.value)}
          required
        />
      </Field>

      {isValidPeriod && <ImpactNotice period={period} />}
      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex justify-end gap-2">
        <button type="button" className={BUTTON_CLASSES.secondary} onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="button" className={BUTTON_CLASSES.primary} onClick={confirm} disabled={saving || !isValidPeriod}>
          {saving ? 'Guardando...' : 'Confirmar cambios'}
        </button>
      </div>
    </div>
  )
}

export default function ApplyFromPeriodModal({ opened, onClose, ...props }) {
  return (
    <Modal opened={opened} onClose={onClose} centered size="lg" title={<Text fw={700} size="xl">¿Desde qué período aplican los cambios?</Text>}>
      {opened && <ApplyFromPeriodForm onClose={onClose} {...props} />}
    </Modal>
  )
}
