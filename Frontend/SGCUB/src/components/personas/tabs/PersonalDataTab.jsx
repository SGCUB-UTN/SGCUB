import { yearsSince, isActiveStatus, formatDni, formatDate, formatPhone, yearsText } from '../format'
import { Field, RecordSection } from './parts'
import { EditButton } from '../HeaderPersona'

const nombreGenero = (persona) => {
  if (!persona.genero_nombre) return ''
  return persona.genero_nombre === 'Otro' ? persona.genero_otro || 'Otro' : persona.genero_nombre
}
export default function PersonalDataTab({ persona, localidades = [], deportivo, onEdit }) {
  if (!persona) return null

  const age = yearsSince(persona.fecha_nacimiento)
  const localidad = persona.domicilio_localidad_nombre
    ?? localidades.find((l) => l.localidad_id === persona.domicilio_localidad)?.nombre

  return (
    <div className="flex flex-col gap-8">
      <RecordSection title="Datos personales" extra={onEdit && <EditButton onClick={onEdit} />}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field
            label="Documento Nacional de Identidad (DNI)"
            value={persona.dni ? formatDni(persona.dni) : ''}
            icon="badge"
          />
          <Field label="Nombre(s)" value={persona.nombre} />
          <Field label="Apellido(s)" value={persona.apellido} />
          <Field
            label="Fecha de nacimiento"
            value={persona.fecha_nacimiento ? `${formatDate(persona.fecha_nacimiento)}${age !== null ? ` (${yearsText(age)})` : ''}` : ''}
            icon="cake"
          />
          <Field label="Género" value={nombreGenero(persona)} />
          <Field label="Teléfono / Móvil" value={persona.telefono ? formatPhone(persona.telefono) : ''} icon="call" />
          <Field label="Correo electrónico" value={persona.email} icon="mail" className="lg:col-span-2" />
        </div>
      </RecordSection>

      {deportivo && (
        <RecordSection
          title="Datos deportivos"
          color="bg-primary"
          
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            <Field
              label="Obra social / Cobertura médica"
              value={deportivo.obra_social}
              icon="health_and_safety"
            />
            <Field label="Talle de indumentaria" value={deportivo.talla} icon="checkroom" />
            <Field label="Categoría" value={deportivo.categoria} icon="sports_soccer" />
            <Field label="Categoría secundaria" value={deportivo.categoria_secundaria} icon="sports_soccer" />
          </div>
        </RecordSection>
      )}

      <RecordSection title="Domicilio" color="bg-secondary-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Field label="Calle" value={persona.domicilio_calle} className="sm:col-span-2 md:col-span-3" />
          <Field label="Número" value={persona.domicilio_numero} />
          <Field label="Piso" value={persona.domicilio_piso} />
          <Field label="Depto" value={persona.domicilio_departamento} />
          <Field label="Entre calle 1" value={persona.domicilio_entre_calle_1} className="md:col-span-2" />
          <Field label="Entre calle 2" value={persona.domicilio_entre_calle_2} className="md:col-span-2" />
          <Field label="Barrio" value={persona.domicilio_barrio_nombre} />
          <Field label="Localidad" value={localidad} />
        </div>
      </RecordSection>
    </div>
  )
}
