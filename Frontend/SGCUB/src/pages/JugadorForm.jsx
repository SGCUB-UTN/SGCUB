import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getJugador, patchJugador, postJugador } from '../api/jugadores'
import { getObrasSociales, getTallesIndumentaria } from '../api/personasConfig'
import { compareObrasSociales, compareTalles } from '../components/configuracion/PersonasSettings'
import { putSocio } from '../api/socios'
import { categoriaAdmiteEdad } from '../components/categorias/categoriaFormat'
import ContactModal from '../components/jugadores/ContactModal'
import FilaContacto from '../components/jugadores/FilaContacto'
import { CAMPOS_CONTACTO, CAMPOS_DOMICILIO_CONTACTO, contactoAFila, filaAContacto, idCampoContacto, validarContactos } from '../components/jugadores/contacts'
import { BotonCambiarPersona, ListaSugerenciasPersona } from '../components/shared/PersonaSearchDNI'
import { formatDni, formatNumber, getErrorMessage } from '../components/personas/format'
import PageHeader from '../components/shared/PageHeader'
import { CAMPOS_OBLIGATORIOS, FORM_INICIAL, claseInput, enfocarCampo, socioAFormulario, validar } from '../components/socios/socioForm'
import { Campo, InputConIcono, SeccionDatosPersonales, SeccionDomicilio, SeccionTitulo, SelectConFlecha } from '../components/socios/SocioFormFields'
import usePersonaSearchDNI, { campoBloqueadoPorSocio } from '../hooks/usePersonaSearchDNI'
import useCategorias from '../hooks/useCategorias'
import useEstados from '../hooks/useEstados'
import useGeneros from '../hooks/useGeneros'
import useLocalidades from '../hooks/useLocalidades'
import useSocio from '../hooks/useSocio'

const DEPORTIVO_INICIAL = { categoria: '', categoria_secundaria: '', estado: '', obra_social: '', obra_social_otra: '', tallaIndumentaria: '' }

const OBRA_SOCIAL_OTRA = 'Otra'
const OBRAS_SOCIALES = [
  'Sin obra social',
  'IOMA',
  'PAMI',
  'OSDE',
  'Swiss Medical',
  'Galeno',
  'Medifé',
  'Sancor Salud',
  'Omint',
  'OSECAC',
  'OSPE',
  'OSPRERA',
  'Unión Personal',
]

const obraSocialAFormulario = (valor) => {
  if (!valor) return { obra_social: '', obra_social_otra: '' }
  if (OBRAS_SOCIALES.includes(valor)) return { obra_social: valor, obra_social_otra: '' }
  return { obra_social: OBRA_SOCIAL_OTRA, obra_social_otra: valor }
}

const TALLES = [
  { valor: 'XS', nombre: 'Extra chica' },
  { valor: 'S', nombre: 'Chica' },
  { valor: 'M', nombre: 'Mediana' },
  { valor: 'L', nombre: 'Grande' },
  { valor: 'XL', nombre: 'Extra grande' },
  { valor: 'XXL', nombre: 'Doble extra grande' },
]

const jugadorAFormulario = (jugador) => ({
  ...socioAFormulario(jugador.socio ?? {}),
  categoria: String(jugador.categoria?.categoria_id ?? ''),
  categoria_secundaria: String(jugador.categoria_secundaria?.categoria_id ?? ''),
  estado: String(jugador.estado?.estado_id ?? ''),
  ...obraSocialAFormulario(jugador.obra_social),
  tallaIndumentaria: jugador.tallaIndumentaria ?? '',
})

const LETRA_GENERO = { Masculino: 'M', Femenino: 'F' }

const edadCompetencia = (categoria, anioNacimiento) => categoria.anio_vigente - anioNacimiento

function categoriaPorEdad(categorias, anioNacimiento, generoLetra) {
  if (!anioNacimiento || !generoLetra) return null
  return categorias
    .filter((c) => c.genero === generoLetra && categoriaAdmiteEdad(c, anioNacimiento))
    .sort((a, b) => a.edad_maxima - b.edad_maxima)[0] ?? null
}

function validarDeportivo(formulario, editando) {
  const errores = {}
  if (!formulario.categoria) errores.categoria = 'Seleccione una categoría.'
  if (editando && !formulario.estado) errores.estado = 'Seleccione un estado deportivo.'
  if (!formulario.obra_social) errores.obra_social = 'Seleccione una obra social.'
  else if (formulario.obra_social === OBRA_SOCIAL_OTRA && !formulario.obra_social_otra.trim()) {
    errores.obra_social_otra = 'Ingrese el nombre de la obra social.'
  }
  if (!formulario.tallaIndumentaria) errores.tallaIndumentaria = 'Seleccione un talle.'
  return errores
}

const EDAD_MAYORIA = 18

function edadActual(fechaNacimiento) {
  if (!fechaNacimiento) return null
  const [anio, mes, dia] = fechaNacimiento.split('-').map(Number)
  const hoy = new Date()
  const cumplioAnios = hoy.getMonth() + 1 > mes || (hoy.getMonth() + 1 === mes && hoy.getDate() >= dia)
  return hoy.getFullYear() - anio - (cumplioAnios ? 0 : 1)
}

function errorVinculos(contactos, fechaNacimiento) {
  if (contactos.length === 0) return 'Debe registrar al menos un vínculo familiar.'
  const edad = edadActual(fechaNacimiento)
  if (edad !== null && edad < EDAD_MAYORIA && !contactos.some((fila) => fila.responsable_legal)) {
    return 'El jugador es menor de edad: al menos un vínculo familiar debe ser responsable legal.'
  }
  return null
}

function errorResponsableEdicion(jugador, fechaNacimiento) {
  const edad = edadActual(fechaNacimiento)
  const tieneResponsable = (jugador?.vinculos_familiares ?? []).some((vinculo) => vinculo.responsable_legal)
  if (edad === null || edad >= EDAD_MAYORIA || tieneResponsable) return null
  return 'Con esta fecha de nacimiento el jugador es menor de edad y no tiene un responsable legal. Agregalo desde la pestaña Familiar / Contactos antes de guardar.'
}

function JugadorForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()

  const { socios } = useSocio()
  const { categorias } = useCategorias()
  const { estados } = useEstados()
  const { generos } = useGeneros()
  const { localidades, crearLocalidad } = useLocalidades()

  const [jugador, setJugador] = useState(null)
  const [formularioEditado, setFormulario] = useState(editando ? null : { ...FORM_INICIAL, ...DEPORTIVO_INICIAL })
  const [contactos, setContactos] = useState([])
  const [errorCarga, setErrorCarga] = useState('')
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [agregandoContacto, setAgregandoContacto] = useState(false)
  const [personaEncontrada, setPersonaEncontrada] = useState(null)
  const [obrasSocialesLista, setObrasSocialesLista] = useState(OBRAS_SOCIALES)
  const [tallesLista, setTallesLista] = useState(TALLES)
  const busqueda = usePersonaSearchDNI({ habilitada: !editando })

  useEffect(() => {
    getObrasSociales()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const sorted = [...data].sort(compareObrasSociales)
          setObrasSocialesLista(sorted.map((d) => d.nombre))
        }
      })
      .catch(() => {})

    getTallesIndumentaria()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const list = data.map((t) => ({ valor: t.nombre, nombre: t.descripcion || t.nombre }))
          setTallesLista(list.sort(compareTalles))
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!editando) return undefined
    let activo = true
    getJugador(id)
      .then((datos) => {
        if (!activo) return
        const formInicial = jugadorAFormulario(datos)
        setJugador(datos)
        setFormulario(formInicial)
      })
      .catch((requestError) => {
        if (activo) setErrorCarga(requestError.response?.data?.detail || 'No se pudo cargar el jugador.')
      })
    return () => { activo = false }
  }, [editando, id])

  const anioNacimiento = formularioEditado?.fecha_nacimiento ? Number(formularioEditado.fecha_nacimiento.slice(0, 4)) : null
  const generoLetra = LETRA_GENERO[generos.find((g) => String(g.genero_id) === formularioEditado?.genero)?.nombre]

  const localidadPorDefecto = editando
    ? ''
    : String(localidades.find((l) => l.nombre?.toLowerCase() === 'berisso')?.localidad_id ?? '')
  const categoriaSugerida = editando ? null : categoriaPorEdad(categorias, anioNacimiento, generoLetra)
  const categoriaPorDefecto = String(categoriaSugerida?.categoria_id ?? '')
  const formulario = useMemo(() => {
    if (!formularioEditado) return null
    const categoria = formularioEditado.categoria || categoriaPorDefecto
    return {
      ...formularioEditado,
      domicilio_localidad: formularioEditado.domicilio_localidad || localidadPorDefecto,
      categoria,
      categoria_secundaria: formularioEditado.categoria_secundaria === categoria ? '' : formularioEditado.categoria_secundaria,
    }
  }, [formularioEditado, localidadPorDefecto, categoriaPorDefecto])

  const socioActualId = jugador?.socio?.socio_id
  const generoOtroId = generos.find((g) => g.nombre === 'Otro')?.genero_id
  const esGeneroOtro = generoOtroId !== undefined && formulario?.genero === String(generoOtroId)

  const dniIngresado = formulario?.dni.trim() ?? ''
  const socioDelDni = useMemo(() => {
    if (!/^\d{7,8}$/.test(dniIngresado)) return null
    return socios.find((s) => String(s.dni) === dniIngresado) ?? null
  }, [socios, dniIngresado])

  const proximoNumeroSocio = useMemo(() => {
    const numeros = socios.map((s) => parseInt(s.numero_socio, 10)).filter((n) => !Number.isNaN(n))
    return numeros.length ? Math.max(...numeros) + 1 : null
  }, [socios])

  const socioDuplicado = editando && socioDelDni && String(socioDelDni.socio_id) !== String(socioActualId) ? socioDelDni : null
  const perfilesSeleccionados = editando ? null : personaEncontrada?.perfiles
  const socioVinculado = perfilesSeleccionados?.socio_id
    ? socios.find((s) => String(s.socio_id) === String(perfilesSeleccionados.socio_id)) ?? { ...personaEncontrada, socio_id: perfilesSeleccionados.socio_id }
    : null
  const jugadorDelSocio = perfilesSeleccionados?.jugador_id ? { jugador_id: perfilesSeleccionados.jugador_id } : null
  const datosSocioVinculado = useMemo(
    () => (perfilesSeleccionados?.socio_id ? socioAFormulario(personaEncontrada) : null),
    [perfilesSeleccionados, personaEncontrada],
  )
  const dniSinSeleccionar = !editando && !personaEncontrada
    ? busqueda.coincidencias.find((persona) => String(persona.dni) === dniIngresado) ?? null
    : null

  const categoriasDisponibles = useMemo(() => {
    if (!formulario) return []
    if (!anioNacimiento || !generoLetra) return categorias

    return categorias.filter((c) => {
      const categoriaId = String(c.categoria_id)
      if (categoriaId === formulario.categoria || categoriaId === formulario.categoria_secundaria) return true
      return c.genero === generoLetra && categoriaAdmiteEdad(c, anioNacimiento)
    })
  }, [categorias, formulario, anioNacimiento, generoLetra])

  const categoriasSecundarias = categoriasDisponibles.filter((c) => String(c.categoria_id) !== formulario?.categoria)

  const cambiarCategoriaPrincipal = (event) => {
    const valor = event.target.value
    actualizarCampo('categoria', valor)
    if (valor === formulario.categoria_secundaria) actualizarCampo('categoria_secundaria', '')
  }

  const limpiarError = (campo) => {
    if (errores[campo]) setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
  }

  const actualizarCampo = (campo, valor) => {
    setFormulario((actual) => ({ ...actual, [campo]: valor }))
    limpiarError(campo)
  }

  const cambiarDni = (event) => {
    const dni = event.target.value.replace(/\D/g, '').slice(0, 8)
    if (personaEncontrada) {
      setPersonaEncontrada(null)
      setFormulario((actual) => ({ ...actual, ...FORM_INICIAL, dni }))
    } else {
      actualizarCampo('dni', dni)
    }
    limpiarError('dni')
    busqueda.buscar(dni)
  }

  const bindInput = (campo) => ({
    id: campo,
    name: campo,
    value: formulario[campo],
    onChange: (event) => actualizarCampo(campo, event.target.value),
    disabled: campoBloqueadoPorSocio(datosSocioVinculado, campo),
  })

  const limpiarErroresSocio = () => setErrores((actuales) => ({
    ...actuales,
    ...Object.fromEntries(CAMPOS_OBLIGATORIOS.filter((campo) => campo !== 'dni').map((campo) => [campo, undefined])),
  }))

  const quitarSeleccion = () => {
    setPersonaEncontrada(null)
    busqueda.limpiar()
    setFormulario((actual) => ({ ...actual, ...FORM_INICIAL }))
    limpiarErroresSocio()
    limpiarError('dni')
    // El DNI sigue deshabilitado hasta el próximo render.
    setTimeout(() => enfocarCampo('dni'))
  }

  const seleccionarPersona = (persona) => {
    const socio = socios.find((s) => String(s.socio_id) === String(persona.perfiles?.socio_id))
    setPersonaEncontrada(persona)
    busqueda.setAbiertas(false)
    setFormulario((actual) => ({
      ...actual,
      ...socioAFormulario({ ...persona, estado_administrativo: socio?.estado_administrativo }),
    }))
    limpiarErroresSocio()
    limpiarError('dni')
  }

  const actualizarContacto = (clave, campo, valor) => {
    setContactos((actuales) => actuales.map((fila) => (fila.clave === clave ? { ...fila, [campo]: valor } : fila)))
    limpiarError(`${clave}-${campo}`)
    if (campo === 'mismo_domicilio') {
      CAMPOS_DOMICILIO_CONTACTO.forEach((c) => limpiarError(`${clave}-${c}`))
    }
    if (campo === 'responsable_legal') limpiarError('vinculos_familiares')
  }

  const quitarContacto = (clave) => setContactos((actuales) => actuales.filter((fila) => fila.clave !== clave))

  const edadJugador = edadActual(formulario?.fecha_nacimiento)
  const mostrarResponsableLegal = edadJugador === null || edadJugador < EDAD_MAYORIA

  const agregarContacto = async (contacto) => {
    const dni = String(contacto.persona?.dni ?? '').trim()
    if (dni && dni === dniIngresado) {
      throw new Error('No se puede registrar al mismo jugador como su propio contacto.')
    }
    if (contactos.some((fila) => fila.dni.trim() === dni)) {
      throw new Error('Esta persona ya figura entre los contactos del jugador.')
    }
    setContactos((actuales) => [...actuales, contactoAFila(contacto, formulario)])
    limpiarError('vinculos_familiares')
  }

  const guardar = async (event) => {
    event.preventDefault()
    setErrorGuardado('')

    const nuevosErrores = {
      ...validar(formulario, esGeneroOtro),
      ...validarDeportivo(formulario, editando),
      ...(editando ? {} : validarContactos(contactos, dniIngresado, 'jugador')),
    }
    if (socioDuplicado) nuevosErrores.dni = 'Ya existe otro socio registrado con este DNI.'
    if (jugadorDelSocio) nuevosErrores.dni = 'Este socio ya está registrado como jugador.'
    if (dniSinSeleccionar) nuevosErrores.dni = 'Este DNI ya está registrado: seleccioná la persona en la lista de sugerencias.'
    const errorContactos = editando ? null : errorVinculos(contactos, formulario.fecha_nacimiento)
    if (errorContactos) nuevosErrores.vinculos_familiares = errorContactos
    setErrores(nuevosErrores)

    const ordenCampos = [
      ...CAMPOS_OBLIGATORIOS, 'genero_otro', 'categoria', 'estado', 'obra_social', 'obra_social_otra', 'tallaIndumentaria',
      ...contactos.flatMap((fila) => [...CAMPOS_CONTACTO, 'email', ...CAMPOS_DOMICILIO_CONTACTO].map((campo) => idCampoContacto(fila, campo))),
      'vinculos_familiares',
    ]
    const primerError = ordenCampos.find((campo) => nuevosErrores[campo])
    if (primerError) {
      enfocarCampo(primerError)
      return
    }

    const errorResponsable = editando ? errorResponsableEdicion(jugador, formulario.fecha_nacimiento) : null
    if (errorResponsable) {
      setErrorGuardado(errorResponsable)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const { categoria, categoria_secundaria, estado, obra_social, obra_social_otra, tallaIndumentaria, ...datosSocio } = formulario
    if (!datosSocio.estado_administrativo) delete datosSocio.estado_administrativo
    if (!esGeneroOtro) datosSocio.genero_otro = ''

    const datosJugador = {
      categoria,
      categoria_secundaria: categoria_secundaria || null,
      ...(editando ? { estado } : {}),
      obra_social: obra_social === OBRA_SOCIAL_OTRA ? obra_social_otra.trim() : obra_social,
      tallaIndumentaria,
      ...(editando ? {} : { vinculos_familiares: contactos.map((fila) => filaAContacto(fila, formulario, mostrarResponsableLegal)) }),
    }

    setGuardando(true)
    try {
      let jugadorId
      if (editando) {
        await putSocio(socioActualId, datosSocio)
        await patchJugador(jugador.jugador_id, datosJugador)
        jugadorId = jugador.jugador_id
      } else if (socioVinculado) {
        await putSocio(socioVinculado.socio_id, datosSocio)
        jugadorId = (await postJugador({ ...datosJugador, socio: socioVinculado.socio_id })).jugador_id
      } else {
        jugadorId = (await postJugador({ ...datosJugador, nuevo_socio: datosSocio })).jugador_id
      }
      navigate(`/padron/jugadores/${jugadorId}${editando ? '' : '?tab=financiero'}`)
    } catch (requestError) {
      setErrorGuardado(getErrorMessage(requestError, editando ? 'No se pudo modificar el jugador.' : 'No se pudo agregar el jugador.'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setGuardando(false)
    }
  }

  const rutaVolver = editando ? `/padron/jugadores/${id}` : '/padron/jugadores'

  if (errorCarga) {
    return (
      <div className="max-w-5xl mx-auto w-full space-y-4 pt-2">
        <Link to="/padron/jugadores" className="inline-flex items-center gap-1.5 text-xl font-medium text-on-surface-variant hover:text-primary px-3 py-1.5 rounded transition-colors bg-surface-container-lowest border border-outline-variant/30">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          <span>Volver a jugadores</span>
        </Link>
        <div className="bg-error-container text-on-error-container p-4 rounded-lg border border-error/30 flex items-center gap-2.5">
          <span className="material-symbols-outlined text-error text-base">error</span>
          <p className="text-sm font-medium">{errorCarga}</p>
        </div>
      </div>
    )
  }

  if (!formulario) {
    return (
      <div className="max-w-5xl mx-auto w-full py-16 flex flex-col items-center gap-3 text-on-surface-variant">
        <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
        <p className="text-sm">Cargando datos del jugador...</p>
      </div>
    )
  }

  const nombreJugador = editando ? `${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''}`.trim() : ''
  const dniConError = Boolean(errores.dni) || Boolean(socioDuplicado) || Boolean(jugadorDelSocio)
  const dniReconocido = Boolean(personaEncontrada) || Boolean(socioVinculado)
  const mostrarSugerencias = !editando && !personaEncontrada && busqueda.abiertas && busqueda.coincidencias.length > 0
  const iconoDni = busqueda.buscando ? 'progress_activity' : dniConError ? 'warning' : dniReconocido ? 'check_circle' : 'fingerprint'
  const colorIconoDni = dniConError ? 'text-error' : dniReconocido ? 'text-[#00875a]' : 'text-outline'

  return (
    <div className="mx-auto w-full space-y-6 pb-12">
      <PageHeader
        breadcrumb={[
          { label: 'Personas' },
          { label: 'Jugadores', to: '/padron/jugadores' },
          ...(nombreJugador ? [{ label: nombreJugador, to: rutaVolver }] : []),
          { label: editando ? 'Editar' : 'Nuevo jugador' },
        ]}
        title={editando ? 'Editar Jugador' : 'Alta de Nuevo Jugador'}
        actions={(
          <>
            <div className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-center gap-2">
              <span className="text-base font-semibold text-outline uppercase tracking-wider">
                {editando || (socioVinculado && !jugadorDelSocio) ? 'N° de socio:' : 'Próximo N°:'}
              </span>
              <span className="font-mono text-base font-bold text-primary">
                {editando
                  ? formatNumber(jugador.socio?.numero_socio)
                  : formatNumber(socioVinculado && !jugadorDelSocio ? socioVinculado.numero_socio : proximoNumeroSocio)}
              </span>
            </div>
            
              <div className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-center gap-2">
                <span className="text-base font-semibold text-outline uppercase tracking-wider">Fecha de alta:</span>
                <span className="text-base font-semibold text-on-surface">{`Hoy (${new Date().toLocaleDateString('es-AR')})`}</span>
              </div>
            <Link
              to={rutaVolver}
              className="inline-flex items-center gap-1.5 text-base font-medium text-on-surface-variant hover:text-primary px-3 py-1.5 rounded transition-colors bg-surface-container-lowest border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>{editando ? 'Volver a la ficha' : 'Volver al listado'}</span>
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
            <p className="text-base font-bold">No se pudo guardar el jugador</p>
            <p className="text-base text-on-error-container/80 mt-0.5 break-words">{errorGuardado}</p>
          </div>
        </div>
      )}

      <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-container-low/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">badge</span>
            <h2 className="text-base font-semibold text-on-surface">
              {editando ? 'Datos Personales y Deportivos' : 'Datos Personales, Deportivos y Contactos'}
            </h2>
          </div>
        </div>

        <form id="form-jugador" className="p-6 md:p-8" onSubmit={guardar} noValidate>
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
                          if (persona.perfiles?.jugador_id) return { texto: 'Ya es jugador', tono: 'error' }
                          if (persona.perfiles?.socio_id) return { texto: 'Socio', tono: 'info' }
                          return null
                        }}
                      />
                    )}
                  </div>
                  {socioDuplicado && !errores.dni && (
                    <p className="text-sm text-error font-medium">
                      El DNI {formatDni(socioDuplicado.dni)} pertenece a{' '}
                      <strong>{`${socioDuplicado.nombre ?? ''} ${socioDuplicado.apellido ?? ''}`.trim()}</strong>
                      {' '}(Socio N° {formatNumber(socioDuplicado.numero_socio)}).
                    </p>
                  )}

                  {jugadorDelSocio && (
                    <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mt-1" role="alert">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1 bg-error/10 text-error rounded shrink-0">
                          <span className="material-symbols-outlined text-base">error</span>
                        </div>
                        <p className="text-base">
                          <strong>{`${socioVinculado.nombre ?? ''} ${socioVinculado.apellido ?? ''}`.trim()}</strong>
                          {' '}(DNI {formatDni(socioVinculado.dni)}) ya está registrado como jugador.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <BotonCambiarPersona onClick={quitarSeleccion} />
                        <Link
                          to={`/padron/jugadores/${jugadorDelSocio.jugador_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-on-error-container hover:opacity-90 rounded text-base font-semibold shrink-0 transition-opacity"
                        >
                          <span>Ver ficha existente</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {socioVinculado && !jugadorDelSocio && (
                    <div className="bg-surface-container-low text-on-surface p-3 rounded-lg border border-outline-variant/40 flex items-center justify-between gap-2.5 mt-1">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-base text-[#00875a]">how_to_reg</span>
                        <p className="text-base">
                          <strong>{`${socioVinculado.nombre ?? ''} ${socioVinculado.apellido ?? ''}`.trim()}</strong>
                          {' '}ya es socio (N° {formatNumber(socioVinculado.numero_socio)}). El jugador se vinculará a ese socio:
                          {' '}solo se pueden modificar el teléfono, el correo electrónico y el domicilio.
                        </p>
                      </div>
                      <BotonCambiarPersona onClick={quitarSeleccion} />
                    </div>
                  )}

                  {personaEncontrada && !socioVinculado && (
                    <div className="bg-surface-container-low text-on-surface p-3 rounded-lg border border-outline-variant/40 flex items-center gap-2.5 mt-1">
                      <span className="material-symbols-outlined text-base text-[#00875a]">how_to_reg</span>
                      <p className="text-base">
                        <strong>{`${personaEncontrada.nombre ?? ''} ${personaEncontrada.apellido ?? ''}`.trim()}</strong>
                        {' '}ya está registrada en el padrón. Se completaron sus datos personales.
                      </p>
                    </div>
                  )}
                </Campo>
              )}
            />

            <SeccionDomicilio bindInput={bindInput} errores={errores} localidades={localidades} onCrearLocalidad={crearLocalidad} />

            {/* Datos deportivos */}
            <div className="flex flex-col gap-4 pt-4 border-t border-outline-variant/20">
              <SeccionTitulo icono="sports_soccer" titulo="Datos Deportivos" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <Campo
                  id="categoria"
                  label="Categoría"
                  requerido
                  hint={categoriasDisponibles.length < categorias.length ? '(según edad y género)' : undefined}
                  error={errores.categoria}
                >
                  <SelectConFlecha {...bindInput('categoria')} onChange={cambiarCategoriaPrincipal} conError={Boolean(errores.categoria)}>
                    <option value="" disabled>Seleccione categoría...</option>
                    {categoriasDisponibles.map((c) => (
                      <option key={c.categoria_id} value={String(c.categoria_id)}>{c.nombre}</option>
                    ))}
                  </SelectConFlecha>
                  {categoriaSugerida && formulario.categoria === categoriaPorDefecto && (
                    <p className="text-sm text-on-surface-variant">
                      Asignada según la edad: {edadCompetencia(categoriaSugerida, anioNacimiento)} años en la temporada {categoriaSugerida.anio_vigente}.
                    </p>
                  )}
                </Campo>
                <Campo id="categoria_secundaria" label="Categoría secundaria" opcional>
                  <SelectConFlecha {...bindInput('categoria_secundaria')} conError={false}>
                    <option value="">Sin categoría secundaria</option>
                    {categoriasSecundarias.map((c) => (
                      <option key={c.categoria_id} value={String(c.categoria_id)}>{c.nombre}</option>
                    ))}
                  </SelectConFlecha>
                </Campo>
                {editando ? 
                  <Campo id="estado" label="Estado deportivo" requerido error={errores.estado}>
                    <SelectConFlecha {...bindInput('estado')} conError={Boolean(errores.estado)}>
                      <option value="" disabled>Seleccione estado...</option>
                      {estados.map((e) => (
                        <option key={e.estado_id} value={String(e.estado_id)}>{e.nombre}</option>
                      ))}
                    </SelectConFlecha>
                  </Campo>
                  : null}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <Campo id="obra_social" label="Obra social" requerido error={errores.obra_social}>
                  <SelectConFlecha {...bindInput('obra_social')} conError={Boolean(errores.obra_social)}>
                    <option value="" disabled>Seleccione obra social...</option>
                    {obrasSocialesLista.map((nombre) => (
                      <option key={nombre} value={nombre}>{nombre}</option>
                    ))}
                    <option value={OBRA_SOCIAL_OTRA}>Otra...</option>
                  </SelectConFlecha>
                </Campo>
                <Campo id="tallaIndumentaria" label="Talle de indumentaria" requerido error={errores.tallaIndumentaria}>
                  <SelectConFlecha {...bindInput('tallaIndumentaria')} conError={Boolean(errores.tallaIndumentaria)}>
                    <option value="" disabled>Seleccione talle...</option>
                    {tallesLista.map((talle) => (
                      <option key={talle.valor} value={talle.valor}>{`${talle.valor}${talle.nombre && talle.nombre !== talle.valor ? ` (${talle.nombre})` : ''}`}</option>
                    ))}
                  </SelectConFlecha>
                </Campo>
                {formulario.obra_social === OBRA_SOCIAL_OTRA && (
                  <Campo id="obra_social_otra" label="Especifique la obra social" requerido error={errores.obra_social_otra}>
                    <InputConIcono
                      {...bindInput('obra_social_otra')}
                      type="text"
                      maxLength={50}
                      placeholder="Ej: OSPECON"
                      icono="medical_services"
                      conError={Boolean(errores.obra_social_otra)}
                    />
                  </Campo>
                )}
              </div>
            </div>

            {!editando && <div className="flex flex-col gap-4 pt-4 border-t border-outline-variant/20">
              <SeccionTitulo
                icono="family_restroom"
                titulo="Vinculos familiares y contactos de emergencia"
                extra={(
                  <button
                    id="vinculos_familiares"
                    type="button"
                    onClick={() => setAgregandoContacto(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    Agregar contacto
                  </button>
                )}
              />

              {errores.vinculos_familiares && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex items-start gap-2.5 shadow-sm" role="alert">
                  <div className="p-1 bg-error/10 text-error rounded shrink-0">
                    <span className="material-symbols-outlined text-base">error</span>
                  </div>
                  <div>
                    <p className="text-base font-bold">Faltan vínculos familiares</p>
                    <p className="text-base text-on-error-container/80 mt-0.5">{errores.vinculos_familiares}</p>
                  </div>
                </div>
              )}

              {contactos.length === 0 ? (
                <div className={`flex flex-col items-center text-center gap-1 py-8 border-dashed rounded-lg ${errores.vinculos_familiares ? 'border-2 border-error bg-error-container/20' : 'border border-outline-variant/50'}`}>
                  <span className="material-symbols-outlined text-[32px] text-outline">contact_emergency</span>
                  <p className="text-base font-semibold text-on-surface">Sin vinculos familiares</p>
                  <p className="text-sm text-on-surface-variant">Agregá al menos un familiar o responsable para este jugador.</p>
                </div>
              ) : (
                contactos.map((fila, indice) => (
                  <FilaContacto
                    key={fila.clave}
                    fila={fila}
                    indice={indice}
                    errores={errores}
                    localidades={localidades}
                    mostrarResponsableLegal={mostrarResponsableLegal}
                    resaltarResponsable={Boolean(errores.vinculos_familiares)}
                    onChange={(campo, valor) => actualizarContacto(fila.clave, campo, valor)}
                    onRemove={() => quitarContacto(fila.clave)}
                  />
                ))
              )}
            </div>}

            {/* Acciones */}
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
                  <span>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar jugador'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {agregandoContacto && (
        <ContactModal
          onClose={() => setAgregandoContacto(false)}
          onSubmit={agregarContacto}
          domicilioTitular={formulario}
          mostrarResponsableLegal={mostrarResponsableLegal}
        />
      )}
    </div>
  )
}

export default JugadorForm
