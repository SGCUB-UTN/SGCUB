import { useEffect, useMemo, useState } from 'react'
import useBarrios from '../../hooks/useBarrios'
import { getTiposRelacionFamiliar } from '../../api/personasConfig'
import { bindPhone, claseInput } from '../socios/socioForm'
import { Campo, InputConIcono, SelectConFlecha } from '../socios/SocioFormFields'
import { idCampoContacto, RELATIONS, tieneDatosDomicilioParciales } from './contacts'

export default function FilaContacto({
  fila,
  indice,
  errores,
  localidades = [],
  mostrarSinGuardar = false,
  mostrarResponsableLegal = true,
  resaltarResponsable = false,
  etiquetaTitular = 'jugador',
  onChange,
  onRemove,
}) {
  const { barrios } = useBarrios(fila.mismo_domicilio ? null : fila.domicilio_localidad)
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

  const opcionesRelacion = useMemo(() => {
    const raw = [...new Set([...tiposRelacion, ...(fila.relacion ? [fila.relacion] : [])])]
    return raw.sort((a, b) => {
      const isOtroA = a.trim().toLowerCase() === 'otro'
      const isOtroB = b.trim().toLowerCase() === 'otro'
      if (isOtroA && !isOtroB) return 1
      if (!isOtroA && isOtroB) return -1
      return a.localeCompare(b, 'es')
    })
  }, [tiposRelacion, fila.relacion])

  const bind = (campo) => ({
    id: idCampoContacto(fila, campo),
    value: fila[campo] ?? '',
    onChange: (event) => onChange(campo, event.target.value),
  })
  const error = (campo) => errores[idCampoContacto(fila, campo)]
  const requiereDomicilio = !fila.mismo_domicilio && tieneDatosDomicilioParciales(fila)
  const bloquearMismoDomicilio = Boolean(fila.tiene_domicilio_previo)

  const cambiarLocalidad = (event) => {
    onChange('domicilio_localidad', event.target.value)
    if (fila.domicilio_barrio) onChange('domicilio_barrio', '')
  }

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/30 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">{indice + 1}</span>
          <span className="text-base font-semibold text-on-surface">
            {`${fila.nombre} ${fila.apellido}`.trim() || 'Nuevo contacto'}
          </span>
          {mostrarSinGuardar && !fila.vinculo_familiar_id && (
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-sm font-medium">Sin guardar</span>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-sm font-medium text-error hover:bg-error-container/40 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">delete</span>
          Quitar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
        <Campo id={idCampoContacto(fila, 'dni')} label="DNI" requerido error={error('dni')}>
          <input
            {...bind('dni')}
            onChange={(event) => onChange('dni', event.target.value.replace(/\D/g, '').slice(0, 8))}
            type="text"
            inputMode="numeric"
            placeholder="Ej: 28492104"
            className={claseInput(Boolean(error('dni')), 'font-mono')}
          />
        </Campo>
        <Campo id={idCampoContacto(fila, 'nombre')} label="Nombre" requerido error={error('nombre')}>
          <input {...bind('nombre')} type="text" placeholder="Ej: Marcos Agustín" className={claseInput(Boolean(error('nombre')))} />
        </Campo>
        <Campo id={idCampoContacto(fila, 'apellido')} label="Apellido" requerido error={error('apellido')}>
          <input {...bind('apellido')} type="text" placeholder="Ej: Albarracín" className={claseInput(Boolean(error('apellido')))} />
        </Campo>
        <Campo id={idCampoContacto(fila, 'telefono')} label="Teléfono" requerido error={error('telefono')}>
          <InputConIcono {...bindPhone(bind('telefono'))} type="tel" placeholder="Ej: 221 459-2810" icono="call" conError={Boolean(error('telefono'))} />
        </Campo>
        <Campo id={idCampoContacto(fila, 'email')} label="Correo electrónico" opcional error={error('email')}>
          <InputConIcono {...bind('email')} type="email" placeholder="Ej: marcos.albarracin@ejemplo.com" icono="mail" conError={Boolean(error('email'))} />
        </Campo>
        <Campo id={idCampoContacto(fila, 'relacion')} label="Relación" requerido error={error('relacion')}>
          <SelectConFlecha {...bind('relacion')} conError={Boolean(error('relacion'))}>
            <option value="" disabled>Seleccionar...</option>
            {opcionesRelacion.map((relacion) => (
              <option key={relacion} value={relacion}>{relacion}</option>
            ))}
          </SelectConFlecha>
        </Campo>
      </div>

      <div className="pt-3 border-t border-outline-variant/25 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
              checked={Boolean(fila.mismo_domicilio)}
              disabled={bloquearMismoDomicilio}
              onChange={(event) => onChange('mismo_domicilio', event.target.checked)}
            />
            <span className="text-sm text-on-surface font-medium">
              Vive en el mismo domicilio que el {etiquetaTitular}
            </span>
          </label>
        </div>

        {!fila.mismo_domicilio && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
            <Campo
              id={idCampoContacto(fila, 'domicilio_calle')}
              label="Calle"
              requerido={requiereDomicilio}
              opcional={!requiereDomicilio}
              error={error('domicilio_calle')}
              className="sm:col-span-2 md:col-span-1"
            >
              <input
                {...bind('domicilio_calle')}
                type="text"
                placeholder="Ej: Calle 50"
                className={claseInput(Boolean(error('domicilio_calle')))}
              />
            </Campo>
            <Campo
              id={idCampoContacto(fila, 'domicilio_numero')}
              label="Número"
              requerido={requiereDomicilio}
              opcional={!requiereDomicilio}
              error={error('domicilio_numero')}
              className="sm:col-span-2 md:col-span-1"
            >
              <input
                {...bind('domicilio_numero')}
                type="text"
                placeholder="Ej: 1240"
                className={claseInput(Boolean(error('domicilio_numero')))}
              />
            </Campo>
            <Campo id={idCampoContacto(fila, 'domicilio_piso')} label="Piso" opcional>
              <input {...bind('domicilio_piso')} type="text" placeholder="Ej: 3" className={claseInput(false)} />
            </Campo>
            <Campo id={idCampoContacto(fila, 'domicilio_departamento')} label="Departamento" opcional>
              <input {...bind('domicilio_departamento')} type="text" placeholder="Ej: B" className={claseInput(false)} />
            </Campo>
            <Campo id={idCampoContacto(fila, 'domicilio_entre_calle_1')} label="Entre calle 1" opcional className="sm:col-span-1 md:col-span-2">
              <input {...bind('domicilio_entre_calle_1')} type="text" placeholder="Ej: Calle 19" className={claseInput(false)} />
            </Campo>
            <Campo id={idCampoContacto(fila, 'domicilio_entre_calle_2')} label="Entre calle 2" opcional className="sm:col-span-1 md:col-span-2">
              <input {...bind('domicilio_entre_calle_2')} type="text" placeholder="Ej: Calle 20" className={claseInput(false)} />
            </Campo>
            <Campo
              id={idCampoContacto(fila, 'domicilio_localidad')}
              label="Localidad"
              requerido={requiereDomicilio}
              opcional={!requiereDomicilio}
              error={error('domicilio_localidad')}
              className="sm:col-span-1 md:col-span-2"
            >
              <SelectConFlecha
                id={idCampoContacto(fila, 'domicilio_localidad')}
                value={fila.domicilio_localidad ?? ''}
                onChange={cambiarLocalidad}
                conError={Boolean(error('domicilio_localidad'))}
              >
                <option value="">Sin especificar</option>
                {localidades.map((l) => (
                  <option key={l.localidad_id} value={String(l.localidad_id)}>{l.nombre}</option>
                ))}
              </SelectConFlecha>
            </Campo>
            <Campo id={idCampoContacto(fila, 'domicilio_barrio')} label="Barrio" opcional className="sm:col-span-1 md:col-span-2">
              <SelectConFlecha
                {...bind('domicilio_barrio')}
                disabled={!fila.domicilio_localidad}
                conError={false}
              >
                <option value="">{fila.domicilio_localidad ? 'Sin especificar' : 'Seleccione primero la localidad'}</option>
                {barrios.map((b) => (
                  <option key={b.barrio_id} value={String(b.barrio_id)}>{b.nombre}</option>
                ))}
              </SelectConFlecha>
            </Campo>
          </div>
        )}
      </div>

      {mostrarResponsableLegal && (
        <label className={`flex items-center gap-2 cursor-pointer select-none w-fit ${resaltarResponsable ? 'px-2 py-1 -mx-2 rounded border-2 border-error bg-error-container/30' : ''}`}>
          <input
            type="checkbox"
            className="w-4 h-4 accent-primary cursor-pointer"
            checked={Boolean(fila.responsable_legal)}
            onChange={(event) => onChange('responsable_legal', event.target.checked)}
          />
          <span className="text-base text-on-surface font-medium">Responsable legal</span>
        </label>
      )}
    </div>
  )
}

