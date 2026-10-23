import { useState } from 'react'
import { bindPhone, claseInput } from './socioForm'
import useBarrios from '../../hooks/useBarrios'

export function Campo({ id, label, requerido = false, opcional = false, hint, extra, error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={id}
        className={`text-base flex items-center justify-between ${requerido ? 'font-semibold text-on-surface' : 'font-medium text-on-surface-variant'}`}
      >
        <span>
          {label}
          {requerido && <span className="text-error font-bold"> *</span>}
          {hint && <span className="text-sm font-normal text-on-surface-variant ml-1">{hint}</span>}
        </span>
        {opcional && <span className="text-sm text-outline font-normal">Opcional</span>}
        {extra}
      </label>
      {children}
      {error && <p id={`error-${id}`} className="text-sm text-error font-medium">{error}</p>}
    </div>
  )
}

export function InputConIcono({ icono, conError, ...props }) {
  return (
    <div className="relative">
      <input className={claseInput(conError, 'pr-10')} aria-invalid={conError || undefined} {...props} />
      <span className={`material-symbols-outlined absolute right-3 top-3 text-base pointer-events-none ${conError ? 'text-error' : 'text-outline'}`}>
        {conError ? 'warning' : icono}
      </span>
    </div>
  )
}

export function SelectConFlecha({ conError, children, ...props }) {
  return (
    <div className="relative">
      <select className={claseInput(conError, 'pr-10 appearance-none cursor-pointer')} aria-invalid={conError || undefined} {...props}>
        {children}
      </select>
      <span className="material-symbols-outlined absolute right-3 top-3 text-outline text-base pointer-events-none">expand_more</span>
    </div>
  )
}

export function SeccionTitulo({ icono, titulo, extra }) {
  return (
    <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/20">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-base">{icono}</span>
        <h3 className="text-base font-bold uppercase tracking-wider text-on-surface">{titulo}</h3>
      </div>
      {extra}
    </div>
  )
}

export function SeccionDatosPersonales({ campoDni, bindInput, errores, generos, esGeneroOtro }) {
  return (
    <div className="flex flex-col gap-4">
      <SeccionTitulo icono="person" titulo="Datos Personales" />

      {campoDni}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <Campo id="nombre" label="Nombre" requerido error={errores.nombre}>
          <InputConIcono {...bindInput('nombre')} type="text" placeholder="Ej: Marcos Agustín" icono="person" conError={Boolean(errores.nombre)} />
        </Campo>
        <Campo id="apellido" label="Apellido" requerido error={errores.apellido}>
          <InputConIcono {...bindInput('apellido')} type="text" placeholder="Ej: Albarracín" icono="badge" conError={Boolean(errores.apellido)} />
        </Campo>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <Campo id="fecha_nacimiento" label="Fecha de Nacimiento" requerido error={errores.fecha_nacimiento}>
          <input
            {...bindInput('fecha_nacimiento')}
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            aria-invalid={Boolean(errores.fecha_nacimiento) || undefined}
            className={claseInput(Boolean(errores.fecha_nacimiento))}
          />
        </Campo>
        <Campo id="genero" label="Género" requerido error={errores.genero}>
          <SelectConFlecha {...bindInput('genero')} conError={Boolean(errores.genero)}>
            <option value="" disabled>Seleccione género...</option>
            {generos.map((g) => (
              <option key={g.genero_id} value={String(g.genero_id)}>{g.nombre}</option>
            ))}
          </SelectConFlecha>
        </Campo>
      </div>

      {esGeneroOtro && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
          <div className="hidden md:block" />
          <Campo id="genero_otro" label="Especifique el género" requerido error={errores.genero_otro}>
            <input {...bindInput('genero_otro')} type="text" placeholder="Ej: No binario" className={claseInput(Boolean(errores.genero_otro))} />
          </Campo>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <Campo
          id="telefono"
          label="Teléfono / Móvil"
          requerido
          error={errores.telefono}
          /*extra={(
            <span className="text-base text-[#00875a] font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">chat</span> WhatsApp activo
            </span>
          )}*/
        >
          <InputConIcono {...bindPhone(bindInput('telefono'))} type="tel" placeholder="Ej: 221 459-2810" icono="call" conError={Boolean(errores.telefono)} />
        </Campo>
        <Campo id="email" label="Correo Electrónico" requerido error={errores.email}>
          <InputConIcono {...bindInput('email')} type="email" placeholder="Ej: marcos.albarracin@ejemplo.com" icono="mail" conError={Boolean(errores.email)} />
        </Campo>
      </div>
    </div>
  )
}

const OPCION_NUEVA = '__nueva__'

function SelectConAlta({ id, label, labelNuevo, requerido = false, opcional = false, error, bind, opciones, opcionVacia, textoAgregar, placeholderNuevo, onCrear, disabled = false }) {
  const [agregando, setAgregando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [errorNuevo, setErrorNuevo] = useState('')
  const seleccionar = (valor) => bind.onChange({ target: { value: valor } })

  const cancelar = () => {
    setAgregando(false)
    setNombreNuevo('')
    setErrorNuevo('')
  }

  const cambiarSeleccion = (event) => {
    if (event.target.value === OPCION_NUEVA) {
      setAgregando(true)
      return
    }
    bind.onChange(event)
  }

  const agregar = async () => {
    const nombre = nombreNuevo.trim()
    if (!nombre) {
      setErrorNuevo('Ingrese un nombre.')
      return
    }
    setGuardando(true)
    try {
      seleccionar(await onCrear(nombre))
      cancelar()
    } catch {
      setErrorNuevo('No se pudo agregar.')
    } finally {
      setGuardando(false)
    }
  }

  const manejarTeclas = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      agregar()
    }
    if (event.key === 'Escape') cancelar()
  }

  if (agregando) {
    return (
      <Campo id={id} label={labelNuevo} requerido={requerido} opcional={opcional} error={errorNuevo}>
        <div className="flex gap-2">
          <input
            id={id}
            type="text"
            value={nombreNuevo}
            onChange={(event) => { setNombreNuevo(event.target.value); setErrorNuevo('') }}
            onKeyDown={manejarTeclas}
            placeholder={placeholderNuevo}
            maxLength={100}
            autoFocus
            className={claseInput(Boolean(errorNuevo))}
          />
          <button
            type="button"
            onClick={agregar}
            disabled={guardando}
            title="Agregar"
            className="h-11 px-3 rounded bg-primary hover:bg-primary/90 text-surface-container-lowest flex items-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base">check</span>
          </button>
          <button
            type="button"
            onClick={cancelar}
            disabled={guardando}
            title="Cancelar"
            className="h-11 px-3 rounded border border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low flex items-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </Campo>
    )
  }

  return (
    <Campo id={id} label={label} requerido={requerido} opcional={opcional} error={error}>
      <SelectConFlecha {...bind} onChange={cambiarSeleccion} disabled={bind.disabled || disabled} conError={Boolean(error)}>
        {opcionVacia}
        {opciones.map((opcion) => (
          <option key={opcion.value} value={opcion.value}>{opcion.label}</option>
        ))}
        {!disabled && <option value={OPCION_NUEVA}>{textoAgregar}</option>}
      </SelectConFlecha>
    </Campo>
  )
}

export function SeccionDomicilio({ bindInput, errores, localidades, onCrearLocalidad }) {
  const localidadInput = bindInput('domicilio_localidad')
  const barrioInput = bindInput('domicilio_barrio')
  const localidadId = localidadInput.value
  const { barrios, crearBarrio } = useBarrios(localidadId)

  const localidadBind = {
    ...localidadInput,
    onChange: (event) => {
      localidadInput.onChange(event)
      if (barrioInput.value) barrioInput.onChange({ target: { value: '' } })
    },
  }

  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-outline-variant/20">
      <SeccionTitulo icono="home_pin" titulo="Domicilio" />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Campo id="domicilio_calle" label="Calle" requerido error={errores.domicilio_calle} className="sm:col-span-2 md:col-span-1">
          <input {...bindInput('domicilio_calle')} type="text" placeholder="Ej: Calle 50" className={claseInput(Boolean(errores.domicilio_calle))} />
        </Campo>
        <Campo id="domicilio_numero" label="Número" requerido error={errores.domicilio_numero} className="sm:col-span-2 md:col-span-1">
          <input {...bindInput('domicilio_numero')} type="text" placeholder="Ej: 1240" className={claseInput(Boolean(errores.domicilio_numero))} />
        </Campo>
        <Campo id="domicilio_piso" label="Piso" opcional>
          <input {...bindInput('domicilio_piso')} type="text" placeholder="Ej: 3" className={claseInput(false)} />
        </Campo>
        <Campo id="domicilio_departamento" label="Departamento" opcional>
          <input {...bindInput('domicilio_departamento')} type="text" placeholder="Ej: B" className={claseInput(false)} />
        </Campo>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <Campo id="domicilio_entre_calle_1" label="Entre calle 1" opcional>
          <input {...bindInput('domicilio_entre_calle_1')} type="text" placeholder="Ej: Calle 19" className={claseInput(false)} />
        </Campo>
        <Campo id="domicilio_entre_calle_2" label="Entre calle 2" opcional>
          <input {...bindInput('domicilio_entre_calle_2')} type="text" placeholder="Ej: Calle 20" className={claseInput(false)} />
        </Campo>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        <SelectConAlta
          id="domicilio_localidad"
          label="Localidad"
          labelNuevo="Localidad nueva"
          requerido
          error={errores.domicilio_localidad}
          bind={localidadBind}
          opciones={localidades.map((l) => ({ value: String(l.localidad_id), label: l.nombre }))}
          opcionVacia={<option value="" disabled>Seleccione localidad...</option>}
          textoAgregar="+ Agregar localidad nueva..."
          placeholderNuevo="Ej: Magdalena"
          onCrear={async (nombre) => String((await onCrearLocalidad(nombre)).localidad_id)}
        />
        <SelectConAlta
          id="domicilio_barrio"
          label="Barrio"
          labelNuevo="Barrio nuevo"
          opcional
          error={errores.domicilio_barrio}
          bind={barrioInput}
          opciones={barrios.map((b) => ({ value: String(b.barrio_id), label: b.nombre }))}
          opcionVacia={<option value="">{localidadId ? 'Sin especificar' : 'Seleccione primero la localidad'}</option>}
          textoAgregar="+ Agregar barrio nuevo..."
          placeholderNuevo="Ej: Los Ombúes"
          onCrear={async (nombre) => String((await crearBarrio(nombre)).barrio_id)}
          disabled={!localidadId}
        />
      </div>
    </div>
  )
}
