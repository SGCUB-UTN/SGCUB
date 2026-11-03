import { formatPhoneInput, isPhoneTooLong, phoneDigits, phoneError } from '../personas/format'

export const bindPhone = (binding) => ({
  ...binding,
  value: formatPhoneInput(binding.value),
  onChange: (event) => {
    if (isPhoneTooLong(event.target.value)) return
    binding.onChange({ target: { value: phoneDigits(event.target.value) } })
  },
})

export const FORM_INICIAL = {
  nombre: '', apellido: '', dni: '', telefono: '', email: '', estado_administrativo: '',
  fecha_nacimiento: '', genero: '', genero_otro: '',
  domicilio_calle: '', domicilio_numero: '', domicilio_piso: '', domicilio_departamento: '',
  domicilio_entre_calle_1: '', domicilio_entre_calle_2: '', domicilio_barrio: '', domicilio_localidad: '',
}

// Orden en el que se recorren los campos para enfocar el primer error.
export const CAMPOS_OBLIGATORIOS = [
  'dni', 'nombre', 'apellido', 'fecha_nacimiento', 'genero', 'telefono', 'email',
  'domicilio_calle', 'domicilio_numero', 'domicilio_localidad',
]

const INPUT_BASE = 'w-full h-11 px-3.5 bg-surface-container-low/60 rounded text-on-surface placeholder:text-outline text-base focus:outline-none focus:bg-surface-container-lowest transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
const INPUT_OK = 'border border-outline-variant/50 focus:border-primary'
const INPUT_ERROR = 'border-2 border-error focus:border-error'

export const claseInput = (conError, extra = '') => `${INPUT_BASE} ${conError ? INPUT_ERROR : INPUT_OK} ${extra}`

export const socioAFormulario = (socio) => ({
  nombre: socio.nombre || '',
  apellido: socio.apellido || '',
  dni: socio.dni ? String(socio.dni) : '',
  telefono: phoneDigits(socio.telefono),
  email: socio.email || '',
  estado_administrativo: socio.estado_administrativo ? String(socio.estado_administrativo) : '',
  fecha_nacimiento: socio.fecha_nacimiento || '',
  genero: socio.genero ? String(socio.genero) : '',
  genero_otro: socio.genero_otro || '',
  domicilio_calle: socio.domicilio_calle || '',
  domicilio_numero: socio.domicilio_numero || '',
  domicilio_piso: socio.domicilio_piso || '',
  domicilio_departamento: socio.domicilio_departamento || '',
  domicilio_entre_calle_1: socio.domicilio_entre_calle_1 || '',
  domicilio_entre_calle_2: socio.domicilio_entre_calle_2 || '',
  domicilio_barrio: socio.domicilio_barrio ? String(socio.domicilio_barrio) : '',
  domicilio_localidad: socio.domicilio_localidad ? String(socio.domicilio_localidad) : '',
})

export function validar(formulario, esGeneroOtro) {
  const errores = {}
  CAMPOS_OBLIGATORIOS.forEach((campo) => {
    if (!String(formulario[campo] ?? '').trim()) errores[campo] = 'Este campo es obligatorio.'
  })

  const dni = formulario.dni.trim()
  if (dni && !/^\d{7,8}$/.test(dni)) {
    errores.dni = 'Ingrese un DNI válido de 7 u 8 dígitos, sin puntos ni guiones.'
  }

  const email = formulario.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errores.email = 'Ingrese un correo electrónico válido.'
  }

  const telefonoInvalido = phoneError(formulario.telefono)
  if (telefonoInvalido) errores.telefono = telefonoInvalido

  if (formulario.fecha_nacimiento && new Date(`${formulario.fecha_nacimiento}T00:00:00`) > new Date()) {
    errores.fecha_nacimiento = 'La fecha de nacimiento no puede ser futura.'
  }

  if (esGeneroOtro && !formulario.genero_otro.trim()) {
    errores.genero_otro = 'Especifique el género.'
  }

  return errores
}

export const enfocarCampo = (campo) => {
  const elemento = document.getElementById(campo)
  if (!elemento) return
  elemento.scrollIntoView({ behavior: 'smooth', block: 'center' })
  elemento.focus({ preventScroll: true })
}
