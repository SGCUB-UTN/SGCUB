import DataTable from '../shared/DataTable'
import { formatDni } from '../personas/format'

function LegalGuardianBadge({ isLegalGuardian }) {
  return isLegalGuardian ? (
    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-base font-semibold border border-emerald-200">Sí</span>
  ) : (
    <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-base font-medium border border-outline-variant/30">No</span>
  )
}

const fullName = (contact) => `${contact.persona?.nombre ?? ''} ${contact.persona?.apellido ?? ''}`.trim()

// Family links / emergency contacts of a jugador or docente. The delete column only shows actions when `onDelete` is given.
function ContactosTable({ contacts, onSelect, onDelete, mostrarResponsableLegal = true }) {
  return (
    <DataTable
      className="border border-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm"
      bodyClassName="text-base"
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
          <td className="py-3.5 px-4">
            <span className="font-semibold text-on-surface group-hover:text-primary transition-colors inline-flex items-center gap-1.5">
              {fullName(contact) || 'Sin nombre'}
              <span className="material-symbols-outlined text-[16px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">open_in_new</span>
            </span>
          </td>
          <td className="py-3.5 px-4 text-on-surface-variant">{contact.persona?.dni ? formatDni(contact.persona.dni) : '—'}</td>
          <td className="py-3.5 px-4"><span className="font-mono text-base text-on-surface">{contact.persona?.telefono || '—'}</span></td>
          <td className="py-3.5 px-4">
            {contact.relacion ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface text-base font-medium">{contact.relacion}</span>
            ) : '—'}
          </td>
          {mostrarResponsableLegal && (
            <td className="py-3.5 px-4 text-center"><LegalGuardianBadge isLegalGuardian={contact.responsable_legal} /></td>
          )}
          <td className="py-3.5 px-4 text-center">
            {onDelete && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete(contact)
                }}
                className="inline-flex items-center justify-center p-2 rounded-lg text-error hover:bg-error-container/60 transition-colors cursor-pointer"
                aria-label={`Eliminar contacto ${fullName(contact)}`.trim()}
                title="Eliminar contacto"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
              </button>
            )}
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

export default ContactosTable
