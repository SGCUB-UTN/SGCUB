import { useEffect, useMemo, useRef, useState } from 'react'
import { Modal, Text } from '@mantine/core'
import { api } from '../../api/conf'
import useBarrios from '../../hooks/useBarrios'
import { TEXT_BUTTON_CLASS } from '../shared/textButton'
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
const DIGITOS_DNI_COMPLETO = 7
const DEMORA_BUSQUEDA_MS = 300

const INPUT_BASE = 'w-full h-10 px-3 bg-surface-container-lowest rounded-lg text-base text-on-surface border focus:outline-none focus:ring-2 disabled:opacity-60 [&:is([readonly],[data-locked])]:bg-surface-container [&:is([readonly],[data-locked])]:text-on-surface-variant [&[data-locked]]:pointer-events-none'
const inputClass = (invalid = false) => `${INPUT_BASE} ${invalid
  ? 'border-error focus:border-error focus:ring-error/20'
  : 'border-outline-variant/40 focus:border-primary focus:ring-primary/20'}`

const FIELD_ORDER = ['dni', 'nombre', 'apellido', 'telefono', 'relacion', 'domicilio_calle', 'domicilio_numero', 'domicilio_localidad']

function InputField({ id, label, required, error, className = '', children }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-base text-on-surface-variant font-semibold">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="text-sm text-error font-medium">{error}</p>}
    </div>
  )
}

const fieldProps = (id, errors) => ({
  id,
  'aria-invalid': errors[id] ? true : undefined,
  'aria-describedby': errors[id] ? `${id}-error` : undefined,
})

const formatAddress = (person, localidades) => {
  if (!person?.domicilio_calle) return ''
  const street = [person.domicilio_calle, person.domicilio_numero].filter(Boolean).join(' ')
  const locality = localidades.find((item) => String(item.localidad_id) === String(person.domicilio_localidad))?.nombre
  return [street, locality].filter(Boolean).join(', ')
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
  const [fieldErrors, setFieldErrors] = useState({})
  const [editandoIdentidad, setEditandoIdentidad] = useState(false)

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
    setFieldErrors((actual) => ({ ...actual, [campo]: '' }))
    setForm((actual) => ({
      ...actual,
      [campo]: type === 'checkbox' ? checked : value,
      ...(campo === 'domicilio_localidad' ? { domicilio_barrio: '' } : {}),
    }))
  }

  const seleccionarPersona = (persona) => {
    setPersonaSeleccionada(persona)
    setEditandoIdentidad(false)
    setFieldErrors({})
    setForm((actual) => ({ ...actual, ...personaAFormulario(persona, domicilioTitular) }))
  }

  const quitarSeleccion = () => {
    setPersonaSeleccionada(null)
    setEditandoIdentidad(false)
    setForm((actual) => ({
      ...contactoVacio,
      relacion: actual.relacion,
      responsable_legal: actual.responsable_legal,
    }))
  }

  const validate = () => {
    const dniContacto = form.dni.trim()
    const dniTitular = String(domicilioTitular?.dni ?? '').trim()
    const conDomicilio = !form.mismo_domicilio && tieneDatosDomicilioParciales(form)
    const errors = {
      dni: !dniContacto ? 'Ingresá el DNI.'
        : dniTitular && dniContacto === dniTitular ? `No se puede registrar al mismo ${etiquetaTitular} como su propio contacto.` : '',
      nombre: !form.nombre.trim() ? 'Ingresá el nombre.' : '',
      apellido: !form.apellido.trim() ? 'Ingresá el apellido.' : '',
      telefono: !form.telefono.trim() ? 'Ingresá el teléfono.' : phoneError(form.telefono) || '',
      relacion: !form.relacion ? 'Elegí el vínculo.' : '',
      domicilio_calle: conDomicilio && !form.domicilio_calle.trim() ? 'Completá la calle para registrar el domicilio.' : '',
      domicilio_numero: conDomicilio && !form.domicilio_numero.trim() ? 'Completá el número.' : '',
      domicilio_localidad: conDomicilio && !form.domicilio_localidad ? 'Elegí la localidad.' : '',
    }
    return Object.fromEntries(Object.entries(errors).filter(([, message]) => message))
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    const errors = validate()
    setFieldErrors(errors)
    const firstInvalid = FIELD_ORDER.find((field) => errors[field])
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus()
      return
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
      setTimeout(() => document.getElementById('contact-form-error')?.scrollIntoView({ block: 'nearest' }), 0)
    } finally {
      setSaving(false)
    }
  }

  const dniBloqueado = saving || Boolean(personaSeleccionada)
  const identidadBloqueada = Boolean(personaSeleccionada) && !editandoIdentidad
  const dniCompleto = form.dni.trim().length >= DIGITOS_DNI_COMPLETO
  const sinCoincidencias = !personaSeleccionada && dniCompleto && !searching && coincidencias.length === 0
  const domicilioTitularTexto = formatAddress(domicilioTitular, localidades)
  const bloquearMismoDomicilio = saving || tieneDomicilioRegistrado(personaSeleccionada)
  const domicilioBloqueado = identidadBloqueada && tieneDomicilioRegistrado(personaSeleccionada)
  const selectBloqueadoProps = domicilioBloqueado ? { 'data-locked': true, 'aria-readonly': true, tabIndex: -1 } : {}
  const requiereDomicilio = !form.mismo_domicilio && tieneDatosDomicilioParciales(form)

  return (
    <Modal
      opened
      onClose={() => !saving && onClose()}
      centered
      size="xl"
      title={<Text fw={700} size="xl">{editando ? 'Editar contacto' : 'Agregar contacto'}</Text>}
    >
      <form onSubmit={submit} noValidate className="flex flex-col">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 flex flex-col gap-2">
            <InputField id="dni" label="DNI" required error={fieldErrors.dni}>
              <div className="relative">
                <input
                  {...fieldProps('dni', fieldErrors)}
                  className={`${inputClass(Boolean(fieldErrors.dni))} pr-10`}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="Ej: 28492104"
                  value={form.dni}
                  onChange={(event) => {
                    setFieldErrors((actual) => ({ ...actual, dni: '' }))
                    setForm((actual) => ({ ...actual, dni: event.target.value.replace(/\D/g, '').slice(0, 8) }))
                  }}
                  disabled={dniBloqueado}
                  autoFocus
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex text-on-surface-variant pointer-events-none" aria-hidden="true">
                  <span className={`material-symbols-outlined text-[20px] ${searching ? 'animate-spin' : ''}`}>
                    {searching ? 'progress_activity' : 'search'}
                  </span>
                </span>
              </div>
            </InputField>

            {personaSeleccionada && (
              <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-primary/10 text-base text-on-surface" role="status">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl text-primary" aria-hidden="true">check_circle</span>
                    Persona ya registrada en el club
                  </span>
                  <span className="flex items-center gap-3">
                    {identidadBloqueada && (
                      <button type="button" onClick={() => setEditandoIdentidad(true)} disabled={saving} className={TEXT_BUTTON_CLASS}>
                        Editar sus datos
                      </button>
                    )}
                    <button type="button" onClick={quitarSeleccion} disabled={saving} className={TEXT_BUTTON_CLASS}>
                      Elegir otra
                    </button>
                  </span>
                </div>
                {editandoIdentidad && (
                  <p className="text-sm text-on-surface-variant">
                    Los cambios en sus datos personales y su domicilio se guardan en la persona y se ven en todos los lugares donde figura.
                  </p>
                )}
              </div>
            )}

            {sinCoincidencias && (
              <p className="flex items-center gap-2 text-base text-on-surface-variant" role="status">
                <span className="material-symbols-outlined text-[20px] text-outline" aria-hidden="true">person_add</span>
                No hay nadie registrado con ese DNI: se va a crear una persona nueva.
              </p>
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
                      <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">arrow_forward</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <InputField id="nombre" label="Nombre" required error={fieldErrors.nombre}>
            <input
              {...fieldProps('nombre', fieldErrors)}
              className={inputClass(Boolean(fieldErrors.nombre))}
              placeholder="Ej: Marcos Agustín"
              value={form.nombre}
              onChange={change('nombre')}
              readOnly={identidadBloqueada}
              disabled={saving}
            />
          </InputField>
          <InputField id="apellido" label="Apellido" required error={fieldErrors.apellido}>
            <input
              {...fieldProps('apellido', fieldErrors)}
              className={inputClass(Boolean(fieldErrors.apellido))}
              placeholder="Ej: Albarracín"
              value={form.apellido}
              onChange={change('apellido')}
              readOnly={identidadBloqueada}
              disabled={saving}
            />
          </InputField>
          <InputField id="email" label="Correo electrónico">
            <input
              id="email"
              className={inputClass()}
              readOnly={identidadBloqueada}
              type="email"
              placeholder="Ej: marcos.albarracin@ejemplo.com"
              value={form.email}
              onChange={change('email')}
              disabled={saving}
            />
          </InputField>
          <InputField id="telefono" label="Teléfono" required error={fieldErrors.telefono}>
            <input
              {...fieldProps('telefono', fieldErrors)}
              className={inputClass(Boolean(fieldErrors.telefono))}
              type="tel"
              placeholder="Ej: 221 459-2810"
              {...bindPhone({ value: form.telefono, onChange: change('telefono') })}
              readOnly={identidadBloqueada}
              disabled={saving}
            />
          </InputField>
          <InputField id="relacion" label="Vínculo" required error={fieldErrors.relacion} className={!mostrarResponsableLegal ? 'sm:col-span-2' : ''}>
            <select {...fieldProps('relacion', fieldErrors)} className={inputClass(Boolean(fieldErrors.relacion))} value={form.relacion} onChange={change('relacion')} disabled={saving}>
              <option value="" disabled>Elegí el vínculo</option>
              {relaciones.map((relacion) => <option key={relacion} value={relacion}>{relacion}</option>)}
            </select>
          </InputField>
          {mostrarResponsableLegal && (
            <label className="flex items-center gap-2 sm:mt-7 cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-5 accent-primary cursor-pointer"
                checked={form.responsable_legal}
                onChange={change('responsable_legal')}
                disabled={saving}
              />
              <span className="text-base text-on-surface font-medium">Responsable legal</span>
            </label>
          )}

          <div className="sm:col-span-2 pt-3 border-t border-outline-variant/30 flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-base font-semibold text-on-surface flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px] text-primary" aria-hidden="true">home_pin</span>
                Domicilio del contacto
              </span>
              <label className={`flex items-center gap-2 select-none ${bloquearMismoDomicilio ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  className="size-5 accent-primary cursor-pointer disabled:cursor-not-allowed"
                  checked={form.mismo_domicilio}
                  onChange={change('mismo_domicilio')}
                  disabled={bloquearMismoDomicilio}
                />
                <span className="text-base text-on-surface font-medium">
                  Vive en el mismo domicilio que el {etiquetaTitular}
                </span>
              </label>
            </div>
            {bloquearMismoDomicilio && !saving && (
              <p className="text-sm text-on-surface-variant">Esta persona ya tiene un domicilio registrado, por eso no se puede usar el del {etiquetaTitular}.</p>
            )}
            {form.mismo_domicilio && (
              <p className="text-base text-on-surface-variant">
                {domicilioTitularTexto
                  ? <>Se usa el domicilio del {etiquetaTitular}: <strong className="text-on-surface">{domicilioTitularTexto}</strong></>
                  : `El ${etiquetaTitular} todavía no tiene un domicilio completo cargado.`}
              </p>
            )}

            {!form.mismo_domicilio && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputField id="domicilio_calle" label="Calle" required={requiereDomicilio} error={fieldErrors.domicilio_calle}>
                  <input
                    {...fieldProps('domicilio_calle', fieldErrors)}
                    className={inputClass(Boolean(fieldErrors.domicilio_calle))}
                    placeholder="Ej: Calle 50"
                    value={form.domicilio_calle}
                    onChange={change('domicilio_calle')}
                    readOnly={domicilioBloqueado}
                    disabled={saving}
                  />
                </InputField>
                <InputField id="domicilio_numero" label="Número" required={requiereDomicilio} error={fieldErrors.domicilio_numero}>
                  <input
                    {...fieldProps('domicilio_numero', fieldErrors)}
                    className={inputClass(Boolean(fieldErrors.domicilio_numero))}
                    placeholder="Ej: 1240"
                    value={form.domicilio_numero}
                    onChange={change('domicilio_numero')}
                    readOnly={domicilioBloqueado}
                    disabled={saving}
                  />
                </InputField>
                <InputField id="domicilio_piso" label="Piso">
                  <input
                    id="domicilio_piso"
                    className={inputClass()}
                    placeholder="Ej: 3"
                    value={form.domicilio_piso}
                    onChange={change('domicilio_piso')}
                    readOnly={domicilioBloqueado}
                    disabled={saving}
                  />
                </InputField>
                <InputField id="domicilio_departamento" label="Departamento">
                  <input
                    id="domicilio_departamento"
                    className={inputClass()}
                    placeholder="Ej: B"
                    value={form.domicilio_departamento}
                    onChange={change('domicilio_departamento')}
                    readOnly={domicilioBloqueado}
                    disabled={saving}
                  />
                </InputField>
                <InputField id="domicilio_entre_calle_1" label="Entre calle 1">
                  <input
                    id="domicilio_entre_calle_1"
                    className={inputClass()}
                    placeholder="Ej: Calle 19"
                    value={form.domicilio_entre_calle_1}
                    onChange={change('domicilio_entre_calle_1')}
                    readOnly={domicilioBloqueado}
                    disabled={saving}
                  />
                </InputField>
                <InputField id="domicilio_entre_calle_2" label="Entre calle 2">
                  <input
                    id="domicilio_entre_calle_2"
                    className={inputClass()}
                    placeholder="Ej: Calle 20"
                    value={form.domicilio_entre_calle_2}
                    onChange={change('domicilio_entre_calle_2')}
                    readOnly={domicilioBloqueado}
                    disabled={saving}
                  />
                </InputField>
                <InputField id="domicilio_localidad" label="Localidad" required={requiereDomicilio} error={fieldErrors.domicilio_localidad}>
                  <select
                    {...fieldProps('domicilio_localidad', fieldErrors)}
                    className={inputClass(Boolean(fieldErrors.domicilio_localidad))}
                    value={form.domicilio_localidad}
                    onChange={change('domicilio_localidad')}
                    {...selectBloqueadoProps}
                    disabled={saving}
                  >
                    <option value="">Sin especificar</option>
                    {localidades.map((l) => (
                      <option key={l.localidad_id} value={String(l.localidad_id)}>{l.nombre}</option>
                    ))}
                  </select>
                </InputField>
                <InputField id="domicilio_barrio" label="Barrio">
                  <select
                    id="domicilio_barrio"
                    className={inputClass()}
                    value={form.domicilio_barrio}
                    onChange={change('domicilio_barrio')}
                    {...selectBloqueadoProps}
                    disabled={saving || !form.domicilio_localidad}
                  >
                    <option value="">
                      {form.domicilio_localidad ? 'Sin especificar' : 'Elegí primero la localidad'}
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
            <p id="contact-form-error" className="sm:col-span-2 px-3 py-2 rounded-lg bg-error-container/40 text-base text-on-error-container" role="alert">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 mt-6 border-t border-surface-container">
          <SecondaryButton onClick={onClose} disabled={saving}>Cancelar</SecondaryButton>
          <PrimaryButton type="submit" icon={editando ? 'save' : 'person_add'} disabled={saving}>
            {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Agregar contacto'}
          </PrimaryButton>
        </div>
      </form>
    </Modal>
  )
}
