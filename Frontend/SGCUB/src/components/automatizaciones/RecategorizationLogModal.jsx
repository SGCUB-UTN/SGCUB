import { useEffect, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getRecategorizationLog } from '../../api/automatizaciones'
import LogDownloadButton from './LogDownloadButton'

function LogContent({ execution }) {
  const [log, setLog] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    getRecategorizationLog(execution.id)
      .then((data) => { if (active) setLog(data) })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [execution.id])

  if (error) return <p className="text-sm text-red-700" role="alert">No se pudo cargar el registro de la ejecución.</p>
  if (log === null) return <p className="text-sm text-slate-500" role="status">Cargando registro...</p>

  return (
    <div className="flex flex-col gap-4">
      <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-700">
        {log}
      </pre>
      <LogDownloadButton fileName={`recategorizacion-${execution.anio}-${execution.id}.txt`} log={log} />
    </div>
  )
}

export default function RecategorizationLogModal({ execution, opened, onClose }) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="xl">Registro de la recategorización</Text>}
      centered
      size="xl"
    >
      {opened && <LogContent execution={execution} />}
    </Modal>
  )
}
