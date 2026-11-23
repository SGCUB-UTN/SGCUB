import { useState } from 'react'
import { Button, Group, Modal, Text } from '@mantine/core'
import StatusBadge from '../../shared/StatusBadge'
import { formatDni, formatPhone } from '../format'
import { SecondaryButton, Field, TAB_CARD_CLASS, TabHeader, TableFooter } from './parts'
import ContactModal from '../../jugadores/ContactModal'
import ContactosTable from '../../jugadores/ContactosTable'
import { SectionEmpty } from '../../shared/FlushSection'
import useToast from '../../../hooks/useToast'

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
  const person = contact.persona ?? {}
  const name = `${person.nombre ?? ''} ${person.apellido ?? ''}`.trim() || 'Sin nombre'
  const domicilioTexto = formatearDomicilioContacto(person)
  const entreCallesTexto = [person.domicilio_entre_calle_1, person.domicilio_entre_calle_2].filter(Boolean).join(' y ')
  const ubicacionTexto = [person.domicilio_barrio_nombre, person.domicilio_localidad_nombre].filter(Boolean).join(', ')

  return (
    <Modal opened onClose={onClose} centered size="lg" title={<Text fw={700} size="xl">{name}</Text>}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2 flex-wrap">
          {contact.relacion && <StatusBadge size="md" badge={{ label: contact.relacion, tono: 'neutro' }} />}
          {mostrarResponsableLegal && (
            <StatusBadge
              size="md"
              badge={contact.responsable_legal
                ? { label: 'Responsable legal autorizado', tono: 'ok' }
                : { label: 'Solo contacto de emergencia', tono: 'neutro' }}
            />
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <Field label="DNI" value={person.dni ? formatDni(person.dni) : ''} icon="badge" />
          <Field label="Teléfono" value={person.telefono ? formatPhone(person.telefono) : ''} icon="call" />
          <Field label="Correo electrónico" value={person.email} icon="mail" className="sm:col-span-2" />
          <Field
            label="Dirección"
            value={domicilioTexto && (
              <>
                {domicilioTexto}
                {entreCallesTexto && <span className="block font-normal text-on-surface-variant">Entre {entreCallesTexto}</span>}
              </>
            )}
            icon="home_pin"
          />
          <Field label="Barrio y localidad" value={ubicacionTexto} icon="location_on" />
        </div>
      </div>
    </Modal>
  )
}

function DeleteContactModal({ contact, onClose, onConfirm, etiquetaTitular = 'jugador' }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const person = contact.persona ?? {}
  const name = `${person.nombre ?? ''} ${person.apellido ?? ''}`.trim() || 'este contacto'

  const confirmDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await onConfirm(contact)
      onClose()
    } catch (requestError) {
      setError(requestError.message || 'No se pudo quitar el contacto.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal opened onClose={() => !deleting && onClose()} centered title={<Text fw={700} size="xl">Quitar contacto</Text>}>
      <Text size="md">
        ¿Confirmás que querés quitar a <strong>{name}</strong> de los contactos del {etiquetaTitular}? La persona no se borra del sistema.
      </Text>
      {error && <Text color="red" size="base" mt="md" role="alert">{error}</Text>}
      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose} disabled={deleting}>Cancelar</Button>
        <Button color="red" onClick={confirmDelete} loading={deleting}>Quitar</Button>
      </Group>
    </Modal>
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
  const { showToast } = useToast()
  const personName = (contacto) => `${contacto.persona?.nombre ?? ''} ${contacto.persona?.apellido ?? ''}`.trim()

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
        title="Familiares y contactos"
        description={description}
      />

      <div className={`mt-6 ${TAB_CARD_CLASS}`}>
        {contacts.length === 0 ? (
          <SectionEmpty>{`Este ${etiquetaTitular} todavía no tiene familiares ni contactos cargados.`}</SectionEmpty>
        ) : (
          <ContactosTable
            contacts={contacts}
            onSelect={setSelectedContact}
            onEdit={onEdit ? setContactToEdit : undefined}
            onDelete={onDelete ? setContactToDelete : undefined}
            mostrarResponsableLegal={mostrarResponsableLegal}
          />
        )}

        {onAdd && (
          <TableFooter>
            <SecondaryButton icon="person_add" onClick={() => setAddModalOpen(true)}>Agregar contacto</SecondaryButton>
          </TableFooter>
        )}
      </div>

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
          onConfirm={async (contacto) => {
            await onDelete(contacto)
            showToast({ title: 'Contacto quitado', description: `${personName(contacto)} ya no figura entre los contactos.` })
          }}
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
            showToast({ title: 'Contacto actualizado', description: personName(contacto) })
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
            showToast({ title: 'Contacto agregado', description: personName(contacto) })
          }}
          domicilioTitular={domicilioTitular}
          etiquetaTitular={etiquetaTitular}
          mostrarResponsableLegal={mostrarResponsableLegal}
        />
      )}
    </div>
  )
}
