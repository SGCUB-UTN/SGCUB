import { Button, Group, Modal, Text } from '@mantine/core'

export default function DocumentacionDeleteModal({ isOpen, onClose, onConfirm, document, typeName, deleting = false }) {
  return (
    <Modal
      opened={isOpen && Boolean(document)}
      onClose={() => !deleting && onClose()}
      centered
      title={<Text fw={700} size="xl">Eliminar documento</Text>}
    >
      <Text size="md">
        ¿Confirmás que querés eliminar <strong>{typeName || 'este documento'}</strong>? Se quita del legajo digital y no se puede deshacer.
      </Text>
      <Group position="right" mt="xl">
        <Button variant="default" onClick={onClose} disabled={deleting}>Cancelar</Button>
        <Button color="red" onClick={onConfirm} loading={deleting}>Eliminar</Button>
      </Group>
    </Modal>
  )
}
