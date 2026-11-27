import { useState } from 'react'
import { Modal } from '@mantine/core'
import { generateMonthlyCuotas } from '../../api/cuotas'
import { getErrorMessage } from '../personas/format'
import { currentPeriod, formatPeriod } from '../shared/periodFormat'
import { SECONDARY_BUTTON_CLASS, SUBMIT_BUTTON_CLASS } from '../finanzas/formParts'
import { formatCount, shiftPeriod } from './cuotaPeriod'

const INITIAL_STATE = { loading: false, error: '', result: null }

const GENERATION_MONTHS = 12

const plural = (count, singular, pluralForm) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`

const periodRange = (periods) => (periods.length > 1
  ? `de ${formatPeriod(periods[0])} a ${formatPeriod(periods.at(-1))}`
  : formatPeriod(periods[0]))

function GenerationResult({ result }) {
  return (
    <p className="flex items-start gap-2 text-base text-on-surface">
      <span className="material-symbols-outlined shrink-0 text-emerald-700" style={{ fontSize: 20 }} aria-hidden="true">check_circle</span>
      <span>
        {result.cuotas_creadas > 0
          ? <>Se {result.cuotas_creadas === 1 ? 'generó' : 'generaron'} <strong>{plural(result.cuotas_creadas, 'cuota', 'cuotas')}</strong></>
          : 'No se generaron cuotas nuevas'}
        {' '}{result.periodos.length > 0 && periodRange(result.periodos)}.
        {result.cuotas_existentes > 0 && ` ${plural(result.cuotas_existentes, 'cuota ya existía', 'cuotas ya existían')} y no se duplicaron.`}
      </span>
    </p>
  )
}

function GenerateCuotasModal({ opened, onClose, onGenerated }) {
  const [state, setState] = useState(INITIAL_STATE)
  const firstPeriod = currentPeriod()
  const lastPeriod = shiftPeriod(firstPeriod, GENERATION_MONTHS - 1)

  const close = () => {
    if (state.loading) return
    setState(INITIAL_STATE)
    onClose()
  }

  const generate = async () => {
    setState({ ...INITIAL_STATE, loading: true })
    try {
      const result = await generateMonthlyCuotas()
      setState({ ...INITIAL_STATE, result })
      onGenerated()
    } catch (requestError) {
      setState({ ...INITIAL_STATE, error: getErrorMessage(requestError, 'No se pudieron generar las cuotas.') })
    }
  }

  return (
    <Modal opened={opened} onClose={close} title="Generar cuotas" centered>
      <div className="flex flex-col gap-4">
        {state.result ? (
          <GenerationResult result={state.result} />
        ) : (
          <>
            <p className="text-base text-on-surface">
              Se generan las cuotas de los socios activos <strong>de {formatPeriod(firstPeriod)} a {formatPeriod(lastPeriod)}</strong> ({GENERATION_MONTHS} meses).
            </p>
            <ul className="flex flex-col gap-1.5 text-base text-on-surface-variant list-disc pl-5">
              <li>Las cuotas que ya existen no se duplican.</li>
              <li>Los jugadores de categorías exentas no reciben cuota.</li>
              <li>No depende del mes que estás mirando en la pantalla.</li>
            </ul>
          </>
        )}
        {state.error && <p className="text-base text-error" role="alert">{state.error}</p>}
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          {state.result ? (
            <button type="button" onClick={close} className={`${SUBMIT_BUTTON_CLASS} justify-center`}>Cerrar</button>
          ) : (
            <>
              <button type="button" onClick={close} disabled={state.loading} className={`${SECONDARY_BUTTON_CLASS} justify-center`}>
                Cancelar
              </button>
              <button type="button" onClick={generate} disabled={state.loading} className={`${SUBMIT_BUTTON_CLASS} justify-center`}>
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">request_quote</span>
                {state.loading ? 'Generando...' : 'Generar cuotas'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default GenerateCuotasModal
