import { useEffect, useState } from 'react'
import { collectErrorMessages, formatAmount } from '../personas/format'
import { claseInput } from '../socios/socioForm'
import { SelectConFlecha } from '../socios/SocioFormFields'
import SocioPicker from './SocioPicker'
import { crearMovimientoManual, getMovimientos } from '../../api/movimientos'

const OPTIONS = {
  IngresoManual: { label: 'Ingreso manual', tipo: 'Abono', help: 'Donaciones, indumentaria u otros ingresos.' },
  Egreso: { label: 'Egreso', tipo: 'Cargo', help: 'Salida de dinero de la caja.' },
  NotaCredito: { label: 'Nota de crédito', tipo: 'Cargo', help: 'Devuelve un ingreso registrado anteriormente.' },
}

const emptyForm = { socio: null, origen: 'IngresoManual', concepto: '', monto: '', medio_de_pago: 'Efectivo', movimiento_revertido_id: '' }

function MovimientoManualModal({ opened, onClose, onSuccess }) {
  const [form, setForm] = useState(emptyForm)
  const [movimientos, setMovimientos] = useState([])
  const [loadingMovimientos, setLoadingMovimientos] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!opened) return
    setForm(emptyForm)
    setMovimientos([])
    setError(null)
  }, [opened])

  useEffect(() => {
    if (!form.socio || form.origen !== 'NotaCredito') {
      setMovimientos([])
      return
    }
    let active = true
    setLoadingMovimientos(true)
    getMovimientos(form.socio.socio_id)
      .then((data) => active && setMovimientos(data.filter((movement) => !movement.movimiento_revertido && movement.origen_manual !== 'NotaCredito')))
      .catch(() => active && setError('No se pudieron cargar los movimientos del socio.'))
      .finally(() => active && setLoadingMovimientos(false))
    return () => { active = false }
  }, [form.socio, form.origen])

  const option = OPTIONS[form.origen]
  const canSubmit = form.socio && form.concepto.trim() && Number(form.monto) > 0
    && (form.origen !== 'NotaCredito' ? true : form.movimiento_revertido_id)

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await crearMovimientoManual({
        socio_id: form.socio.socio_id,
        tipo: option.tipo,
        origen: form.origen,
        concepto: form.concepto.trim(),
        monto: form.monto,
        medio_de_pago: form.origen === 'NotaCredito' ? null : form.medio_de_pago,
        movimiento_revertido_id: form.origen === 'NotaCredito' ? Number(form.movimiento_revertido_id) : null,
      })
      onSuccess?.()
      onClose()
    } catch (requestError) {
      setError(collectErrorMessages(requestError.response?.data).join(' | ') || 'No se pudo registrar el movimiento.')
    } finally {
      setSaving(false)
    }
  }

  if (!opened) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="movimiento-manual-title">
      <form onSubmit={submit} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-surface-container-lowest rounded-xl shadow-xl p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="movimiento-manual-title" className="text-2xl font-bold text-on-surface">Registrar movimiento</h2>
            <p className="text-sm text-on-surface-variant">{option.help}</p>
          </div>
          <button type="button" onClick={onClose} className="material-symbols-outlined text-on-surface-variant cursor-pointer" aria-label="Cerrar">close</button>
        </div>

        {error && <p className="p-3 rounded-lg bg-error-container text-on-error-container" role="alert">{error}</p>}

        {!form.socio ? (
          <SocioPicker onSelect={(socio) => update('socio', socio)} description="Seleccioná el socio asociado al movimiento." />
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-container-low">
            <span className="font-semibold text-on-surface">{form.socio.apellido}, {form.socio.nombre}</span>
            <button type="button" onClick={() => update('socio', null)} className="text-sm font-semibold text-primary cursor-pointer">Cambiar</button>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">
            Tipo de movimiento
            <SelectConFlecha value={form.origen} onChange={(event) => update('origen', event.target.value)} className={claseInput}>
              {Object.entries(OPTIONS).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
            </SelectConFlecha>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">
            Monto
            <input required type="number" min="0.01" step="0.01" value={form.monto} onChange={(event) => update('monto', event.target.value)} className={claseInput} placeholder="0,00" />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">
          Concepto
          <input required maxLength={200} value={form.concepto} onChange={(event) => update('concepto', event.target.value)} className={claseInput} placeholder="Ej. Donación o compra de indumentaria" />
        </label>

        {form.origen !== 'NotaCredito' ? (
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">
            Medio de pago
            <SelectConFlecha value={form.medio_de_pago} onChange={(event) => update('medio_de_pago', event.target.value)} className={claseInput}>
              <option value="Efectivo">Efectivo</option>
              <option value="Transferencia">Transferencia</option>
              <option value="BilleteraVirtual">Billetera virtual</option>
            </SelectConFlecha>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5 text-sm font-semibold text-on-surface">
            Movimiento a revertir
            <SelectConFlecha required value={form.movimiento_revertido_id} onChange={(event) => update('movimiento_revertido_id', event.target.value)} className={claseInput}>
              <option value="">{loadingMovimientos ? 'Cargando movimientos...' : 'Seleccioná un movimiento'}</option>
              {movimientos.map((movement) => <option key={movement.movimiento_cuenta_id} value={movement.movimiento_cuenta_id}>#{movement.movimiento_cuenta_id} · {movement.concepto} · {formatAmount(movement.monto)}</option>)}
            </SelectConFlecha>
          </label>
        )}

        <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant/20">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-outline-variant/40 font-semibold text-on-surface cursor-pointer">Cancelar</button>
          <button type="submit" disabled={!canSubmit || saving} className="h-10 px-5 rounded-lg bg-primary text-on-primary font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">{saving ? 'Guardando...' : 'Registrar movimiento'}</button>
        </div>
      </form>
    </div>
  )
}

export default MovimientoManualModal
