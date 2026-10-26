import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@mantine/core'
import { getEstadoCuenta } from '../../api/estadoCuenta'
import { corregirPago } from '../../api/pagos'
import { formatAmount, formatDate } from '../personas/format'
import useMediosPago from '../../hooks/useMediosPago'
import { NO_SPINNER_CLASS } from './formParts'

const emptyMethod = () => ({ medio_de_pago: '', monto: '' })

const initialMethods = (payment) => {
  const items = payment?.items_pago ?? []
  return items.length
    ? items.map((item) => ({ medio_de_pago: item.medio_de_pago, monto: String(item.monto) }))
    : [emptyMethod()]
}

const appliedByOriginalPayment = (detail) => Object.fromEntries(
  (detail?.periodos ?? []).map((period) => [period.cuota_id, Number(period.monto_aplicado ?? 0)]),
)

const errorMessage = (requestError) => {
  const status = requestError.response?.status
  const detail = requestError.response?.data?.detail
  if (status === 403) return 'Solo tesorería o dirección pueden corregir pagos.'
  if (detail) return detail
  if (status === 404) return 'El pago no existe o ya no está disponible para corregir.'
  return 'No se pudo registrar la corrección. El pago original se conserva.'
}

function AmendPagoModal({ comprobante, pago, detail, opened, onClose, onSuccess }) {
  const socioId = pago?.socio?.socio_id
  const [load, setLoad] = useState({ socioId: null, account: null, error: '' })
  const [selectedCuotaIds, setSelectedCuotaIds] = useState([])
  const [totalAmount, setTotalAmount] = useState(String(comprobante?.monto_total ?? ''))
  const { paymentMethods } = useMediosPago()
  const [methods, setMethods] = useState(() => initialMethods(pago))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!opened || !socioId) return undefined
    let active = true
    getEstadoCuenta(socioId)
      .then((account) => active && setLoad({ socioId, account, error: '' }))
      .catch(() => active && setLoad({ socioId, account: null, error: 'No se pudo cargar el estado de cuenta para elegir las cuotas corregidas.' }))
    return () => { active = false }
  }, [opened, socioId])

  const loadingAccount = load.socioId !== socioId
  const account = loadingAccount ? null : load.account

  const availableCuotas = useMemo(() => {
    const originalApplied = appliedByOriginalPayment(detail)
    return (account?.cuotas ?? [])
      .map((cuota) => ({
        ...cuota,
        available: Number(cuota.saldo_pendiente ?? 0) + (originalApplied[cuota.cuota_id] ?? 0),
      }))
      .filter((cuota) => cuota.available > 0)
  }, [account, detail])

  const maximumAmount = availableCuotas
    .filter((cuota) => selectedCuotaIds.includes(cuota.cuota_id))
    .reduce((total, cuota) => total + cuota.available, 0)
  const methodsTotal = methods.reduce((total, method) => total + Number(method.monto || 0), 0)

  const updateMethod = (index, field, value) => {
    setMethods((current) => current.map((method, position) => (
      position === index ? { ...method, [field]: value } : method
    )))
  }

  const toggleCuota = (cuotaId, checked) => {
    setSelectedCuotaIds((current) => checked ? [...current, cuotaId] : current.filter((id) => id !== cuotaId))
  }

  const validationError = () => {
    if (!reason.trim()) return 'Ingresá el motivo de la corrección para dejar trazabilidad.'
    if (!selectedCuotaIds.length) return 'Seleccioná las cuotas que debe cancelar el pago corregido.'
    if (!totalAmount || Number(totalAmount) <= 0) return 'Ingresá un monto mayor a cero.'
    if (Number(totalAmount) - maximumAmount > 0.001) return `El monto no puede superar lo disponible en las cuotas seleccionadas (${formatAmount(maximumAmount)}).`
    if (!methods.length || methods.some((method) => !method.medio_de_pago || Number(method.monto) <= 0)) return 'Completá un medio y un monto válido para cada fila.'
    if (Math.abs(methodsTotal - Number(totalAmount)) > 0.001) return 'La suma de los medios de pago debe coincidir con el monto total.'
    return ''
  }

  const submitCorrection = async (event) => {
    event.preventDefault()
    const message = validationError()
    setError(message)
    if (message) return

    setSaving(true)
    try {
      const result = await corregirPago(pago.pago_id, {
        motivo: reason.trim(),
        cuota_ids: selectedCuotaIds,
        monto_total: Number(totalAmount),
        medios: methods.map((method) => ({ medio_de_pago: method.medio_de_pago, monto: Number(method.monto) })),
      })
      await onSuccess?.(result)
      onClose()
    } catch (requestError) {
      setError(errorMessage(requestError))
    } finally {
      setSaving(false)
    }
  }

  if (!comprobante || !pago) return null

  return (
    <Modal opened={opened} onClose={() => !saving && onClose()} title="Corregir pago registrado" centered size="lg">
      <form onSubmit={submitCorrection} className="flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-2 gap-3 p-3 bg-surface-container-low border border-outline-variant/30 rounded-lg">
          <div><p className="text-sm text-on-surface-variant">Pago original</p><p className="font-semibold text-on-surface">#{pago.pago_id}</p></div>
          <div><p className="text-sm text-on-surface-variant">Comprobante original</p><p className="font-semibold text-on-surface">#{comprobante.numero}</p></div>
          <div><p className="text-sm text-on-surface-variant">Monto original</p><p className="font-semibold text-on-surface">{formatAmount(comprobante.monto_total)}</p></div>
          <div><p className="text-sm text-on-surface-variant">Socio</p><p className="font-semibold text-on-surface">{pago.socio?.apellido}, {pago.socio?.nombre}</p></div>
        </div>

        <p className="text-sm text-on-surface-variant">El pago original y su comprobante se conservan como anulados. Se registra una reversión en la cuenta corriente y un nuevo pago con su comprobante, vinculado al original.</p>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold text-on-surface">Cuotas que debe cancelar</legend>
          {loadingAccount && <p className="text-sm text-on-surface-variant">Cargando cuotas...</p>}
          {load.error && !loadingAccount && <p className="text-sm text-error" role="alert">{load.error}</p>}
          {account && availableCuotas.length === 0 && <p className="text-sm text-on-surface-variant">La cuenta no tiene cuotas con saldo disponible para imputar.</p>}
          <div className="max-h-48 overflow-auto border border-outline-variant/30 divide-y divide-outline-variant/20 rounded-lg">
            {availableCuotas.map((cuota) => (
              <label key={cuota.cuota_id} className="flex items-center gap-3 p-3 hover:bg-surface-container-low cursor-pointer">
                <input type="checkbox" checked={selectedCuotaIds.includes(cuota.cuota_id)} onChange={(event) => toggleCuota(cuota.cuota_id, event.target.checked)} className="accent-primary" />
                <span className="min-w-0 flex-1"><strong className="block text-on-surface">Período {cuota.periodo}</strong><span className="text-sm text-on-surface-variant">Vence {formatDate(cuota.fecha_venc1)} · Total {formatAmount(cuota.monto_total)}</span></span>
                <span className="text-right"><span className="block text-xs text-on-surface-variant">Disponible</span><strong className="text-sm text-on-surface">{formatAmount(cuota.available)}</strong></span>
              </label>
            ))}
          </div>
          <p className="text-sm text-on-surface-variant">Disponible en las cuotas seleccionadas: {formatAmount(maximumAmount)}</p>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">Monto corregido
          <input type="number" min="0.01" step="0.01" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} className={`${NO_SPINNER_CLASS} h-10 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-md font-normal focus:outline-none focus:border-primary`} />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="font-semibold text-on-surface">Medios de pago corregidos</legend>
          {methods.map((method, index) => (
            <div key={index} className="flex flex-wrap gap-2">
              <select value={method.medio_de_pago} onChange={(event) => updateMethod(index, 'medio_de_pago', event.target.value)} className="h-10 min-w-0 flex-1 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-md">
                <option value="">Seleccionar medio</option>
                {paymentMethods.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <input type="number" min="0.01" step="0.01" value={method.monto} onChange={(event) => updateMethod(index, 'monto', event.target.value)} aria-label={`Monto del medio ${index + 1}`} placeholder="Monto" className={`${NO_SPINNER_CLASS} h-10 w-32 px-3 bg-surface-container-lowest border border-outline-variant/50 rounded-md`} />
              {methods.length > 1 && <button type="button" onClick={() => setMethods((current) => current.filter((_, position) => position !== index))} aria-label="Quitar medio de pago" className="h-10 w-10 text-error hover:bg-error-container rounded"><span className="material-symbols-outlined">delete</span></button>}
            </div>
          ))}
          <button type="button" onClick={() => setMethods((current) => [...current, emptyMethod()])} className="self-start inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"><span className="material-symbols-outlined text-lg">add</span>Agregar medio</button>
          <p className="text-sm text-on-surface-variant">Distribución: {formatAmount(methodsTotal)}</p>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">Motivo de la corrección
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={500} required className="p-3 bg-surface-container-lowest border border-outline-variant/50 rounded-md font-normal focus:outline-none focus:border-primary resize-y" placeholder="Describí el error que se corrige" />
          <span className="text-xs font-normal text-on-surface-variant">{reason.length}/500</span>
        </label>

        {error && <p className="p-3 text-sm text-error bg-error-container rounded-md" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/30">
          <button type="button" onClick={onClose} disabled={saving} className="h-10 px-4 border border-outline-variant/50 rounded-md font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={saving || loadingAccount || !account} className="inline-flex items-center gap-2 h-10 px-4 bg-primary text-on-primary rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50">
            <span className="material-symbols-outlined text-lg">{saving ? 'progress_activity' : 'published_with_changes'}</span>{saving ? 'Registrando corrección...' : 'Registrar corrección'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default AmendPagoModal
