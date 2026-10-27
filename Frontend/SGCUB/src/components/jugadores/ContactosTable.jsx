import DataTable from '../shared/DataTable'
import { FLUSH_TABLE_CLASS } from '../shared/flushTable'
import { formatDni, formatPhone } from '../personas/format'

function LegalGuardianBadge({ isLegalGuardian }) {
  return isLegalGuardian ? (
    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-base font-semibold border border-emerald-200">Sí</span>
  ) : (
    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-base font-medium border border-outline-variant/30">No</span>
  )
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
      <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
  )
}

// Family links / emergency contacts of a jugador or docente. The actions column only shows the actions whose handler is given.
function ContactosTable({ contacts, onSelect, onEdit, onDelete, mostrarResponsableLegal = true, className = '' }) {
  return (
    <DataTable
      className={`${FLUSH_TABLE_CLASS} ${className}`}
      headers={(
        <>
          <th className="py-3 px-4" scope="col">Nombre y apellido</th>
          <th className="py-3 px-4" scope="col">DNI</th>
          <th className="py-3 px-4" scope="col">Teléfono</th>
          <th className="py-3 px-4" scope="col">Vínculo</th>
          {mostrarResponsableLegal && <th className="py-3 px-4 text-center" scope="col">Responsable legal</th>}
          <th className="py-3 px-4 text-center" scope="col">Acciones</th>
        </>
      )}
    >
      {contacts.map((contact, index) => (
        <tr
          key={contact.vinculo_familiar_id ?? index}
          className="hover:bg-surface-container-low transition-colors cursor-pointer group"
          onClick={() => onSelect(contact)}
        >
          <td className="py-3 px-4">
            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors inline-flex items-center gap-1.5">
              {fullName(contact) || 'Sin nombre'}
              <span className="material-symbols-outlined text-[16px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
            </span>
          </td>
          <td className="py-3 px-4 text-on-surface-variant">{contact.persona?.dni ? formatDni(contact.persona.dni) : '—'}</td>
          <td className="py-3 px-4 whitespace-nowrap text-on-surface">{formatPhone(contact.persona?.telefono)}</td>
          <td className="py-3 px-4">
            {contact.relacion ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface text-sm font-medium">{contact.relacion}</span>
            ) : '—'}
          </td>
          {mostrarResponsableLegal && (
            <td className="py-3 px-4 text-center"><LegalGuardianBadge isLegalGuardian={contact.responsable_legal} /></td>
          )}
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
                icon="delete"
                label={`Eliminar contacto ${fullName(contact)}`.trim()}
                className="text-error hover:bg-error-container/60"
                onClick={() => onDelete(contact)}
              />
            )}
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

export default ContactosTable
