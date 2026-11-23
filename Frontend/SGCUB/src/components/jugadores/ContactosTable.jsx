import DataTable from '../shared/DataTable'
import StatusBadge from '../shared/StatusBadge'
import { formatDni, formatPhone } from '../personas/format'

function LegalGuardianBadge({ isLegalGuardian }) {
  return <StatusBadge size="md" badge={isLegalGuardian ? { label: 'Sí', tono: 'ok' } : { label: 'No', tono: 'neutro' }} />
}

const fullName = (contact) => `${contact.persona?.nombre ?? ''} ${contact.persona?.apellido ?? ''}`.trim()

const ROW_ACTION_CLASS = 'inline-flex items-center justify-center p-2 rounded-lg transition-colors cursor-pointer'

function RowAction({ icon, label, className, onClick }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={`${ROW_ACTION_CLASS} ${className}`}
      aria-label={label}
      title={label}
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">{icon}</span>
    </button>
  )
}

// Family links / emergency contacts of a jugador or docente. The actions column only shows the actions whose handler is given.
const byGuardianFirst = (a, b) => Number(Boolean(b.responsable_legal)) - Number(Boolean(a.responsable_legal))
  || fullName(a).localeCompare(fullName(b), 'es')

function ContactosTable({ contacts, onSelect, onEdit, onDelete, mostrarResponsableLegal = true, className = '' }) {
  const hasActions = Boolean(onEdit || onDelete)
  const sorted = [...contacts].sort(mostrarResponsableLegal ? byGuardianFirst : (a, b) => fullName(a).localeCompare(fullName(b), 'es'))
  return (
    <DataTable
      className={className}
      headers={(
        <>
          <th className="py-3 px-4" scope="col">Nombre y apellido</th>
          <th className="py-3 px-4" scope="col">DNI</th>
          <th className="py-3 px-4" scope="col">Teléfono</th>
          <th className="py-3 px-4" scope="col">Vínculo</th>
          {mostrarResponsableLegal && <th className="py-3 px-4 text-center" scope="col">Responsable legal</th>}
          {hasActions && <th className="py-3 px-4 text-center" scope="col">Acciones</th>}
        </>
      )}
    >
      {sorted.map((contact, index) => (
        <tr
          key={contact.vinculo_familiar_id ?? index}
          tabIndex={0}
          aria-label={`Ver datos de ${fullName(contact) || 'este contacto'}`}
          className="hover:bg-surface-container-low transition-colors cursor-pointer group focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
          onClick={() => onSelect(contact)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              onSelect(contact)
            }
          }}
        >
          <td className="py-3 px-4">
            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors inline-flex items-center gap-1.5">
              {fullName(contact) || 'Sin nombre'}
              <span className="material-symbols-outlined text-[16px] text-primary opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity" aria-hidden="true">visibility</span>
            </span>
          </td>
          <td className="py-3 px-4 text-on-surface-variant">{contact.persona?.dni ? formatDni(contact.persona.dni) : '—'}</td>
          <td className="py-3 px-4 whitespace-nowrap text-on-surface">{contact.persona?.telefono ? formatPhone(contact.persona.telefono) : '—'}</td>
          <td className="py-3 px-4">
            {contact.relacion ? (
              <StatusBadge size="md" badge={{ label: contact.relacion, tono: 'neutro' }} />
            ) : '—'}
          </td>
          {mostrarResponsableLegal && (
            <td className="py-3 px-4 text-center"><LegalGuardianBadge isLegalGuardian={contact.responsable_legal} /></td>
          )}
          {hasActions && (
          <td className="py-3 px-4 text-center whitespace-nowrap">
            {onEdit && (
              <RowAction
                icon="edit"
                label={`Editar contacto ${fullName(contact)}`.trim()}
                className="text-primary hover:bg-primary/10"
                onClick={() => onEdit(contact)}
              />
            )}
            {onDelete && (
              <RowAction
                icon="person_remove"
                label={`Quitar a ${fullName(contact)} de los contactos`.trim()}
                className="text-error hover:bg-error-container/60"
                onClick={() => onDelete(contact)}
              />
            )}
          </td>
          )}
        </tr>
      ))}
    </DataTable>
  )
}

export default ContactosTable
