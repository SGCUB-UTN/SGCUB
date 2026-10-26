// Settings of the general configuration the screen edits; they apply as soon as they are saved

export const ADDRESS_FIELDS = [
  'domicilio_calle',
  'domicilio_numero',
  'domicilio_piso',
  'domicilio_departamento',
  'domicilio_entre_calle_1',
  'domicilio_entre_calle_2',
  'domicilio_localidad',
  'domicilio_barrio',
]

export const NOTIFICATION_FIELDS = [
  'notificar_generacion_cuota',
  'notificar_recordatorio_vencimiento',
  'notificar_cuota_vencida',
  'notificar_modificacion_cuota',
  'notificar_comprobante_pago',
]

export const GENERAL_FIELD_LABELS = {
  club_nombre: 'Nombre del club',
  club_cuit: 'CUIT',
  club_telefono: 'Teléfono del club',
  club_email: 'Mail del club',
  cuotas_vencidas_morosidad: 'Cuotas vencidas para considerar moroso',
  dias_alerta_documentos: 'Días de aviso antes del vencimiento',
  notificar_generacion_cuota: 'Notificación al generar la cuota',
  notificar_recordatorio_vencimiento: 'Recordatorio antes del vencimiento',
  notificar_cuota_vencida: 'Notificación al cumplirse un vencimiento',
  notificar_modificacion_cuota: 'Notificación de modificaciones en la cuota',
  notificar_comprobante_pago: 'Envío de comprobantes de pago',
  dias_recordatorio_vencimiento: 'Días de anticipación del recordatorio',
  email_nombre_remitente: 'Nombre del remitente',
  email_firma: 'Firma de los mails',
}

export const GENERAL_FIELDS = [...Object.keys(GENERAL_FIELD_LABELS), ...ADDRESS_FIELDS]

// Labels of the changed settings, with the address fields as a single "Domicilio del club"
export const generalChangeLabels = (fields) => [
  ...fields.filter((field) => !ADDRESS_FIELDS.includes(field)).map((field) => GENERAL_FIELD_LABELS[field]),
  ...(fields.some((field) => ADDRESS_FIELDS.includes(field)) ? ['Domicilio del club'] : []),
]

const MAX_TEXT_LENGTH = 40

const formatGeneralValue = (value) => {
  if (value === true) return 'Sí'
  if (value === false) return 'No'
  if (value === null || value === undefined || value === '') return '—'
  const text = String(value)
  return text.length > MAX_TEXT_LENGTH ? `${text.slice(0, MAX_TEXT_LENGTH)}…` : text
}

// 'Calle 8 4100, Piso 2 B, Berisso': the locality name is only known for the saved address
const formatAddress = (values, localityName) => {
  const street = [values.domicilio_calle, values.domicilio_numero].filter(Boolean).join(' ')
  const floor = [values.domicilio_piso && `Piso ${values.domicilio_piso}`, values.domicilio_departamento].filter(Boolean).join(' ')
  return [street, floor, localityName].filter(Boolean).join(', ') || '—'
}

/**
 * Before/after rows of the settings that apply on save, for the changes summary.
 * The address is a single row and the logo is described by the file chosen.
 */
export const generalChangeRows = ({ changes, general, draft }) => {
  const rows = changes.general
    .filter((field) => !ADDRESS_FIELDS.includes(field))
    .map((field) => ({
      key: field,
      label: GENERAL_FIELD_LABELS[field],
      before: formatGeneralValue(general[field]),
      after: formatGeneralValue(draft.general[field]),
    }))
  if (changes.general.some((field) => ADDRESS_FIELDS.includes(field))) {
    const sameLocality = String(draft.general.domicilio_localidad ?? '') === String(general.domicilio_localidad ?? '')
    rows.push({
      key: 'domicilio',
      label: 'Domicilio del club',
      before: formatAddress(general, general.domicilio_localidad_nombre),
      after: formatAddress(draft.general, sameLocality ? general.domicilio_localidad_nombre : draft.general.domicilio_localidad_nombre),
    })
  }
  if (changes.logo) {
    rows.push({
      key: 'logo',
      label: 'Logo del club',
      before: general.club_logo ? 'Cargado' : 'Sin logo',
      after: draft.logo ? draft.logo.name : 'Sin logo',
    })
  }
  return rows
}
