import { useEffect, useRef, useState } from 'react'
import { api } from '../../api/conf'
import useBarrios from '../../hooks/useBarrios'
import useLocalidades from '../../hooks/useLocalidades'
import { PrimaryButton, SecondaryButton } from '../personas/tabs/parts'
import { bindPhone } from '../socios/socioForm'
import { formatDni, phoneDigits, phoneError } from '../personas/format'
import { getTiposRelacionFamiliar } from '../../api/personasConfig'
import { RELATIONS, sonMismoDomicilio, tieneDatosDomicilioParciales, tieneDomicilioRegistrado } from './contacts'

const contactoVacio = {
  dni: '',
  telefono: '',
  nombre: '',
  apellido: '',
  email: '',
  relacion: '',
  responsable_legal: false,
  mismo_domicilio: false,
  domicilio_calle: '',
  domicilio_numero: '',
  domicilio_piso: '',
  domicilio_departamento: '',
  domicilio_entre_calle_1: '',
  domicilio_entre_calle_2: '',
  domicilio_localidad: '',
  domicilio_barrio: '',
}

const MIN_DIGITOS_BUSQUEDA = 3
const DEMORA_BUSQUEDA_MS = 300

const inputClass = 'w-full h-10 px-3 bg-surface-container-low rounded-lg text-base text-on-surface border border-outline-variant/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60'

function InputField({ label, required, className = '', children }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-base text-on-surface-variant font-semibold">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}

const personaAFormulario = (persona, domicilioTitular) => ({
  dni: String(persona.dni ?? ''),
  nombre: persona.nombre ?? '',
  apellido: persona.apellido ?? '',
  telefono: persona.telefono ?? '',
  email: persona.email ?? '',
  mismo_domicilio: sonMismoDomicilio(persona, domicilioTitular),
  domicilio_calle: persona.domicilio_calle ?? '',
  domicilio_numero: persona.domicilio_numero ?? '',
  domicilio_piso: persona.domicilio_piso ?? '',
  domicilio_departamento: persona.domicilio_departamento ?? '',
  domicilio_entre_calle_1: persona.domicilio_entre_calle_1 ?? '',
  domicilio_entre_calle_2: persona.domicilio_entre_calle_2 ?? '',
  domicilio_localidad: persona.domicilio_localidad ? String(persona.domicilio_localidad) : '',
  domicilio_barrio: persona.domicilio_barrio ? String(persona.domicilio_barrio) : '',
})

const contactoAFormulario = (contact, domicilioTitular) => ({
  ...contactoVacio,
  ...personaAFormulario(contact.persona ?? {}, domicilioTitular),
  relacion: contact.relacion ?? '',
  responsable_legal: Boolean(contact.responsable_legal),
})

export default function ContactModal({
  contact = null,
  onClose,
  onSubmit,
  domicilioTitular = null,
  etiquetaTitular = 'jugador',
  mostrarResponsableLegal = true,
}) {
  const editando = Boolean(contact)
  const [form, setForm] = useState(() => (editando ? contactoAFormulario(contact, domicilioTitular) : contactoVacio))
  const [saving, setSaving] = useState(false)
  const [searching, setSearching] = useState(false)
  const [coincidencias, setCoincidencias] = useState([])
  const [personaSeleccionada, setPersonaSeleccionada] = useState(editando ? contact.persona ?? null : null)
  const [tiposRelacion, setTiposRelacion] = useState(RELATIONS)

  useEffect(() => {
    getTiposRelacionFamiliar()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTiposRelacion(data.map((d) => d.nombre))
        }
      })
      .catch(() => {})
  }, [])

  const relaciones = useMemo(() => {
    const raw = [...new Set([...tiposRelacion, ...(form.relacion ? [form.relacion] : [])])]
    return raw.sort((a, b) => {
      const isOtroA = a.trim().toLowerCase() === 'otro'
      const isOtroB = b.trim().toLowerCase() === 'otro'
      if (isOtroA && !isOtroB) return 1
      if (!isOtroA && isOtroB) return -1
      return a.localeCompare(b, 'es')
    })
  }, [tiposRelacion, form.relacion])
  const [error, setError] = useState('')
  const ultimaBusqueda = useRef(0)

  const { localidades } = useLocalidades()
  const { barrios } = useBarrios(form.mismo_domicilio ? null : form.domicilio_localidad)

  useEffect(() => {
    const cerrarConEscape = (event) => event.key === 'Escape' && !saving && onClose()
    window.addEventListener('keydown', cerrarConEscape)
    return () => window.removeEventListener('keydown', cerrarConEscape)
  }, [onClose, saving])

  useEffect(() => {
    const dni = form.dni.trim()
    const dniTitular = String(domicilioTitular?.dni ?? '').trim()
    const busquedaId = ++ultimaBusqueda.current
    if (personaSeleccionada || dni.length < MIN_DIGITOS_BUSQUEDA) {
      setCoincidencias([])
      setSearching(false)
      return undefined
    }

    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const response = await api.get(`padron/persona/?dni_prefix=${encodeURIComponent(dni)}`)
        if (busquedaId === ultimaBusqueda.current) {
          const resultados = (response.data ?? []).filter(
            (persona) => !dniTitular || String(persona.dni ?? '').trim() !== dniTitular,
          )
          setCoincidencias(resultados)
        }
      } catch (requestError) {
        console.error('Error buscando persona', requestError)
        if (busquedaId === ultimaBusqueda.current) setCoincidencias([])
      } finally {
        if (busquedaId === ultimaBusqueda.current) setSearching(false)
      }
    }, DEMORA_BUSQUEDA_MS)

    return () => clearTimeout(timer)
  }, [form.dni, personaSeleccionada, domicilioTitular?.dni])

  const change = (campo) => (event) => {
    const { type, checked, value } = event.target
    setForm((actual) => ({
      ...actual,
      [campo]: type === 'checkbox' ? checked : value,
      ...(campo === 'domicilio_localidad' ? { domicilio_barrio: '' } : {}),
    }))
  }

  const seleccionarPersona = (persona) => {
    setPersonaSeleccionada(persona)
    setForm((actual) => ({ ...actual, ...personaAFormulario(persona, domicilioTitular) }))
  }

  const quitarSeleccion = () => {
    setPersonaSeleccionada(null)
    setForm((actual) => ({
      ...contactoVacio,
      relacion: actual.relacion,
      responsable_legal: actual.responsable_legal,
    }))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    const dniContacto = form.dni.trim()
    const dniTitular = String(domicilioTitular?.dni ?? '').trim()
    if (dniTitular && dniContacto === dniTitular) {
      setError(`No se puede registrar al mismo ${etiquetaTitular} como su propio contacto.`)
      return
    }

    const telefonoInvalido = phoneError(form.telefono)
    if (telefonoInvalido) {
      setError(telefonoInvalido)
      return
    }

    const requiereDomicilio = !form.mismo_domicilio && tieneDatosDomicilioParciales(form)
    if (requiereDomicilio) {
      if (!form.domicilio_calle.trim() || !form.domicilio_numero.trim() || !form.domicilio_localidad) {
        setError('Para registrar el domicilio del contacto debés completar calle, número y localidad.')
        return
      }
    }

    if (form.mismo_domicilio && domicilioTitular) {
      const calleTitular = String(domicilioTitular.domicilio_calle ?? '').trim()
      const numeroTitular = String(domicilioTitular.domicilio_numero ?? '').trim()
      const localidadTitular = domicilioTitular.domicilio_localidad
      if (!calleTitular || !numeroTitular || !localidadTitular) {
        setError(`Completá primero la calle, el número y la localidad del domicilio del ${etiquetaTitular}.`)
        return
      }
    }

    const origenDomicilio = form.mismo_domicilio && domicilioTitular ? domicilioTitular : form
    const calle = String(origenDomicilio.domicilio_calle ?? '').trim()
    const numero = String(origenDomicilio.domicilio_numero ?? '').trim()
    const localidad = origenDomicilio.domicilio_localidad

    const datosDomicilio = calle && numero && localidad
      ? {
          domicilio_calle: calle,
          domicilio_numero: numero,
          domicilio_piso: String(origenDomicilio.domicilio_piso ?? '').trim() || null,
          domicilio_departamento: String(origenDomicilio.domicilio_departamento ?? '').trim() || null,
          domicilio_entre_calle_1: String(origenDomicilio.domicilio_entre_calle_1 ?? '').trim() || null,
          domicilio_entre_calle_2: String(origenDomicilio.domicilio_entre_calle_2 ?? '').trim() || null,
          domicilio_localidad: Number(localidad),
          domicilio_barrio: origenDomicilio.domicilio_barrio ? Number(origenDomicilio.domicilio_barrio) : null,
        }
      : {}

    setSaving(true)
    try {
      await onSubmit({
        ...(editando ? { vinculo_familiar_id: contact.vinculo_familiar_id } : {}),
        persona: {
          dni: form.dni,
          telefono: phoneDigits(form.telefono),
          nombre: form.nombre,
          apellido: form.apellido,
          email: form.email || null,
          ...datosDomicilio,
        },
        relacion: form.relacion,
        responsable_legal: mostrarResponsableLegal ? form.responsable_legal : false,
        mismo_domicilio: form.mismo_domicilio,
        tiene_domicilio_previo: tieneDomicilioRegistrado(personaSeleccionada),
      })
      onClose()
    } catch (requestError) {
      setError(requestError.message || (editando ? 'No se pudo modificar el contacto.' : 'No se pudo agregar el contacto.'))
    } finally {
      setSaving(false)
    }
  }

  const dniBloqueado = saving || Boolean(personaSeleccionada)
  const bloquearMismoDomicilio = saving || tieneDomicilioRegistrado(personaSeleccionada)
  const requiereDomicilio = !form.mismo_domicilio && tieneDatosDomicilioParciales(form)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-inverse-surface/40" onClick={() => !saving && onClose()}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-agregar-contacto"
        className="w-full max-w-2xl max-h-[90vh] flex flex-col bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-4 pb-3 border-b border-surface-container shrink-0">
          <h2 id="titulo-agregar-contacto" className="text-xl font-bold text-on-surface">{editando ? 'Editar contacto' : 'Agregar contacto'}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-2">
            <InputField label="DNI" required>
              <div className="relative">
                <input
                  className={`${inputClass} pr-10`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej: 28492104"
                  value={form.dni}
                  onChange={(event) => setForm((actual) => ({ ...actual, dni: event.target.value.replace(/\D/g, '').slice(0, 8) }))}
                  required
                  disabled={dniBloqueado}
                  autoFocus
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex text-on-surface-variant pointer-events-none">
                  <span className={`material-symbols-outlined text-[20px] ${searching ? 'animate-spin' : ''}`}>
                    {searching ? 'progress_activity' : 'search'}
                  </span>
                </span>
              </div>
            </InputField>

            {personaSeleccionada && (
              <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-primary/10 text-sm text-on-surface">
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl text-primary">check_circle</span>
                  Persona existente seleccionada
                </span>
                <button
                  type="button"
                  onClick={quitarSeleccion}
                  disabled={saving}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Cambiar
                </button>
              </div>
            )}

            {!personaSeleccionada && coincidencias.length > 0 && (
              <ul className="flex flex-col rounded-lg border border-outline-variant/40 divide-y divide-outline-variant/30 overflow-hidden">
                {coincidencias.map((persona) => (
                  <li key={persona.dni}>
                    <button
                      type="button"
                      onClick={() => seleccionarPersona(persona)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-container-low transition-colors cursor-pointer"
                    >
                      <span className="flex flex-col">
                        <span className="text-base text-on-surface font-medium">
                          {`${persona.nombre ?? ''} ${persona.apellido ?? ''}`.trim() || 'Sin nombre'}
                        </span>
                        <span className="text-sm text-on-surface-variant">DNI {formatDni(persona.dni)}</span>
                      </span>
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant">arrow_forward</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <InputField label="Nombre" required>
            <input
              className={inputClass}
              placeholder="Ej: Marcos Agustín"
              value={form.nombre}
              onChange={change('nombre')}
              required
              disabled={saving}
            />
          </InputField>
          <InputField label="Apellido" required>
            <input
              className={inputClass}
              placeholder="Ej: Albarracín"
              value={form.apellido}
              onChange={change('apellido')}
              required
              disabled={saving}
            />
          </InputField>
          <InputField label="Correo electrónico">
            <input
              className={inputClass}
              type="email"
              placeholder="Ej: marcos.albarracin@ejemplo.com"
              value={form.email}
              onChange={change('email')}
              disabled={saving}
            />
          </InputField>
          <InputField label="Teléfono" required>
            <input
              className={inputClass}
              type="tel"
              placeholder="Ej: 221 459-2810"
              {...bindPhone({ value: form.telefono, onChange: change('telefono') })}
              required
              disabled={saving}
            />
          </InputField>
          <InputField label="Relación" required className={!mostrarResponsableLegal ? 'sm:col-span-2' : ''}>
            <select className={inputClass} value={form.relacion} onChange={change('relacion')} required disabled={saving}>
              <option value="" disabled>Seleccionar...</option>
              {relaciones.map((relacion) => <option key={relacion} value={relacion}>{relacion}</option>)}
            </select>
          </InputField>
          {mostrarResponsableLegal && (
            <label className="flex items-center gap-2 sm:mt-7 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-primary cursor-pointer"
                checked={form.responsable_legal}
                onChange={change('responsable_legal')}
                disabled={saving}
              />
              <span className="text-base text-on-surface font-medium">Responsable legal</span>
            </label>
          )}

          <div className="sm:col-span-2 pt-3 border-t border-outline-variant/30 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-primary">home_pin</span>
                Domicilio del contacto
              </span>
              <label
                className={`flex items-center gap-2 select-none ${bloquearMismoDomicilio ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                title={bloquearMismoDomicilio ? 'Esta persona ya tiene un domicilio registrado' : undefined}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                  checked={form.mismo_domicilio}
                  onChange={change('mismo_domicilio')}
                  disabled={bloquearMismoDomicilio}
                />
                <span className="text-sm text-on-surface font-medium">
                  Vive en el mismo domicilio que el {etiquetaTitular}
                </span>
              </label>
            </div>

            {!form.mismo_domicilio && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField label="Calle" required={requiereDomicilio}>
                  <input
                    className={inputClass}
                    placeholder="Ej: Calle 50"
                    value={form.domicilio_calle}
                    onChange={change('domicilio_calle')}
                    disabled={saving}
                  />
                </InputField>
                <InputField label="Número" required={requiereDomicilio}>
                  <input
                    className={inputClass}
                    placeholder="Ej: 1240"
                    value={form.domicilio_numero}
                    onChange={change('domicilio_numero')}
                    disabled={saving}
                  />
                </InputField>
                <InputField label="Piso">
                  <input
                    className={inputClass}
                    placeholder="Ej: 3"
                    value={form.domicilio_piso}
                    onChange={change('domicilio_piso')}
                    disabled={saving}
                  />
                </InputField>
                <InputField label="Departamento">
                  <input
                    className={inputClass}
                    placeholder="Ej: B"
                    value={form.domicilio_departamento}
                    onChange={change('domicilio_departamento')}
                    disabled={saving}
                  />
                </InputField>
                <InputField label="Entre calle 1">
                  <input
                    className={inputClass}
                    placeholder="Ej: Calle 19"
                    value={form.domicilio_entre_calle_1}
                    onChange={change('domicilio_entre_calle_1')}
                    disabled={saving}
                  />
                </InputField>
                <InputField label="Entre calle 2">
                  <input
                    className={inputClass}
                    placeholder="Ej: Calle 20"
                    value={form.domicilio_entre_calle_2}
                    onChange={change('domicilio_entre_calle_2')}
                    disabled={saving}
                  />
                </InputField>
                <InputField label="Localidad" required={requiereDomicilio}>
                  <select
                    className={inputClass}
                    value={form.domicilio_localidad}
                    onChange={change('domicilio_localidad')}
                    disabled={saving}
                  >
                    <option value="">Sin especificar</option>
                    {localidades.map((l) => (
                      <option key={l.localidad_id} value={String(l.localidad_id)}>{l.nombre}</option>
                    ))}
                  </select>
                </InputField>
                <InputField label="Barrio">
                  <select
                    className={inputClass}
                    value={form.domicilio_barrio}
                    onChange={change('domicilio_barrio')}
                    disabled={saving || !form.domicilio_localidad}
                  >
                    <option value="">
                      {form.domicilio_localidad ? 'Sin especificar' : 'Seleccione primero la localidad'}
                    </option>
                    {barrios.map((b) => (
                      <option key={b.barrio_id} value={String(b.barrio_id)}>{b.nombre}</option>
                    ))}
                  </select>
                </InputField>
              </div>
            )}
          </div>

          {error && (
            <p className="sm:col-span-2 px-3 py-2 rounded-lg bg-error-container/40 text-sm text-on-error-container">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-surface-container shrink-0">
          <SecondaryButton onClick={onClose} disabled={saving}>Cancelar</SecondaryButton>
          <PrimaryButton type="submit" icon={editando ? 'save' : 'person_add'} disabled={saving}>
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar contacto'}
          </PrimaryButton>
        </div>
      </form>
    </div>
  )
}
