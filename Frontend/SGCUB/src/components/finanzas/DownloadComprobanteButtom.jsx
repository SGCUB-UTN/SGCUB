import { useState } from 'react'
import { descargarComprobantePdf } from '../../api/comprobantes'
import { descargarMovimientoPdf } from '../../api/movimientos'
import { SecondaryButton } from '../personas/tabs/parts'
import { SUBMIT_BUTTON_CLASS } from './formParts'

function DownloadComprobanteButtom({
  comprobanteId,
  movimientoId,
  variant = 'secondary',
  fullWidth = false,
  label = 'Descargar PDF',
}) {
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')
  const targetId = comprobanteId ?? movimientoId

  const descargar = async () => {
    if (!targetId) return
    setDescargando(true)
    setError('')
    try {
      if (movimientoId) {
        await descargarMovimientoPdf(movimientoId)
      } else {
        await descargarComprobantePdf(comprobanteId)
      }
    } catch {
      setError('No se pudo descargar el comprobante.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className={`flex flex-col ${fullWidth ? 'w-full items-stretch' : 'items-start'} gap-1.5`}>
      {variant === 'primary' ? (
        <button
          type="button"
          onClick={descargar}
          disabled={!targetId || descargando}
          className={`${SUBMIT_BUTTON_CLASS} ${fullWidth ? 'w-full justify-center' : ''} h-11 text-sm`}
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">download</span>
          <span>{descargando ? 'Descargando PDF...' : label}</span>
        </button>
      ) : (
        <SecondaryButton icon="download" onClick={descargar} disabled={!targetId || descargando}>
          {descargando ? 'Descargando...' : label}
        </SecondaryButton>
      )}
      {error && <p className="text-sm text-error" role="alert">{error}</p>}
    </div>
  )
}

export default DownloadComprobanteButtom
