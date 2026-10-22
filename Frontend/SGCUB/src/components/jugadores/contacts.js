export const RELATIONS = ['Madre', 'Padre', 'Tutor', 'Abuelo/a', 'Hermano/a', 'Pareja', 'Otro']

export const CAMPOS_CONTACTO = ['dni', 'nombre', 'apellido', 'telefono', 'relacion']
export const CAMPOS_DOMICILIO_CONTACTO = [
  'domicilio_calle',
  'domicilio_numero',
  'domicilio_piso',
  'domicilio_departamento',
  'domicilio_entre_calle_1',
  'domicilio_entre_calle_2',
  'domicilio_localidad',
  'domicilio_barrio',
]

let ultimaClave = 0
export const nuevaClaveContacto = () => `contacto-${++ultimaClave}`

export const idCampoContacto = (fila, campo) => `${fila.clave}-${campo}`

const normalizarTexto = (valor) => String(valor ?? '').trim().toLowerCase()

export function sonMismoDomicilio(personaContacto, titular) {
  if (!personaContacto || !titular) return false
  const calleContacto = normalizarTexto(personaContacto.domicilio_calle)
  const numeroContacto = normalizarTexto(personaContacto.domicilio_numero)
  const localidadContacto = String(personaContacto.domicilio_localidad ?? '')
  const calleTitular = normalizarTexto(titular.domicilio_calle)
  const numeroTitular = normalizarTexto(titular.domicilio_numero)
  const localidadTitular = String(titular.domicilio_localidad ?? '')

  if (!calleContacto || !numeroContacto || !localidadContacto) return false
  return (
    calleContacto === calleTitular
    && numeroContacto === numeroTitular
    && localidadContacto === localidadTitular
    && normalizarTexto(personaContacto.domicilio_piso) === normalizarTexto(titular.domicilio_piso)
    && normalizarTexto(personaContacto.domicilio_departamento) === normalizarTexto(titular.domicilio_departamento)
  )
}

export const tieneDomicilioRegistrado = (persona) => Boolean(
  persona
  && String(persona.domicilio_calle ?? '').trim()
  && String(persona.domicilio_numero ?? '').trim()
  && persona.domicilio_localidad,
)

export const contactoAFila = (contacto, titular = null) => {
  const persona = contacto.persona ?? {}
  const mismoDomicilio = contacto.mismo_domicilio !== undefined
    ? Boolean(contacto.mismo_domicilio)
    : sonMismoDomicilio(persona, titular)
  const tieneDomicilioPrevio = contacto.tiene_domicilio_previo !== undefined
    ? Boolean(contacto.tiene_domicilio_previo)
    : Boolean(contacto.vinculo_familiar_id && tieneDomicilioRegistrado(persona))

  return {
    clave: nuevaClaveContacto(),
    vinculo_familiar_id: contacto.vinculo_familiar_id,
    tiene_domicilio_previo: tieneDomicilioPrevio,
    dni: String(persona.dni ?? ''),
    nombre: persona.nombre ?? '',
    apellido: persona.apellido ?? '',
    telefono: persona.telefono ?? '',
    email: persona.email ?? '',
    relacion: contacto.relacion ?? '',
    responsable_legal: Boolean(contacto.responsable_legal),
    mismo_domicilio: mismoDomicilio,
    domicilio_calle: persona.domicilio_calle ?? '',
    domicilio_numero: persona.domicilio_numero ?? '',
    domicilio_piso: persona.domicilio_piso ?? '',
    domicilio_departamento: persona.domicilio_departamento ?? '',
    domicilio_entre_calle_1: persona.domicilio_entre_calle_1 ?? '',
    domicilio_entre_calle_2: persona.domicilio_entre_calle_2 ?? '',
    domicilio_localidad: persona.domicilio_localidad ? String(persona.domicilio_localidad) : '',
    domicilio_barrio: persona.domicilio_barrio ? String(persona.domicilio_barrio) : '',
  }
}

export const filaAContacto = (fila, titular = null, incluirResponsableLegal = true) => {
  const origenDomicilio = fila.mismo_domicilio && titular ? titular : fila
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

  return {
    ...(fila.vinculo_familiar_id ? { vinculo_familiar_id: fila.vinculo_familiar_id } : {}),
    persona: {
      dni: fila.dni.trim(),
      nombre: fila.nombre.trim(),
      apellido: fila.apellido.trim(),
      telefono: fila.telefono.trim(),
      email: fila.email.trim() || null,
      ...datosDomicilio,
    },
    relacion: fila.relacion,
    responsable_legal: incluirResponsableLegal ? Boolean(fila.responsable_legal) : false,
  }
}

export function tieneDatosDomicilioParciales(fila) {
  return [
    fila.domicilio_calle,
    fila.domicilio_numero,
    fila.domicilio_piso,
    fila.domicilio_departamento,
    fila.domicilio_entre_calle_1,
    fila.domicilio_entre_calle_2,
    fila.domicilio_barrio,
  ].some((valor) => String(valor ?? '').trim() !== '')
}

export function validarContactos(contactos, dniTitular = '', etiquetaTitular = 'jugador') {
  const errores = {}
  const dnis = new Set()
  const dniTitularLimpio = String(dniTitular ?? '').trim()
  contactos.forEach((fila) => {
    CAMPOS_CONTACTO.forEach((campo) => {
      if (!String(fila[campo] ?? '').trim()) errores[idCampoContacto(fila, campo)] = 'Obligatorio.'
    })
    const dni = fila.dni.trim()
    if (dni && !/^\d{7,8}$/.test(dni)) errores[idCampoContacto(fila, 'dni')] = 'DNI de 7 u 8 dígitos.'
    else if (dni && dniTitularLimpio && dni === dniTitularLimpio) {
      errores[idCampoContacto(fila, 'dni')] = `No puede ser el mismo ${etiquetaTitular}.`
    } else if (dni && dnis.has(dni)) errores[idCampoContacto(fila, 'dni')] = 'DNI repetido.'
    dnis.add(dni)
    const email = fila.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errores[idCampoContacto(fila, 'email')] = 'Correo inválido.'

    if (!fila.mismo_domicilio && tieneDatosDomicilioParciales(fila)) {
      if (!String(fila.domicilio_calle ?? '').trim()) {
        errores[idCampoContacto(fila, 'domicilio_calle')] = 'Ingrese la calle.'
      }
      if (!String(fila.domicilio_numero ?? '').trim()) {
        errores[idCampoContacto(fila, 'domicilio_numero')] = 'Ingrese el número.'
      }
      if (!String(fila.domicilio_localidad ?? '').trim()) {
        errores[idCampoContacto(fila, 'domicilio_localidad')] = 'Seleccione la localidad.'
      }
    }
  })
  return errores
}

export const getContactsPayload = (entidad) => (entidad?.vinculos_familiares ?? []).map((c) => ({
  vinculo_familiar_id: c.vinculo_familiar_id,
  persona: {
    nombre: c.persona?.nombre ?? '',
    apellido: c.persona?.apellido ?? '',
    dni: c.persona?.dni ?? '',
    telefono: c.persona?.telefono ?? '',
    email: c.persona?.email ?? null,
    ...(c.persona?.domicilio_calle && c.persona?.domicilio_numero && c.persona?.domicilio_localidad
      ? {
          domicilio_calle: c.persona.domicilio_calle,
          domicilio_numero: c.persona.domicilio_numero,
          domicilio_piso: c.persona.domicilio_piso ?? null,
          domicilio_departamento: c.persona.domicilio_departamento ?? null,
          domicilio_entre_calle_1: c.persona.domicilio_entre_calle_1 ?? null,
          domicilio_entre_calle_2: c.persona.domicilio_entre_calle_2 ?? null,
          domicilio_localidad: c.persona.domicilio_localidad,
          domicilio_barrio: c.persona.domicilio_barrio ?? null,
        }
      : {}),
  },
  relacion: c.relacion ?? '',
  responsable_legal: Boolean(c.responsable_legal),
}))

export const getContactsPayloadWith = (entidad, contacto) => getContactsPayload(entidad).map((item) => (
  item.vinculo_familiar_id === contacto.vinculo_familiar_id
    ? {
        vinculo_familiar_id: contacto.vinculo_familiar_id,
        persona: contacto.persona,
        relacion: contacto.relacion,
        responsable_legal: Boolean(contacto.responsable_legal),
      }
    : item
))
