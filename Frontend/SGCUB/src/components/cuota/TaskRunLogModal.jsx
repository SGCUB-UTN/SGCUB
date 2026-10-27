import { useEffect, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getCuotaTaskRun } from '../../api/cuotas'
import LogDownloadButton from '../automatizaciones/LogDownloadButton'
import { formatPeriod } from '../shared/periodFormat'
import { formatDateTime } from './cuotaPeriod'

const EMPTY = { runId: null, data: null, error: null }

const duration = (run) => {
  if (!run.fecha_fin) return '—'
  const seconds = Math.max(0, Math.round((new Date(run.fecha_fin) - new Date(run.fecha_inicio)) / 1000))
  return seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`
}

function RunDetails({ run }) {
  const details = [
    ['Tarea', run.tipo_display],
    ['Período', formatPeriod(run.periodo)],
    ['Origen', `${run.origen_display}${run.usuario ? ` por ${run.usuario}` : ''}`],
    ['Resultado', run.exitosa ? 'Completada correctamente' : 'Con observaciones'],
    ['Inicio', formatDateTime(run.fecha_inicio)],
    ['Duración', duration(run)],
  ]
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {details.map(([label, value]) => (
        <div key={label} className="flex justify-between sm:justify-start gap-3">
          <dt className="text-on-surface-variant sm:w-24 shrink-0">{label}</dt>
          <dd className={`font-medium ${label === 'Resultado' && !run.exitosa ? 'text-error' : 'text-on-surface'}`}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function TaskRunLogModal({ run, onClose }) {
  const runId = run?.ejecucion_id ?? null
  const [loaded, setLoaded] = useState(EMPTY)

  useEffect(() => {
    if (runId == null) return undefined
    let active = true
    getCuotaTaskRun(runId)
      .then((data) => active && setLoaded({ runId, data, error: null }))
      .catch((error) => active && setLoaded({ runId, data: null, error }))
    return () => { active = false }
  }, [runId])

  const current = loaded.runId === runId ? loaded : EMPTY
  const detail = current.data

  return (
    <Modal
      opened={runId != null}
      onClose={onClose}
      title={<Text fw={700} size="xl">Registro de la ejecución</Text>}
      centered
      size="xl"
    >
      {run && (
        <div className="flex flex-col gap-4">
          <RunDetails run={detail ?? run} />
          <p className="text-sm text-on-surface border-l-2 border-primary pl-3">{run.resumen}</p>
          {!detail && !current.error && <p className="text-sm text-on-surface-variant">Cargando registro…</p>}
          {current.error && <p className="text-sm text-error">No se pudo cargar el registro de la ejecución.</p>}
          {detail && (
            <>
              <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-outline-variant/40 bg-surface-container-low p-3 font-mono text-xs leading-relaxed text-on-surface">
                {detail.registro || 'La ejecución no dejó registro.'}
              </pre>
              {detail.registro && (
                <LogDownloadButton
                  fileName={`registro-${detail.tipo.toLowerCase()}-${detail.periodo}.txt`}
                  log={detail.registro}
                />
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
