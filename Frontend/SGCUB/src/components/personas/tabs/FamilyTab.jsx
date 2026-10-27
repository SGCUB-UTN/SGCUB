import { useEffect, useState } from 'react'
import { formatDni, formatPhone } from '../format'
import { SecondaryButton, Field, TabHeader, EmptyState } from './parts'
import ContactModal from '../../jugadores/ContactModal'
import ContactosTable from '../../jugadores/ContactosTable'
import { FLUSH_END_CLASS } from '../../shared/flushTable'

function formatearDomicilioContacto(person) {
  if (!person?.domicilio_calle && !person?.domicilio_numero) return ''
  const calleNumero = [person.domicilio_calle, person.domicilio_numero].filter(Boolean).join(' ')
  const pisoDepto = [
    person.domicilio_piso ? `Piso ${person.domicilio_piso}` : '',
    person.domicilio_departamento ? `Depto ${person.domicilio_departamento}` : '',
  ].filter(Boolean).join(' ')
  return [calleNumero, pisoDepto].filter(Boolean).join(', ')
}

function ContactDetailsModal({ contact, onClose, mostrarResponsableLegal = true }) {
  useEffect(() => {
    const closeWithEscape = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [onClose])

  const person = contact.persona ?? {}
  const name = `${person.nombre ?? ''} ${person.apellido ?? ''}`.trim() || 'Sin nombre'
  const domicilioTexto = formatearDomicilioContacto(person)
  const entreCallesTexto = [person.domicilio_entre_calle_1, person.domicilio_entre_calle_2].filter(Boolean).join(' y ')
  const ubicacionTexto = [person.domicilio_barrio_nombre, person.domicilio_localidad_nombre].filter(Boolean).join(', ')

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 bg-inverse-surface/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-detalle-contacto"
        className="w-full max-w-lg bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-4 border-b border-surface-container">
          <div className="flex flex-col gap-1">
            <h2 id="titulo-detalle-contacto" className="text-xl font-bold text-on-surface">{name}</h2>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {contact.relacion && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface text-base font-medium">{contact.relacion}</span>
              )}
              {mostrarResponsableLegal && (
                <span className={`text-base font-semibold ${contact.responsable_legal ? 'text-emerald-700' : 'text-on-surface-variant'}`}>
                  {contact.responsable_legal ? 'Responsable legal autorizado' : 'Solo contacto de emergencia'}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="DNI" value={person.dni ? formatDni(person.dni) : ''} icon="badge" />
          <Field label="Teléfono" value={person.telefono ? formatPhone(person.telefono) : ''} icon="call" />
          <Field label="Correo electrónico" value={person.email} icon="mail" className="sm:col-span-2" />
          <Field label="Domicilio" value={domicilioTexto} icon="home_pin" className="sm:col-span-2" />
          {entreCallesTexto && (
            <Field label="Entre calles" value={entreCallesTexto} className="sm:col-span-2" />
          )}
          <Field label="Localidad / Barrio" value={ubicacionTexto} icon="location_on" className="sm:col-span-2" />
        </div>
      </div>
    </div>
  )
}

function DeleteContactModal({ contact, onClose, onConfirm, etiquetaTitular = 'jugador' }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const person = contact.persona ?? {}
  const name = `${person.nombre ?? ''} ${person.apellido ?? ''}`.trim() || 'este contacto'

  useEffect(() => {
    const closeWithEscape = (event) => event.key === 'Escape' && !deleting && onClose()
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [deleting, onClose])

  const confirmDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await onConfirm(contact)
      onClose()
    } catch (requestError) {
      setError(requestError.message || 'No se pudo eliminar el contacto.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-inverse-surface/40" onClick={() => !deleting && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-contact-title"
        className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-4 border-b border-surface-container">
          <div>
            <h3 id="delete-contact-title" className="text-xl font-bold text-on-surface">Eliminar contacto</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="p-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors cursor-pointer disabled:opacity-50"
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="p-6">
          <p className="mt-1 text-base text-on-surface-variant">¿Estás seguro de eliminar a {name}?, esta acción quitará el vínculo familiar del {etiquetaTitular}.</p>
          {error && <p className="mt-4 px-3 py-2 rounded-lg bg-error-container/40 text-base text-on-error-container" role="alert">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-surface-container">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="inline-flex items-center gap-2 h-10 px-4 bg-surface-container-low hover:bg-surface-container text-on-surface border border-outline-variant/40 rounded-lg text-base font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 h-10 px-4 bg-error text-on-error hover:bg-error/90 rounded-lg text-base font-semibold transition-colors cursor-pointer disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-[20px] ${deleting ? 'animate-spin' : ''}`}>{deleting ? 'progress_activity' : 'delete'}</span>
            {deleting ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function FamilyTab({
  contacts = [],
  onAdd,
  onEdit,
  onDelete,
  domicilioTitular = null,
  etiquetaTitular = 'jugador',
  mostrarResponsableLegal = true,
}) {
  const [selectedContact, setSelectedContact] = useState(null)
  const [contactToDelete, setContactToDelete] = useState(null)
  const [contactToEdit, setContactToEdit] = useState(null)
  const [addModalOpen, setAddModalOpen] = useState(false)

  const ensureNotDuplicated = (contacto) => {
    const dni = String(contacto.persona?.dni ?? '').trim()
    const duplicated = contacts.some((item) => (
      String(item.persona?.dni ?? '').trim() === dni && item.vinculo_familiar_id !== contacto.vinculo_familiar_id
    ))
    if (duplicated) throw new Error(`Esta persona ya figura entre los contactos del ${etiquetaTitular}.`)
  }

  const description = mostrarResponsableLegal
    ? `Personas vinculadas al ${etiquetaTitular} para notificaciones y responsabilidad legal`
    : `Personas vinculadas al ${etiquetaTitular} para notificaciones y contacto de emergencia`

  return (
    <div className="flex flex-col">
      <TabHeader
        title="Vínculos familiares y contactos de emergencia"
        description={description}
        divider={false}
        actions={onAdd && (
          <SecondaryButton icon="person_add" onClick={() => setAddModalOpen(true)}>Agregar familiar / contacto</SecondaryButton>
        )}
      />

      {contacts.length === 0 ? (
        <EmptyState
          icon="family_restroom"
          title="Sin contactos registrados"
          description={`Este ${etiquetaTitular} todavía no tiene familiares ni contactos de emergencia cargados.`}
        />
      ) : (
        <ContactosTable
          contacts={contacts}
          onSelect={setSelectedContact}
          onEdit={onEdit ? setContactToEdit : undefined}
          onDelete={onDelete ? setContactToDelete : undefined}
          mostrarResponsableLegal={mostrarResponsableLegal}
          className={FLUSH_END_CLASS}
        />
      )}

      {selectedContact && (
        <ContactDetailsModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          mostrarResponsableLegal={mostrarResponsableLegal}
        />
      )}
      {contactToDelete && onDelete && (
        <DeleteContactModal
          contact={contactToDelete}
          onClose={() => setContactToDelete(null)}
          onConfirm={onDelete}
          etiquetaTitular={etiquetaTitular}
        />
      )}
      {contactToEdit && onEdit && (
        <ContactModal
          contact={contactToEdit}
          onClose={() => setContactToEdit(null)}
          onSubmit={async (contacto) => {
            ensureNotDuplicated(contacto)
            await onEdit(contacto)
          }}
          domicilioTitular={domicilioTitular}
          etiquetaTitular={etiquetaTitular}
          mostrarResponsableLegal={mostrarResponsableLegal}
        />
      )}
      {addModalOpen && (
        <ContactModal
          onClose={() => setAddModalOpen(false)}
          onSubmit={async (contacto) => {
            ensureNotDuplicated(contacto)
            await onAdd(contacto)
          }}
          domicilioTitular={domicilioTitular}
          etiquetaTitular={etiquetaTitular}
          mostrarResponsableLegal={mostrarResponsableLegal}
        />
      )}
    </div>
  )
}
