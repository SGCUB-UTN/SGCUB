import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api/conf'
import { getSocio } from '../api/socios'
import PageHeader from '../components/shared/PageHeader'
import { getErrorMessage } from '../components/personas/format'

import { BotonCambiarPersona, ListaSugerenciasPersona } from '../components/shared/PersonaSearchDNI'
import usePersonaSearchDNI from '../hooks/usePersonaSearchDNI'
import useSocio from '../hooks/useSocio'
import useGeneros from '../hooks/useGeneros'
import useLocalidades from '../hooks/useLocalidades'
import { CAMPOS_OBLIGATORIOS, FORM_INICIAL, claseInput, enfocarCampo, socioAFormulario, validar } from '../components/socios/socioForm'
import { Campo, SeccionDatosPersonales, SeccionDomicilio, SeccionTitulo, SelectConFlecha } from '../components/socios/SocioFormFields'

const formatearDni = (dni) => {
  const numero = Number(dni)
  return Number.isNaN(numero) ? dni : numero.toLocaleString('es-AR')
}

const CAMPOS_BLOQUEADOS_PERSONA = ['nombre', 'apellido', 'fecha_nacimiento', 'genero', 'genero_otro']

const formatearNumeroSocio =(numero) => `#${String(numero).padStart(4, '0')}`

const formatearFecha = (fecha) => {
  if (!fecha) return '—'
  const partes = String(fecha).split('-')
  return partes.length === 3 ? `${partes[2]}/${partes[1]}/${partes[0]}` : fecha
}

function SocioForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()

  const { socios, crearSocio, modificarSocio } = useSocio()
  const { generos } = useGeneros()
  const { localidades, crearLocalidad } = useLocalidades()

  const [formularioEditado, setFormulario] = useState(FORM_INICIAL)
  const [socioOriginal, setSocioOriginal] = useState(null)
  const [cargando, setCargando] = useState(editando)
  const [errorCarga, setErrorCarga] = useState('')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [estadosSocio, setEstadosSocio] = useState([])
  const [personaEncontrada, setPersonaEncontrada] = useState(null)
  const busqueda = usePersonaSearchDNI({ habilitada: !editando })

  useEffect(() => {
    if (!editando) return
    let activo = true
    getSocio(id)
      .then((socio) => {
        if (!activo) return
        setSocioOriginal(socio)
        setFormulario(socioAFormulario(socio))
      })
      .catch((requestError) => {
        if (activo) setErrorCarga(requestError.response?.data?.detail || 'No se pudo cargar el socio.')
      })
      .finally(() => activo && setCargando(false))
    api.get('padron/estado-socio/').then((res) => activo && setEstadosSocio(res.data)).catch(console.error)
    return () => { activo = false }
  }, [editando, id])

  const localidadPorDefecto = editando
    ? ''
    : String(localidades.find((l) => l.nombre?.toLowerCase() === 'berisso')?.localidad_id ?? '')
  const formulario = useMemo(() => ({
    ...formularioEditado,
    domicilio_localidad: formularioEditado.domicilio_localidad || localidadPorDefecto,
  }), [formularioEditado, localidadPorDefecto])

  const generoOtroId = generos.find((g) => g.nombre === 'Otro')?.genero_id
  const esGeneroOtro = generoOtroId !== undefined && formulario.genero === String(generoOtroId)

  const proximoNumero = useMemo(() => {
    const numeros = socios.map((s) => parseInt(s.numero_socio, 10)).filter((n) => !Number.isNaN(n))
    return numeros.length ? formatearNumeroSocio(Math.max(...numeros) + 1) : '—'
  }, [socios])

  const dniIngresado = formulario.dni.trim()
  const socioDuplicado = useMemo(() => {
    if (!editando || !/^\d{7,8}$/.test(dniIngresado)) return null
    return socios.find((s) => String(s.dni) === dniIngresado && String(s.socio_id) !== String(id)) ?? null
  }, [socios, dniIngresado, editando, id])

  const perfilesSeleccionados = editando ? null : personaEncontrada?.perfiles
  const socioSeleccionado = perfilesSeleccionados?.socio_id
    ? socios.find((s) => String(s.socio_id) === String(perfilesSeleccionados.socio_id)) ?? { ...personaEncontrada, socio_id: perfilesSeleccionados.socio_id }
    : null
  const dniSinSeleccionar = !editando && !personaEncontrada
    ? busqueda.coincidencias.find((persona) => String(persona.dni) === dniIngresado) ?? null
    : null

  const limpiarError = (campo) => {
    if (errores[campo]) setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
  }

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }))
    limpiarError(campo)
  }

  const campoBloqueado = (campo) => !editando
    && Boolean(personaEncontrada)
    && CAMPOS_BLOQUEADOS_PERSONA.includes(campo)
    && String(personaEncontrada[campo] ?? '').trim() !== ''

  const bindInput = (campo) => ({
    id: campo,
    name: campo,
    value: formulario[campo],
    onChange: (event) => actualizarCampo(campo, event.target.value),
    disabled: campoBloqueado(campo),
  })

  const limpiarErroresPersona = () => setErrores((actuales) => ({
    ...actuales,
    ...Object.fromEntries([...CAMPOS_OBLIGATORIOS, 'genero_otro'].map((campo) => [campo, undefined])),
  }))

  const cambiarDni = (event) => {
    const dni = event.target.value.replace(/\D/g, '').slice(0, 8)
    if (personaEncontrada) {
      // Al cambiar el DNI se descarta la persona elegida y los datos que se habían autocompletado.
      setPersonaEncontrada(null)
      setFormulario({ ...FORM_INICIAL, dni })
    } else {
      actualizarCampo('dni', dni)
    }
    limpiarError('dni')
    busqueda.buscar(dni)
  }

  const quitarSeleccion = () => {
    setPersonaEncontrada(null)
    busqueda.limpiar()
    setFormulario(FORM_INICIAL)
    limpiarErroresPersona()
    enfocarCampo('dni')
  }

  const seleccionarPersona = (persona) => {
    setPersonaEncontrada(persona)
    busqueda.setAbiertas(false)
    setFormulario(socioAFormulario(persona))
    limpiarErroresPersona()
  }

  const guardar = async (event) => {
    event.preventDefault()
    setErrorGuardado('')

    const nuevosErrores = validar(formulario, esGeneroOtro)
    if (socioDuplicado || socioSeleccionado) nuevosErrores.dni = 'Esta persona ya está registrada como socio.'
    if (dniSinSeleccionar) nuevosErrores.dni = 'Este DNI ya está registrado: seleccioná la persona en la lista de sugerencias.'
    setErrores(nuevosErrores)

    const primerError = [...CAMPOS_OBLIGATORIOS, 'genero_otro'].find((campo) => nuevosErrores[campo])
    if (primerError) {
      enfocarCampo(primerError)
      return
    }

    const payload = { ...formulario }
    if (!payload.estado_administrativo) delete payload.estado_administrativo
    if (!esGeneroOtro) payload.genero_otro = ''

    setGuardando(true)
    try {
      const resultado = editando
        ? await modificarSocio(id, payload)
        : await crearSocio(payload)
      const socioId = resultado?.socio_id ?? id
      const tabFinanciero = !editando ? '?tab=financiero' : ''
      navigate(socioId ? `/padron/socios/${socioId}${tabFinanciero}` : '/padron/socios')
    } catch (requestError) {
      setErrorGuardado(getErrorMessage(requestError, editando ? 'No se pudo modificar el socio.' : 'No se pudo agregar el socio.'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setGuardando(false)
    }
  }

  const rutaVolver = editando ? `/padron/socios/${id}` : '/padron/socios'
  const nombreEditado = socioOriginal ? `${socioOriginal.nombre ?? ''} ${socioOriginal.apellido ?? ''}`.trim() : ''
  const dniConError = Boolean(errores.dni) || Boolean(socioDuplicado) || Boolean(socioSeleccionado)
  const mostrarSugerencias = !editando && !personaEncontrada && busqueda.abiertas && busqueda.coincidencias.length > 0
  const iconoDni = busqueda.buscando ? 'progress_activity' : dniConError ? 'warning' : personaEncontrada ? 'check_circle' : 'fingerprint'
  const colorIconoDni = dniConError ? 'text-error' : personaEncontrada ? 'text-[#00875a]' : 'text-outline'

  if (cargando) {
    return (
      <div className="max-w-5xl mx-auto w-full py-16 flex flex-col items-center gap-3 text-on-surface-variant">
        <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
        <p className="text-sm">Cargando datos del socio...</p>
      </div>
    )
  }

  if (errorCarga) {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-4 pt-2">
        <Link to="/padron/socios" className="inline-flex items-center gap-1.5 text-xl font-medium text-on-surface-variant hover:text-primary px-3 py-1.5 rounded transition-colors bg-surface-container-lowest border border-outline-variant/30">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Volver al padrón</span>
        </Link>
        <div className="bg-error-container text-on-error-container p-4 rounded-lg border border-error/30 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-error text-base">error</span>
          <p className="text-sm font-medium">{errorCarga}</p>
        </div>
      </div>
    )
  }

  return (
    <div className= "mx-auto w-full space-y-6 pb-12">
      <PageHeader
        breadcrumb={[
          { label: 'Personas' },
          { label: 'Socios', to: '/padron/socios' },
          ...(editando && nombreEditado ? [{ label: nombreEditado, to: `/padron/socios/${id}` }] : []),
          { label: editando ? 'Editar' : 'Nuevo socio' },
        ]}
        title={editando ? 'Editar Socio' : 'Alta de Nuevo Socio'}
        actions={(
          <>
            <div className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-center gap-2">
              <span className="text-base font-semibold text-outline uppercase tracking-wider">
                {editando ? 'N° de socio:' : 'Próximo N°:'}
              </span>
              <span className="font-mono text-base font-bold text-primary">
                {editando
                  ? (socioOriginal?.numero_socio ? formatearNumeroSocio(socioOriginal.numero_socio) : '—')
                  : proximoNumero}
              </span>
            </div>
            <div className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-center gap-2">
              <span className="text-base font-semibold text-outline uppercase tracking-wider">Fecha de alta:</span>
              <span className="text-base font-semibold text-on-surface">
                {editando ? formatearFecha(socioOriginal?.fecha_alta) : 'Hoy (' + new Date().toLocaleDateString('es-AR') + ')'}
              </span>
            </div>
            <Link
              to={rutaVolver}
              className="inline-flex items-center gap-1.5 text-base font-medium text-on-surface-variant hover:text-primary px-3 py-1.5 rounded transition-colors bg-surface-container-lowest border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>{editando ? 'Volver a la ficha' : 'Volver al padrón'}</span>
            </Link>
          </>
        )}
      />

      {errorGuardado && (
        <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5 shadow-sm" role="alert">
          <div className="p-1 bg-error/10 text-error rounded shrink-0">
            <span className="material-symbols-outlined text-base">error</span>
          </div>
          <div>
            <p className="text-base font-bold">No se pudo guardar el socio</p>
            <p className="text-base text-on-error-container/80 mt-0.5 break-words">{errorGuardado}</p>
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">badge</span>
            <h2 className="text-base font-semibold text-on-surface">Datos Personales y de Contacto</h2>
          </div>
        </div>

        <form id="form-socio" className="p-6 md:p-8" onSubmit={guardar} noValidate>
          <div className="space-y-6">
            <SeccionDatosPersonales
              bindInput={bindInput}
              errores={errores}
              generos={generos}
              esGeneroOtro={esGeneroOtro}
              campoDni={(
                <Campo
                  id="dni"
                  label="Documento Nacional de Identidad (DNI)"
                  requerido
                  hint="(sin puntos ni guiones)"
                  error={errores.dni}
                >
                  <div className="relative">
                    <input
                      {...bindInput('dni')}
                      onChange={cambiarDni}
                      onFocus={() => busqueda.setAbiertas(true)}
                      onBlur={() => busqueda.setAbiertas(false)}
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej: 38492104"
                      role="combobox"
                      aria-expanded={mostrarSugerencias}
                      aria-controls="sugerencias-dni"
                      aria-invalid={dniConError || undefined}
                      className={claseInput(dniConError, 'pr-10 font-mono font-medium')}
                    />
                    <span className={`material-symbols-outlined absolute right-3 top-3 text-base pointer-events-none ${colorIconoDni} ${busqueda.buscando ? 'animate-spin' : ''}`}>
                      {iconoDni}
                    </span>

                    {mostrarSugerencias && (
                      <ListaSugerenciasPersona
                        id="sugerencias-dni"
                        coincidencias={busqueda.coincidencias}
                        onSelect={seleccionarPersona}
                        etiquetaDe={(persona) => {
                          if (persona.perfiles?.socio_id) return { texto: 'Ya es socio', tono: 'error' }
                          if (persona.perfiles?.docente_id) return { texto: 'Docente', tono: 'info' }
                          return null
                        }}
                      />
                    )}
                  </div>

                  {socioDuplicado && (
                    <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mt-1" role="alert">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1 bg-error/10 text-error rounded shrink-0">
                          <span className="material-symbols-outlined text-base">error</span>
                        </div>
                        <div>
                          <p className="text-base font-bold text-on-error-container">
                            Ya existe un socio registrado con el DNI:{' '}
                            <span>
                              {formatearDni(socioDuplicado.dni)}
                            </span>
                          </p>
                          <p className="text-base text-on-error-container/80 mt-0.5">
                            El documento ingresado pertenece a{' '}
                            <strong>{`${socioDuplicado.nombre ?? ''} ${socioDuplicado.apellido ?? ''}`.trim()}</strong>
                            {' '}(Socio N° {socioDuplicado.numero_socio ? formatearNumeroSocio(socioDuplicado.numero_socio) : '—'}
                            {socioDuplicado.estado_administrativo_nombre ? ` - ${socioDuplicado.estado_administrativo_nombre}` : ''}).
                            {' '}No es posible duplicar legajos en el padrón.
                          </p>
                        </div>
                      </div>
                      <Link
                        to={`/padron/socios/${socioDuplicado.socio_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-on-error-container  hover:opacity-90 rounded text-base font-semibold shrink-0 transition-opacity"
                      >
                        <span>Ver ficha existente</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    </div>
                  )}

                  {socioSeleccionado && (
                    <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mt-1" role="alert">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1 bg-error/10 text-error rounded shrink-0">
                          <span className="material-symbols-outlined text-base">error</span>
                        </div>
                        <p className="text-base">
                          <strong>{`${personaEncontrada.nombre ?? ''} ${personaEncontrada.apellido ?? ''}`.trim()}</strong>
                          {' '}(DNI {formatearDni(personaEncontrada.dni)}) ya está registrado como socio
                          {socioSeleccionado.numero_socio ? ` (Socio N° ${formatearNumeroSocio(socioSeleccionado.numero_socio)})` : ''}.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <BotonCambiarPersona onClick={quitarSeleccion} />
                        <Link
                          to={`/padron/socios/${socioSeleccionado.socio_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-on-error-container hover:opacity-90 rounded text-base font-semibold shrink-0 transition-opacity"
                        >
                          <span>Ver ficha existente</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {personaEncontrada && !socioSeleccionado && (
                    <div className="bg-surface-container-low text-on-surface p-3 rounded-lg border border-outline-variant/40 flex items-center justify-between gap-2.5 mt-1">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-base text-[#00875a]">how_to_reg</span>
                        <p className="text-base">
                          <strong>{`${personaEncontrada.nombre ?? ''} ${personaEncontrada.apellido ?? ''}`.trim()}</strong>
                          {' '}ya está registrada en el padrón{personaEncontrada.perfiles?.docente_id ? ' como docente' : ''}.
                          {' '}Se completaron sus datos personales y domicilio: no se pueden modificar el nombre, apellido,
                          {' '}fecha de nacimiento ni género.
                        </p>
                      </div>
                      <BotonCambiarPersona onClick={quitarSeleccion} />
                    </div>
                  )}
                </Campo>
              )}
            />

            <SeccionDomicilio bindInput={bindInput} errores={errores} localidades={localidades} onCrearLocalidad={crearLocalidad} />

            {editando && (
              <div className="flex flex-col gap-4 pt-4 border-t border-outline-variant/20">
                <SeccionTitulo icono="verified_user" titulo="Estado Institucional" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <Campo id="estado_administrativo" label="Estado" requerido>
                    <SelectConFlecha {...bindInput('estado_administrativo')} conError={false}>
                      <option value="" disabled>Seleccione estado...</option>
                      {estadosSocio.map((e) => (
                        <option key={e.estado_id} value={String(e.estado_id)}>{e.nombre}</option>
                      ))}
                    </SelectConFlecha>
                  </Campo>
                </div>
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-base text-on-surface-variant flex items-center gap-1.5">
                <span className="text-error font-bold">*</span> Campos obligatorios
              </div>
              <div className="flex items-center gap-3 self-end sm:self-auto">
                <Link
                  to={rutaVolver}
                  className="px-5 py-2.5 rounded text-sm font-medium text-on-surface hover:bg-surface-container-low transition-colors border border-outline-variant/40"
                >
                  Cancelar
                </Link>
                <button
                  type="submit"
                  disabled={guardando}
                  className="px-6 py-2.5 rounded text-sm font-semibold bg-primary hover:bg-primary/90 text-surface-container-lowest shadow-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className={`material-symbols-outlined text-base ${guardando ? 'animate-spin' : ''}`}>
                    {guardando ? 'progress_activity' : 'save'}
                  </span>
                  <span>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SocioForm
