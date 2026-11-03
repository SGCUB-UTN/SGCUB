import { useEffect, useState } from 'react'
import { descargarComprobantePdf, obtenerComprobanteImagenBlob } from '../../api/comprobantes'
import { descargarDevolucionPdf, obtenerDevolucionImagenBlob } from '../../api/devoluciones'
import {
  buildWhatsAppMessage,
  copyReceiptBlobToClipboard,
  copyReceiptImageToClipboard,
  formatWhatsAppPhone,
  openWhatsAppChat,
} from '../../utils/whatsapp'

function WhatsAppIcon({ className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  )
}

function WhatsAppComprobanteButton({
  socio,
  comprobanteId,
  devolucionId,
  comprobanteCodigo,
  montoTotal,
  clubNombre,
  tipo = 'comprobante',
  comprobanteRef,
  autoDownload = true,
  variant = 'primary',
  label = 'WhatsApp',
  className = '',
}) {
  const [procesando, setProcesando] = useState(false)
  const [toast, setToast] = useState(null)
  const phone = socio?.telefono || socio?.persona?.telefono || ''
  const hasPhone = Boolean(phone && String(phone).trim().length >= 6)
  const formattedPhone = hasPhone ? formatWhatsAppPhone(phone) : null
  const targetId = comprobanteId ?? devolucionId
  const isRefund = Boolean(devolucionId)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleClick = async () => {
    if (!hasPhone || procesando) return

    setProcesando(true)
    const effectiveTipo = tipo || (isRefund ? 'devolucion' : 'comprobante')
    const message = buildWhatsAppMessage({
      socio,
      comprobanteCodigo,
      montoTotal,
      clubNombre,
      tipo: effectiveTipo,
    })

    let imagenCopiada = false

    // 1. Prioridad: Obtener la imagen PNG del PDF oficial generado por el backend
    if (devolucionId) {
      try {
        const blob = await obtenerDevolucionImagenBlob(devolucionId)
        await copyReceiptBlobToClipboard(blob)
        imagenCopiada = true
        setToast({
          type: 'success',
          title: '¡Comprobante copiado al portapapeles!',
          description: 'En WhatsApp presioná Ctrl + V para pegar la imagen en la conversación.',
        })
      } catch (err) {
        console.warn('No se pudo obtener/copiar la imagen de la devolución desde el backend:', err)
      }
    } else if (comprobanteId) {
      try {
        const blob = await obtenerComprobanteImagenBlob(comprobanteId)
        await copyReceiptBlobToClipboard(blob)
        imagenCopiada = true
        setToast({
          type: 'success',
          title: '¡Comprobante copiado al portapapeles!',
          description: 'En WhatsApp presioná Ctrl + V para pegar la imagen en la conversación.',
        })
      } catch (err) {
        console.warn('No se pudo obtener/copiar la imagen del PDF desde el backend:', err)
      }
    }

    // 2. Si no se pudo por backend (ej. comprobante pendiente sin ID guardado), capturamos del DOM:
    if (!imagenCopiada && comprobanteRef?.current) {
      try {
        await copyReceiptImageToClipboard(comprobanteRef.current)
        imagenCopiada = true
        setToast({
          type: 'success',
          title: '¡Comprobante copiado al portapapeles!',
          description: 'En WhatsApp presioná Ctrl + V para pegar la imagen en la conversación.',
        })
      } catch (err) {
        console.warn('Fallo capturando imagen del DOM:', err)
      }
    }

    // 3. Si no se pudo copiar al portapapeles (por permisos o error), descargamos el PDF de respaldo:
    if (!imagenCopiada && autoDownload && targetId) {
      try {
        if (devolucionId) {
          await descargarDevolucionPdf(devolucionId)
        } else {
          await descargarComprobantePdf(comprobanteId)
        }
        setToast({
          type: 'info',
          title: 'Comprobante descargado',
          description: 'Descargamos el PDF para que lo adjuntes directamente en WhatsApp.',
        })
      } catch (pdfErr) {
        console.error('Error descargando PDF:', pdfErr)
      }
    }

    setProcesando(false)
    openWhatsAppChat({ phone, message })
  }

  const tooltipText = hasPhone
    ? `Enviar comprobante al socio por WhatsApp (${phone})`
    : 'El socio no tiene un teléfono registrado'

  const baseClass = 'inline-flex items-center justify-center gap-2 px-4 h-10 min-w-[125px] rounded-md font-semibold text-sm transition-colors whitespace-nowrap shrink-0'
  const primaryClass = hasPhone
    ? 'bg-[#25D366] hover:bg-[#20ba5a] text-white shadow-sm cursor-pointer'
    : 'bg-[#25D366]/40 text-white/80 cursor-not-allowed opacity-60'
  const secondaryClass = hasPhone
    ? 'border border-emerald-600/40 text-emerald-700 hover:bg-emerald-50 cursor-pointer'
    : 'border border-outline-variant/40 text-on-surface-variant/40 cursor-not-allowed opacity-60'

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={!hasPhone || procesando}
        title={tooltipText}
        aria-label={tooltipText}
        className={`${baseClass} ${variant === 'primary' ? primaryClass : secondaryClass} ${className}`}
      >
        {procesando ? (
          <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
        ) : (
          <WhatsAppIcon className="w-4 h-4 shrink-0" />
        )}
        <span>{procesando ? 'Preparando...' : label}</span>
        {hasPhone && formattedPhone && (
          <span className="sr-only">a {formattedPhone}</span>
        )}
      </button>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 bg-inverse-surface text-inverse-on-surface px-4 py-3 rounded-xl shadow-2xl flex items-start gap-3 border border-outline-variant/30 max-w-sm animate-fade-in"
          role="status"
        >
          <span
            className={`material-symbols-outlined text-2xl shrink-0 ${
              toast.type === 'success' ? 'text-emerald-400' : 'text-primary-container'
            }`}
          >
            {toast.type === 'success' ? 'content_paste_go' : 'download_done'}
          </span>
          <div className="flex flex-col text-xs gap-0.5">
            <span className="font-bold text-sm text-white">{toast.title}</span>
            <span className="text-inverse-on-surface/90 leading-relaxed">{toast.description}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto text-inverse-on-surface/60 hover:text-white shrink-0 p-0.5"
            aria-label="Cerrar notificación"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </>
  )
}

export default WhatsAppComprobanteButton

