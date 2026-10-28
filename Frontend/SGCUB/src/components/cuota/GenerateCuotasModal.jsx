import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import { generateMonthlyCuotas } from '../../api/cuotas'
import { getErrorMessage } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { formatCount } from './cuotaPeriod'

const INITIAL_STATE = { loading: false, error: '', result: null }

const plural = (count, singular, pluralForm) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`

function GenerationResult({ result }) {
  return (
    <Text>
      {result.cuotas_creadas > 0
        ? <>Se {result.cuotas_creadas === 1 ? 'generó' : 'generaron'} <strong>{plural(result.cuotas_creadas, 'cuota', 'cuotas')}</strong></>
        : 'No se generaron cuotas nuevas'}
      {' '}para {result.periodos.map(formatPeriod).join(', ')}.
      {result.cuotas_existentes > 0 && ` ${plural(result.cuotas_existentes, 'cuota ya existía', 'cuotas ya existían')} y no se duplicaron.`}
    </Text>
  )
}

function GenerateCuotasModal({ opened, onClose, onGenerated }) {
  const [state, setState] = useState(INITIAL_STATE)

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
      {state.result ? (
        <GenerationResult result={state.result} />
      ) : (
        <Text>
          Se van a generar las cuotas de los socios activos para el mes en curso y los próximos meses.
          Las cuotas que ya existen no se duplican.
        </Text>
      )}
      {state.error && (
        <Text c="red" size="sm" mt="md">
          {state.error}
        </Text>
      )}
      <Group position="right" mt="xl">
        {state.result ? (
          <Button onClick={close}>Cerrar</Button>
        ) : (
          <>
            <Button variant="default" onClick={close} disabled={state.loading}>
              Cancelar
            </Button>
            <Button onClick={generate} loading={state.loading}>
              Generar
            </Button>
          </>
        )}
      </Group>
    </Modal>
  )
}

export default GenerateCuotasModal
