import { useEffect, useMemo, useState, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, API_ORIGIN } from '../api/conf'
import { getCargosDocente, getDocente, patchDocente, postDocente } from '../api/docentes'
import { esCategoriaAsignable, etiquetaCategoria } from '../components/docentes/docentesUtils'
import { BotonCambiarPersona, ListaSugerenciasPersona } from '../components/shared/PersonaSearchDNI'
import { ErrorFile, LoadingFile } from '../components/personas/FileStatus'
import { formatDate, formatDni, formatNumber, getErrorMessage } from '../components/personas/format'
import { SelectMultiple, SelectSimple } from '../components/shared/DropDownMenu'
import PageHeader from '../components/shared/PageHeader'
import { CAMPOS_OBLIGATORIOS, FORM_INICIAL, claseInput, enfocarCampo, socioAFormulario, validar } from '../components/socios/socioForm'
import { Campo, SeccionDatosPersonales, SeccionDomicilio, SeccionTitulo } from '../components/socios/SocioFormFields'
import usePersonaSearchDNI, { campoBloqueadoPorSocio } from '../hooks/usePersonaSearchDNI'
import useCategorias from '../hooks/useCategorias'
import useDocentes from '../hooks/useDocentes'
import useGeneros from '../hooks/useGeneros'
import useLocalidades from '../hooks/useLocalidades'
import useSocio from '../hooks/useSocio'

const CAMPOS_ASIGNACION = ['cargo', 'categorias']

let ultimaClave = 0
const nuevaClave = () => `asignacion-${++ultimaClave}`
const nuevaAsignacion = () => ({ clave: nuevaClave(), cargo: '', categorias: [] })

const idCampoAsignacion = (fila, campo) => `${fila.clave}-${campo}`

const formatearLegajo = (legajo) => `#${String(legajo).padStart(4, '0')}`

const mediaUrl = (ruta) => (ruta?.startsWith('http') ? ruta : `${API_ORIGIN}${ruta}`)

const NOMBRE_TIPO_ANTECEDENTES = 'Antecedentes Penales'

let tipoAntecedentesCache = null

async function obtenerTipoAntecedentes() {
  if (tipoAntecedentesCache) return tipoAntecedentesCache
  const { data } = await api.get('documental/tipos/')
  const encontrado = data.find((t) => t.nombre === NOMBRE_TIPO_ANTECEDENTES)
  if (!encontrado) {
    throw new Error(`No existe el tipo de documento "${NOMBRE_TIPO_ANTECEDENTES}" en la base.`)
  }
  tipoAntecedentesCache = encontrado.id_tipo_documento
  return tipoAntecedentesCache
}

const personaAFormulario = (persona) => {
  const datos = socioAFormulario(persona)
  delete datos.estado_administrativo
  return datos
}

// El backend devuelve las asignaciones agrupadas por cargo: [{ cargo, cargo_nombre, categorias: [...] }]
function asignacionesAFilas(asignaciones = []) {
  const filas = asignaciones.map((asignacion) => ({
    clave: nuevaClave(),
    cargo: asignacion.cargo ? String(asignacion.cargo) : '',
    categorias: asignacion.categorias.map((categoria) => String(categoria.categoria_id)),
  }))
  return filas.length > 0 ? filas : [nuevaAsignacion()]
}

const filasAAsignaciones = (filas) => filas.map((fila) => ({
  cargo: Number(fila.cargo),
  categorias: fila.categorias.map(Number),
}))

function validarAsignaciones(asignaciones) {
  const errores = {}
  const cargos = new Set()
  asignaciones.forEach((fila) => {
    if (!fila.cargo) errores[idCampoAsignacion(fila, 'cargo')] = 'Seleccione un cargo.'
    else if (cargos.has(fila.cargo)) errores[idCampoAsignacion(fila, 'cargo')] = 'Este cargo ya fue agregado.'
    cargos.add(fila.cargo)
    if (fila.categorias.length === 0) errores[idCampoAsignacion(fila, 'categorias')] = 'Seleccione al menos una categoría.'
  })
  return errores
}

function FilaAsignacion({ fila, indice, errores, cargos, categorias, categoriasOcupadas, onChange, onRemove, puedeQuitar }) {
  const error = (campo) => errores[idCampoAsignacion(fila, campo)]
  const nombreCargo = cargos.find((cargo) => String(cargo.cargo_id) === fila.cargo)?.nombre

  const alternarCategoria = (categoriaId) => {
    onChange('categorias', fila.categorias.includes(categoriaId)
      ? fila.categorias.filter((id) => id !== categoriaId)
      : [...fila.categorias, categoriaId])
  }

  return (
    <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/30 p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">{indice + 1}</span>
          <span className="text-base font-semibold text-on-surface">{nombreCargo || 'Nuevo cargo'}</span>
          {fila.categorias.length > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-sm font-medium">
              {fila.categorias.length} {fila.categorias.length === 1 ? 'categoría' : 'categorías'}
            </span>
          )}
        </div>
        {puedeQuitar && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-sm font-medium text-error hover:bg-error-container/40 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-base">delete</span>
            Quitar
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-4">
        <Campo id={idCampoAsignacion(fila, 'cargo')} label="Cargo" requerido error={error('cargo')}>
          <SelectSimple
            id={idCampoAsignacion(fila, 'cargo')}
            opciones={cargos.map((cargo) => ({ valor: String(cargo.cargo_id), etiqueta: cargo.nombre }))}
            valor={fila.cargo}
            onChange={(valor) => onChange('cargo', valor)}
            conError={Boolean(error('cargo'))}
            placeholder="Seleccione cargo..."
          />
        </Campo>

        <Campo
          id={idCampoAsignacion(fila, 'categorias')}
          label="Categorías"
          requerido
          hint="(una o varias)"
          error={error('categorias')}
          className="md:col-span-2"
        >
          <SelectMultiple
            id={idCampoAsignacion(fila, 'categorias')}
            opciones={categorias.filter(esCategoriaAsignable).map((c) => ({
              valor: String(c.categoria_id),
              etiqueta: etiquetaCategoria(c),
              deshabilitadaPor: categoriasOcupadas[String(c.categoria_id)],
            }))}
            seleccionadas={fila.categorias}
            onToggle={alternarCategoria}
            conError={Boolean(error('categorias'))}
          />
        </Campo>
      </div>
    </div>
  )
}

function DocenteForm() {
  const { id } = useParams()
  const editando = Boolean(id)
  const navigate = useNavigate()

  const { docentes } = useDocentes()
  const { socios } = useSocio()
  const { categorias } = useCategorias()
  const { generos } = useGeneros()
  const { localidades, crearLocalidad } = useLocalidades()

  const [formularioEditado, setFormulario] = useState(() => personaAFormulario(FORM_INICIAL))
  const [asignaciones, setAsignaciones] = useState(() => [nuevaAsignacion()])
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState('')
  const [personaEncontrada, setPersonaEncontrada] = useState(null)
  const [docenteOriginal, setDocenteOriginal] = useState(null)
  const [cargos, setCargos] = useState([])
  const [cargando, setCargando] = useState(editando)
  const [errorCarga, setErrorCarga] = useState('')
  const busqueda = usePersonaSearchDNI({ habilitada: !editando })
  const fileInputRef = useRef(null)
  const [archivoAntecedente, setArchivoAntecedente] = useState(null)
  const [documentoExistente, setDocumentoExistente] = useState(null)
  // The criminal record may be handed in without attaching the PDF
  const [criminalRecordDelivered, setCriminalRecordDelivered] = useState(false)

  const handleClearFile = () => {
    setArchivoAntecedente(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const criminalRecordRequired = !editando || !documentoExistente

  // Registers the criminal record document, with the attached PDF or, if it was only delivered, without a file
  const saveCriminalRecord = async (personaId) => {
    const tipoId = await obtenerTipoAntecedentes()
    const formData = new FormData()
    formData.append('persona', personaId)
    formData.append('tipo_documento', tipoId)
    if (archivoAntecedente) formData.append('archivoUrl', archivoAntecedente)
    formData.append('fecha_recepcion', new Date().toISOString())
    formData.append('fecha_emision', new Date().toISOString().split('T')[0])
    await api.post('documental/documentos/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  }


  useEffect(() => {
    let activo = true
    getCargosDocente()
      .then((datos) => activo && setCargos(datos))
      .catch((requestError) => console.error('Error al cargar cargos:', requestError))
    return () => { activo = false }
  }, [])

  useEffect(() => {
    if (!editando) return undefined
    let activo = true
    getDocente(id)
      .then(async (docente) => {
        if (!activo) return
        setDocenteOriginal(docente)
        setFormulario(personaAFormulario(docente.persona_detalle ?? {}))
        setAsignaciones(asignacionesAFilas(docente.asignaciones))

        try{
          const tipoId = await obtenerTipoAntecedentes()
          const { data } = await api.get(`documental/documentos/?persona_id=${docente.persona}`)
          if (!activo) return
          const antecedente = data.find((doc) => String(doc.tipo_documento) === String(tipoId))
          setDocumentoExistente(antecedente ?? null)
        }catch(err){
          console.error('Error al cargar el antecedente penal:', err)
        }
      })
      .catch((requestError) => {
        if (activo) setErrorCarga(requestError.response?.data?.detail || 'No se pudo cargar el docente.')
      })
      .finally(() => activo && setCargando(false))
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

  const proximoLegajo = useMemo(() => {
    const legajos = docentes.map((d) => Number(d.legajo)).filter((n) => !Number.isNaN(n))
    return legajos.length ? Math.max(...legajos) + 1 : 1
  }, [docentes])

  const dniIngresado = formulario.dni.trim()
  const docenteDelDni = useMemo(() => {
    if (!editando || !/^\d{7,8}$/.test(dniIngresado)) return null
    return docentes.find((d) => String(d.persona_detalle?.dni) === dniIngresado && String(d.docente_id) !== String(id)) ?? null
  }, [docentes, dniIngresado, editando, id])

  // Solo se vincula a una persona existente cuando se la elige de la lista de sugerencias.
  const perfilesSeleccionados = editando ? null : personaEncontrada?.perfiles
  const socioVinculado = perfilesSeleccionados?.socio_id
    ? socios.find((s) => String(s.socio_id) === String(perfilesSeleccionados.socio_id)) ?? { ...personaEncontrada, socio_id: perfilesSeleccionados.socio_id }
    : null
  const docenteSeleccionado = perfilesSeleccionados?.docente_id
    ? docentes.find((d) => String(d.docente_id) === String(perfilesSeleccionados.docente_id)) ?? { docente_id: perfilesSeleccionados.docente_id }
    : null
  const datosSocioVinculado = useMemo(
    () => (perfilesSeleccionados?.socio_id ? personaAFormulario(personaEncontrada) : null),
    [perfilesSeleccionados, personaEncontrada],
  )
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

  const bindInput = (campo) => ({
    id: campo,
    name: campo,
    value: formulario[campo],
    onChange: (event) => actualizarCampo(campo, event.target.value),
    disabled: campoBloqueadoPorSocio(datosSocioVinculado, campo),
  })

  const limpiarErroresPersona = () => setErrores((actuales) => ({
    ...actuales,
    ...Object.fromEntries(CAMPOS_OBLIGATORIOS.map((campo) => [campo, undefined])),
  }))

  const cambiarDni = (event) => {
    const dni = event.target.value.replace(/\D/g, '').slice(0, 8)
    if (personaEncontrada) {
      // Al cambiar el DNI se descarta la persona elegida y los datos que se habían autocompletado.
      setPersonaEncontrada(null)
      setFormulario({ ...personaAFormulario(FORM_INICIAL), dni })
    } else {
      actualizarCampo('dni', dni)
    }
    limpiarError('dni')
    busqueda.buscar(dni)
  }

  const quitarSeleccion = () => {
    setPersonaEncontrada(null)
    busqueda.limpiar()
    setFormulario(personaAFormulario(FORM_INICIAL))
    limpiarErroresPersona()
    // El DNI sigue deshabilitado hasta el próximo render.
    setTimeout(() => enfocarCampo('dni'))
  }

  const seleccionarPersona = (persona) => {
    setPersonaEncontrada(persona)
    busqueda.setAbiertas(false)
    setFormulario(personaAFormulario(persona))
    limpiarErroresPersona()
  }

  const actualizarAsignacion = (clave, campo, valor) => {
    setAsignaciones((actuales) => actuales.map((fila) => (fila.clave === clave ? { ...fila, [campo]: valor } : fila)))
    limpiarError(`${clave}-${campo}`)
  }

  const nombreDeCargo = (cargoId) => cargos.find((cargo) => String(cargo.cargo_id) === cargoId)?.nombre

  const categoriasOcupadasFuera = (clave) => Object.fromEntries(
    asignaciones
      .filter((fila) => fila.clave !== clave)
      .flatMap((fila) => fila.categorias.map((categoriaId) => [categoriaId, nombreDeCargo(fila.cargo) || 'otro cargo'])),
  )

  const quitarAsignacion = (clave) => setAsignaciones((actuales) => actuales.filter((fila) => fila.clave !== clave))

  const guardar = async (event) => {
    event.preventDefault()
    setErrorGuardado('')

    const nuevosErrores = {
      ...validar(formulario, esGeneroOtro),
      ...validarAsignaciones(asignaciones),
    }
    if (criminalRecordRequired && !archivoAntecedente && !criminalRecordDelivered) {
      nuevosErrores.antecedente_penal = 'Adjuntá el PDF de antecedentes penales o indicá que el documento fue entregado.'
    }
    if (docenteDelDni || docenteSeleccionado) nuevosErrores.dni = 'Esta persona ya está registrada como docente.'
    if (dniSinSeleccionar) nuevosErrores.dni = 'Este DNI ya está registrado: seleccioná la persona en la lista de sugerencias.'
    setErrores(nuevosErrores)

    const ordenCampos = [
      ...CAMPOS_OBLIGATORIOS, 'genero_otro', 'antecedente_penal',
      ...asignaciones.flatMap((fila) => CAMPOS_ASIGNACION.map((campo) => idCampoAsignacion(fila, campo))),
    ]
    const primerError = ordenCampos.find((campo) => nuevosErrores[campo])
    if (primerError) {
      enfocarCampo(primerError)
      return
    }

    const datosPersona = {
      ...formulario,
      genero_otro: esGeneroOtro ? formulario.genero_otro : '',
      email: formulario.email.trim() || null,
      domicilio_localidad: formulario.domicilio_localidad || null,
    }

    setGuardando(true)
    if (editando) {
      try {
        await api.patch(`padron/persona/${docenteOriginal.persona}/`, datosPersona)
        await patchDocente(id, { asignaciones: filasAAsignaciones(asignaciones) })

        if (archivoAntecedente || criminalRecordDelivered) await saveCriminalRecord(docenteOriginal.persona)

        navigate(`/padron/docentes/${id}`)
      } catch (requestError) {
        setErrorGuardado(getErrorMessage(requestError, 'No se pudo modificar el docente.'))
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } finally {
        setGuardando(false)
      }
      return
    }

    let docente = null
    try {
      const personaExistente = personaEncontrada
        ?? (await api.get(`padron/persona/?dni=${dniIngresado}`)).data?.[0]
      const personaId = personaExistente
        ? (await api.patch(`padron/persona/${personaExistente.persona_id}/`, datosPersona)).data.persona_id
        : (await api.post('padron/persona/', datosPersona)).data.persona_id

      // El backend crea el docente y sus cargos en una sola operación y asigna el legajo
      docente = await postDocente({ persona: personaId, asignaciones: filasAAsignaciones(asignaciones) })
      
      if (archivoAntecedente || criminalRecordDelivered) {
        await saveCriminalRecord(personaId)
      }

      navigate(`/padron/docentes/${docente.docente_id}`)
    } catch (requestError) {
      const mensaje = getErrorMessage(requestError, 'No se pudo agregar el docente.')
      // Only report a partial save when the docente was actually created and the attachment failed
      setErrorGuardado(
        !docente || mensaje.includes('No existe el tipo')
          ? mensaje
          : `El docente se guardó, pero no se pudo registrar el antecedente penal. Detalle: ${mensaje}`
      )
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <LoadingFile text="Cargando datos del docente..." />
  if (errorCarga) return <ErrorFile message={errorCarga} backTo="/padron/docentes" backText="Volver a docentes" />

  const rutaVolver = editando ? `/padron/docentes/${id}` : '/padron/docentes'
  const personaOriginal = docenteOriginal?.persona_detalle
  const nombreEditado = personaOriginal ? `${personaOriginal.nombre ?? ''} ${personaOriginal.apellido ?? ''}`.trim() : ''
  const dniConError = Boolean(errores.dni) || Boolean(docenteDelDni) || Boolean(docenteSeleccionado)
  const mostrarSugerencias = !editando && !personaEncontrada && busqueda.abiertas && busqueda.coincidencias.length > 0
  const iconoDni = busqueda.buscando ? 'progress_activity' : dniConError ? 'warning' : personaEncontrada ? 'check_circle' : 'fingerprint'
  const colorIconoDni = dniConError ? 'text-error' : personaEncontrada ? 'text-[#00875a]' : 'text-outline'

  return (
    <div className="mx-auto w-full space-y-6 pb-12">
      <PageHeader
        breadcrumb={[
          { label: 'Personas' },
          { label: 'Docentes', to: '/padron/docentes' },
          ...(editando && nombreEditado ? [{ label: nombreEditado, to: rutaVolver }] : []),
          { label: editando ? 'Editar' : 'Nuevo docente' },
        ]}
        title={editando ? 'Editar Docente' : 'Alta de Nuevo Docente'}
        actions={(
          <>
            <div className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-center gap-2">
              <span className="text-base font-semibold text-outline uppercase tracking-wider">{editando ? 'Legajo:' : 'Próximo legajo:'}</span>
              <span className="font-mono text-base font-bold text-primary">
                {formatearLegajo(editando ? docenteOriginal.legajo : proximoLegajo)}
              </span>
            </div>
            {socioVinculado && !docenteSeleccionado && (
              <div className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-center gap-2">
                <span className="text-base font-semibold text-outline uppercase tracking-wider">N° de socio:</span>
                <span className="font-mono text-base font-bold text-primary">{formatNumber(socioVinculado.numero_socio)}</span>
              </div>
            )}
            <div className="px-3 py-1.5 bg-surface-container-lowest border border-outline-variant/30 rounded flex items-center gap-2">
              <span className="text-base font-semibold text-outline uppercase tracking-wider">Fecha de ingreso:</span>
              <span className="text-base font-semibold text-on-surface">
                {editando ? formatDate(docenteOriginal.fecha_ingreso) : `Hoy (${new Date().toLocaleDateString('es-AR')})`}
              </span>
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
            <p className="text-base font-bold">No se pudo guardar el docente</p>
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

        <form id="form-docente" className="p-6 md:p-8" onSubmit={guardar} noValidate>
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
                          if (persona.perfiles?.docente_id) return { texto: 'Ya es docente', tono: 'error' }
                          if (persona.perfiles?.socio_id) return { texto: 'Socio', tono: 'info' }
                          return null
                        }}
                      />
                    )}
                  </div>

                  {docenteDelDni && (
                    <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mt-1" role="alert">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1 bg-error/10 text-error rounded shrink-0">
                          <span className="material-symbols-outlined text-base">error</span>
                        </div>
                        <p className="text-base">
                          <strong>{`${docenteDelDni.persona_detalle?.nombre ?? ''} ${docenteDelDni.persona_detalle?.apellido ?? ''}`.trim()}</strong>
                          {' '}(DNI {formatDni(docenteDelDni.persona_detalle?.dni)}) ya está registrado como docente
                          {' '}(Legajo {formatearLegajo(docenteDelDni.legajo)}).
                        </p>
                      </div>
                      <Link
                        to={`/padron/docentes/${docenteDelDni.docente_id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-on-error-container hover:opacity-90 rounded text-base font-semibold shrink-0 transition-opacity"
                      >
                        <span>Ver ficha existente</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </Link>
                    </div>
                  )}

                  {docenteSeleccionado && (
                    <div className="bg-error-container text-on-error-container p-3 rounded-lg border border-error/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm mt-1" role="alert">
                      <div className="flex items-start sm:items-center gap-2.5">
                        <div className="p-1 bg-error/10 text-error rounded shrink-0">
                          <span className="material-symbols-outlined text-base">error</span>
                        </div>
                        <p className="text-base">
                          <strong>{`${personaEncontrada.nombre ?? ''} ${personaEncontrada.apellido ?? ''}`.trim()}</strong>
                          {' '}(DNI {formatDni(personaEncontrada.dni)}) ya está registrado como docente
                          {docenteSeleccionado.legajo ? ` (Legajo ${formatearLegajo(docenteSeleccionado.legajo)})` : ''}.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <BotonCambiarPersona onClick={quitarSeleccion} />
                        <Link
                          to={`/padron/docentes/${docenteSeleccionado.docente_id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-on-error-container hover:opacity-90 rounded text-base font-semibold shrink-0 transition-opacity"
                        >
                          <span>Ver ficha existente</span>
                          <span className="material-symbols-outlined text-sm">arrow_forward</span>
                        </Link>
                      </div>
                    </div>
                  )}

                  {socioVinculado && !docenteSeleccionado && (
                    <div className="bg-surface-container-low text-on-surface p-3 rounded-lg border border-outline-variant/40 flex items-center justify-between gap-2.5 mt-1">
                      <div className="flex items-center gap-2.5">
                        <span className="material-symbols-outlined text-base text-[#00875a]">how_to_reg</span>
                        <p className="text-base">
                          <strong>{`${socioVinculado.nombre ?? ''} ${socioVinculado.apellido ?? ''}`.trim()}</strong>
                          {' '}ya es socio (N° {formatNumber(socioVinculado.numero_socio)}). Se lo registrará como docente:
                          {' '}solo se pueden modificar el teléfono, el correo electrónico y el domicilio.
                        </p>
                      </div>
                      <BotonCambiarPersona onClick={quitarSeleccion} />
                    </div>
                  )}

                  {personaEncontrada && !socioVinculado && !docenteSeleccionado && (
                    <div className="bg-surface-container-low text-on-surface p-3 rounded-lg border border-outline-variant/40 flex items-center gap-2.5 mt-1">
                      <span className="material-symbols-outlined text-base text-[#00875a]">how_to_reg</span>
                      <p className="text-base">
                        <strong>{`${personaEncontrada.nombre ?? ''} ${personaEncontrada.apellido ?? ''}`.trim()}</strong>
                        {' '}ya está registrada en el padrón. Se completaron sus datos y se actualizarán al guardar.
                      </p>
                    </div>
                  )}
                </Campo>
              )}
            />

            <SeccionDomicilio bindInput={bindInput} errores={errores} localidades={localidades} onCrearLocalidad={crearLocalidad} />
            <div className="flex flex-col gap-4 pt-4 border-t border-outline-variant/20">
              <SeccionTitulo icono="gavel" titulo="Documentación" />

              {editando && documentoExistente && (
                <div className="bg-surface-container-low rounded-lg border border-outline-variant/40 p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="material-symbols-outlined text-error text-2xl shrink-0">picture_as_pdf</span>
                    <div className="min-w-0">
                      <p className="text-base font-semibold text-on-surface truncate">
                        {documentoExistente.nombre || 'Antecedentes penales'}
                      </p>
                      <p className="text-sm text-on-surface-variant">
                        {documentoExistente.archivoUrl ? 'Documento cargado actualmente' : 'Entregado sin archivo adjunto'}
                      </p>
                    </div>
                  </div>
                  {documentoExistente.archivoUrl && (
                    <a
                      href={mediaUrl(documentoExistente.archivoUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <span className="material-symbols-outlined text-base">open_in_new</span>
                      Ver PDF
                    </a>
                  )}
                </div>
              )}

              <Campo
                id="antecedente_penal"
                label={criminalRecordRequired
                  ? 'Antecedentes penales'
                  : documentoExistente.archivoUrl ? 'Reemplazar antecedente penal (opcional)' : 'Adjuntar antecedente penal (opcional)'}
                requerido={criminalRecordRequired}
                hint={criminalRecordRequired
                  ? '(adjuntá el PDF o indicá que fue entregado)'
                  : documentoExistente.archivoUrl ? '(dejalo vacío para conservar el actual)' : '(archivo PDF)'}
                error={errores.antecedente_penal}
              >
                <div className="relative w-full flex items-center gap-2">
                  <input
                    id="antecedente_penal"
                    type="file"
                    accept="application/pdf"
                    ref={fileInputRef}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null
                      setArchivoAntecedente(file)
                      if (file) setCriminalRecordDelivered(false)
                      limpiarError('antecedente_penal')
                    }}
                    className="hidden"
                  />
                  <div className={`relative flex-1 min-w-0 grid auto-rows-fr bg-surface-container-low rounded-lg p-3 border ${errores.antecedente_penal ? 'border-error' : 'border-outline-variant/40'}`}>
                    <div className="flex items-center min-w-0">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={criminalRecordDelivered}
                        title={criminalRecordDelivered ? 'Desmarcá "El documento fue entregado" para adjuntar el PDF' : undefined}
                        className="inline-flex items-center gap-2 h-9 px-4 bg-primary text-on-primary hover:bg-on-primary-container rounded-md text-sm font-semibold shadow-sm transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-primary"
                      >
                        <span className="material-symbols-outlined text-[18px]">upload_file</span>
                        <span>Seleccionar archivo</span>
                      </button>
                      <span className="ml-4 mr-2 text-sm text-on-surface-variant truncate">
                        {archivoAntecedente ? archivoAntecedente.name : 'Ningún archivo seleccionado'}
                      </span>
                    </div>
                    {criminalRecordRequired && (
                      <>
                        <div className="flex items-center gap-3 text-sm font-semibold text-outline" aria-hidden="true">
                          <span className="h-px flex-1 bg-outline-variant" />
                          o
                          <span className="h-px flex-1 bg-outline-variant" />
                        </div>
                        <label
                          className={`flex items-center gap-2 select-none w-fit ${archivoAntecedente ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                          title={archivoAntecedente ? 'Quitá el archivo adjunto para marcar esta opción' : undefined}
                        >
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-primary cursor-pointer disabled:cursor-not-allowed"
                            disabled={Boolean(archivoAntecedente)}
                            checked={criminalRecordDelivered}
                            onChange={(event) => {
                              setCriminalRecordDelivered(event.target.checked)
                              limpiarError('antecedente_penal')
                            }}
                          />
                          <span className="text-base text-on-surface font-medium">El documento fue entregado</span>
                        </label>
                      </>
                    )}
                  </div>
                  {archivoAntecedente && (
                    <button 
                      type="button" 
                      onClick={handleClearFile}
                      className="w-10 h-10 shrink-0 rounded-lg bg-surface-container-high hover:bg-error-container text-on-surface-variant hover:text-error flex items-center justify-center transition-colors cursor-pointer"
                      title="Quitar archivo seleccionado"
                    >
                      <span className="material-symbols-outlined text-[20px]">close</span>
                    </button>
                  )}
                </div>
                {archivoAntecedente && (
                  <p className="text-sm text-on-surface-variant mt-1">
                    {archivoAntecedente.name} ({(archivoAntecedente.size / 1024).toFixed(0)} KB)
                  </p>
                )}
              </Campo>
            </div>

            <div className="flex flex-col gap-4 pt-4 border-t border-outline-variant/20">
              <SeccionTitulo
                icono="sports_soccer"
                titulo="Cargos Deportivos"
                extra={(
                  <button
                    type="button"
                    onClick={() => setAsignaciones((actuales) => [...actuales, nuevaAsignacion()])}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-primary border border-primary/40 hover:bg-primary/10 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    Agregar cargo
                  </button>
                )}
              />

              {asignaciones.map((fila, indice) => (
                <FilaAsignacion
                  key={fila.clave}
                  fila={fila}
                  indice={indice}
                  errores={errores}
                  cargos={cargos}
                  categorias={categorias}
                  categoriasOcupadas={categoriasOcupadasFuera(fila.clave)}
                  puedeQuitar={asignaciones.length > 1}
                  onChange={(campo, valor) => actualizarAsignacion(fila.clave, campo, valor)}
                  onRemove={() => quitarAsignacion(fila.clave)}
                />
              ))}
            </div>
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
                  <span>{guardando ? 'Guardando...' : editando ? 'Guardar cambios' : 'Guardar docente'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default DocenteForm