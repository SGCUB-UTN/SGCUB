import { useEffect, useRef, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { getConfiguracionGeneral } from '../../api/configuracion'
import { downloadPlantillaPdf, getPlantillaDestinatario, getPlantillaImagenBlob, getPlantillaPdfBlob } from '../../api/documentacion'
import { buildDocumentWhatsAppMessage, copyReceiptBlobToClipboard, openWhatsAppChat } from '../../utils/whatsapp'
import { WhatsAppIcon } from '../finanzas/WhatsAppComprobanteButton'
import { getErrorMessage } from '../personas/format'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'

const FULL = 'completo'
const STUB = 'talon'

const NOTICE_CLASSES = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  error: 'border-red-200 bg-red-50 text-red-900',
}

const readError = async (requestError, fallback) => {
  const data = requestError.response?.data
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).detail || fallback
    } catch {
      return fallback
    }
  }
  return getErrorMessage(requestError, fallback)
}

const hasPhone = (phone) => String(phone ?? '').replace(/\D/g, '').length >= 6

const removeFrame = (frame) => {
  if (!frame) return
  URL.revokeObjectURL(frame.src)
  frame.remove()
}

function usePdfPrinter() {
  const frameRef = useRef(null)
  useEffect(() => () => removeFrame(frameRef.current), [])

  return (blob) => new Promise((resolve, reject) => {
    removeFrame(frameRef.current)
    const frame = document.createElement('iframe')
    frame.title = 'Impresión del documento'
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '1px', height: '1px', border: '0', opacity: '0', pointerEvents: 'none' })
    frame.onload = () => {
      try {
        frame.contentWindow.focus()
        frame.contentWindow.print()
        resolve()
      } catch (printError) {
        reject(printError)
      }
    }
    frame.src = URL.createObjectURL(blob)
    document.body.appendChild(frame)
    frameRef.current = frame
  })
}

function RecipientLine({ recipient }) {
  if (!hasPhone(recipient.telefono)) {
    return <p className="text-sm text-on-surface-variant">{recipient.nombre} no tiene un teléfono cargado para enviarlo por WhatsApp.</p>
  }
  return (
    <p className="text-sm text-on-surface-variant">
      WhatsApp a <span className="font-semibold text-on-surface">{recipient.nombre}</span>
      {recipient.es_responsable_legal && ' (responsable legal)'} · {recipient.telefono}
    </p>
  )
}

function TemplateDocumentView({ tipo, personaId, onUpload }) {
  const [pdf, setPdf] = useState(null)
  const [recipient, setRecipient] = useState(null)
  const [clubName, setClubName] = useState('')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState(null)
  const print = usePdfPrinter()
  const tipoId = tipo.id_tipo_documento

  useEffect(() => {
    let active = true
    let url = null
    Promise.all([
      getPlantillaPdfBlob(tipoId, personaId, FULL),
      getPlantillaDestinatario(tipoId, personaId),
      getConfiguracionGeneral().catch(() => null),
    ])
      .then(([blob, destinatario, configuracion]) => {
        if (!active) return
        url = URL.createObjectURL(blob)
        setPdf({ blob, url })
        setRecipient(destinatario)
        setClubName(configuracion?.club_nombre ?? '')
      })
      .catch(async (requestError) => {
        const message = await readError(requestError, 'No se pudo generar el documento.')
        if (active) setLoadError(message)
      })
    return () => {
      active = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [tipoId, personaId])

  if (loadError) return <p className={`rounded-lg border px-4 py-3 text-base ${NOTICE_CLASSES.error}`} role="alert">{loadError}</p>
  if (!pdf) return <p className="py-16 text-center text-sm text-on-surface-variant">Generando documento...</p>

  const run = async (key, action, fallback) => {
    setBusy(key)
    setNotice(null)
    try {
      await action()
    } catch (requestError) {
      setNotice({ tone: 'error', text: await readError(requestError, fallback) })
    } finally {
      setBusy('')
    }
  }

  const printFull = () => run('print-full', () => print(pdf.blob), 'No se pudo imprimir el documento.')
  const printStub = () => run('print-stub', async () => print(await getPlantillaPdfBlob(tipoId, personaId, STUB)), 'No se pudo imprimir el talón.')
  const download = () => run('download', () => downloadPlantillaPdf(tipoId, personaId, FULL), 'No se pudo descargar el documento.')

  const sendWhatsApp = () => run('whatsapp', async () => {
    try {
      await copyReceiptBlobToClipboard(await getPlantillaImagenBlob(tipoId, personaId))
      setNotice({ tone: 'success', text: 'Copiamos el documento como imagen. En WhatsApp presioná Ctrl + V para pegarlo en la conversación.' })
    } catch {
      await downloadPlantillaPdf(tipoId, personaId, FULL)
      setNotice({ tone: 'info', text: 'Descargamos el PDF para que lo adjuntes en la conversación de WhatsApp.' })
    }
    openWhatsAppChat({ phone: recipient.telefono, message: buildDocumentWhatsAppMessage({ clubNombre: clubName, documento: tipo.nombre }) })
  }, 'No se pudo preparar el envío por WhatsApp.')

  const canSend = hasPhone(recipient.telefono)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <SecondaryButton icon="print" onClick={printFull} disabled={Boolean(busy)}>Imprimir completo</SecondaryButton>
          <SecondaryButton icon="content_cut" onClick={printStub} disabled={Boolean(busy)}>{busy === 'print-stub' ? 'Preparando...' : 'Imprimir talón'}</SecondaryButton>
          <SecondaryButton icon="download" onClick={download} disabled={Boolean(busy)}>{busy === 'download' ? 'Descargando...' : 'Descargar PDF'}</SecondaryButton>
          <button
            type="button"
            onClick={sendWhatsApp}
            disabled={!canSend || Boolean(busy)}
            title={canSend ? 'Enviar por WhatsApp' : 'No hay un teléfono cargado'}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#20ba5a] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <WhatsAppIcon className="h-4 w-4 shrink-0" />
            {busy === 'whatsapp' ? 'Preparando...' : 'WhatsApp'}
          </button>
        </div>
        <PrimaryButton icon="upload_file" onClick={() => onUpload(tipo)} disabled={Boolean(busy)}>Cargar firmado</PrimaryButton>
      </div>

      <RecipientLine recipient={recipient} />
      {notice && (
        <p className={`rounded-lg border px-4 py-3 text-sm ${NOTICE_CLASSES[notice.tone]}`} role={notice.tone === 'error' ? 'alert' : 'status'}>{notice.text}</p>
      )}

      <iframe title={tipo.nombre} src={pdf.url} className="h-[70vh] w-full rounded-lg border border-outline-variant/60 bg-surface-container-low" />
    </div>
  )
}

export default function DocumentTemplateModal({ tipo, personaId, onClose, onUpload }) {
  return (
    <Modal opened={Boolean(tipo)} onClose={onClose} centered size="72rem" title={<Text fw={700} size="xl">{tipo?.nombre}</Text>}>
      {tipo && <TemplateDocumentView key={tipo.id_tipo_documento} tipo={tipo} personaId={personaId} onUpload={onUpload} />}
    </Modal>
  )
}
