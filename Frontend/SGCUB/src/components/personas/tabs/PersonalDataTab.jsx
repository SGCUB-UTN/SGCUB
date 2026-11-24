import { yearsSince, formatDni, formatDate, formatPhone, yearsText } from '../format'
import { Field, RecordSection } from './parts'
import { EditButton } from '../HeaderPersona'

const nombreGenero = (persona) => {
  if (!persona.genero_nombre) return ''
  return persona.genero_nombre === 'Otro' ? persona.genero_otro || 'Otro' : persona.genero_nombre
}

const NIVELES_EDUCACION = {
  primario_en_proceso: 'Primario en proceso',
  primario_incompleto: 'Primario incompleto',
  primario_completo: 'Primario completo',
  secundario_en_proceso: 'Secundario en proceso',
  secundario_incompleto: 'Secundario incompleto',
  secundario_completo: 'Secundario completo',
  universitario_en_proceso: 'Universitario en proceso',
  universitario_incompleto: 'Universitario incompleto',
  universitario_completo: 'Universitario completo',
}

const COLUMN_GAP_CLASS = 'gap-x-6'
const GRID_CLASS = `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 ${COLUMN_GAP_CLASS} gap-y-5 mt-2`
const HALF_GRID_CLASS = `grid grid-cols-1 sm:grid-cols-2 ${COLUMN_GAP_CLASS} gap-y-5 mt-2`

const vaccinationValue = (scheme) => {
  if (scheme === null) return 'Sin especificar'
  return scheme ? 'Completo' : 'Incompleto'
}

const crossStreetsText = (first, second) => {
  if (first && second) return `Entre ${first} y ${second}`
  return first || second ? `Entre ${first || second}` : ''
}

const addressLines = (persona, localidad) => {
  const street = [persona.domicilio_calle, persona.domicilio_numero].filter(Boolean).join(' ')
  const unit = [
    persona.domicilio_piso ? `Piso ${persona.domicilio_piso}` : '',
    persona.domicilio_departamento ? `Depto ${persona.domicilio_departamento}` : '',
  ].filter(Boolean).join(' ')
  return {
    address: [street, unit].filter(Boolean).join(', '),
    crossStreets: crossStreetsText(persona.domicilio_entre_calle_1, persona.domicilio_entre_calle_2),
    area: [persona.domicilio_barrio_nombre, localidad].filter(Boolean).join(', '),
  }
}

export default function PersonalDataTab({ persona, localidades = [], deportivo, onEdit, extraActions }) {
  if (!persona) return null

  const age = yearsSince(persona.fecha_nacimiento)
  const localidad = persona.domicilio_localidad_nombre
    ?? localidades.find((l) => l.localidad_id === persona.domicilio_localidad)?.nombre
  const { address, crossStreets, area } = addressLines(persona, localidad)
  const incompleteVaccination = persona.esquema_vacunacion === false

  const fullName = [persona.nombre, persona.apellido].filter(Boolean).join(' ')
  const showHealth = persona.esquema_vacunacion !== undefined || Boolean(deportivo)

  return (
    <div className="flex flex-col gap-6">
      <RecordSection
        title="Identificación y contacto"
        extra={(extraActions || onEdit) && (
          <div className="flex items-center gap-2 flex-wrap">
            {extraActions}
            {onEdit && <EditButton onClick={onEdit}>Editar datos</EditButton>}
          </div>
        )}
      >
        <div className={GRID_CLASS}>
          <Field label="Nombre y apellido" value={fullName} />
          <Field label="DNI" value={persona.dni ? formatDni(persona.dni) : ''} icon="badge" />
          <Field
            label="Fecha de nacimiento"
            value={persona.fecha_nacimiento ? `${formatDate(persona.fecha_nacimiento)}${age !== null ? ` (${yearsText(age)})` : ''}` : ''}
            icon="cake"
          />
          <Field label="Género" value={nombreGenero(persona)} />
          <Field label="Teléfono" value={persona.telefono ? formatPhone(persona.telefono) : ''} icon="call" />
          <Field label="Correo electrónico" value={persona.email} icon="mail" className="lg:col-span-2" />
          {persona.nivel_educacion !== undefined && (
            <Field label="Nivel de educación" value={NIVELES_EDUCACION[persona.nivel_educacion] ?? 'Sin especificar'} icon="school" />
          )}
        </div>
      </RecordSection>

      {deportivo && (
        <RecordSection title="Datos deportivos" color="bg-primary">
          <div className={GRID_CLASS}>
            <Field label="Categoría principal" value={deportivo.categoria} icon="sports_soccer" />
            <Field label="Categoría secundaria" value={deportivo.categoria_secundaria} icon="sports_soccer" />
            <Field label="Talle de indumentaria" value={deportivo.talla} icon="checkroom" />
          </div>
        </RecordSection>
      )}

      <div className={`grid grid-cols-1 lg:grid-cols-2 ${COLUMN_GAP_CLASS} gap-y-6`}>
        {showHealth && (
          <RecordSection title="Salud y cobertura" color="bg-tertiary-container">
            <div className={HALF_GRID_CLASS}>
              {deportivo && (
                <Field label="Obra social / Cobertura médica" value={deportivo.obra_social} icon="health_and_safety" />
              )}
              {persona.esquema_vacunacion !== undefined && (
                <Field
                  label="Esquema de vacunación"
                  value={vaccinationValue(persona.esquema_vacunacion)}
                  icon={incompleteVaccination ? 'warning' : 'vaccines'}
                  tone={incompleteVaccination ? 'alert' : 'default'}
                />
              )}
            </div>
          </RecordSection>
        )}

        <RecordSection title="Domicilio" color="bg-secondary-container">
          <div className={HALF_GRID_CLASS}>
            <Field
              label="Dirección"
              value={address && (
                <>
                  {address}
                  {crossStreets && <span className="block font-normal text-on-surface-variant">{crossStreets}</span>}
                </>
              )}
              icon="home_pin"
            />
            <Field label="Barrio y localidad" value={area} icon="location_on" />
          </div>
        </RecordSection>
      </div>
    </div>
  )
}
