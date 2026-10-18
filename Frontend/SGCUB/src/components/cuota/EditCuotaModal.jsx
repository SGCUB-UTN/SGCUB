import { Alert, Button, Group, Modal, Stack, Table, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

const formatAmount = (item) => {
  const monto = Number(item.monto ?? 0) * (item.es_descuento ? -1 : 1)
  return monto.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

function EditCuotaModal({ opened, onClose, onSubmit, formulario, onChange, loading, error, cuota }) {
  const socio = cuota?.socio
  const nombreSocio = socio ? `${socio.apellido}, ${socio.nombre}` : 'Sin socio'

  return (
    <Modal opened={opened} onClose={onClose} title="Editar cuota" centered size="md">
      <form onSubmit={onSubmit}>
        <Stack spacing="md">
          <Group grow>
            <TextInput label="Socio" value={nombreSocio} disabled />
            <TextInput label="Período" value={formulario.periodo || ''} disabled />
          </Group>

          <Group grow>
            <TextInput
              label="Fecha vencimiento 1"
              type="date"
              value={formulario.fecha_venc1 || ''}
              onChange={(event) => onChange('fecha_venc1', event.currentTarget.value)}
              required
            />
            <TextInput
              label="Fecha vencimiento 2"
              type="date"
              value={formulario.fecha_venc2 || ''}
              onChange={(event) => onChange('fecha_venc2', event.currentTarget.value)}
              required
            />
          </Group>

          <Stack spacing={4}>
            <Text size="sm" fw={500}>Ítems</Text>
            <Table withBorder>
              <tbody>
                {(cuota?.items ?? []).map((item) => (
                  <tr key={item.item_cuota_id}>
                    <td>{item.concepto_nombre ?? item.concepto}</td>
                    <td style={{ textAlign: 'right' }}>{formatAmount(item)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Stack>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} title="Atención" color="red" variant="filled">
              {error}
            </Alert>
          )}

          <Group position="right" mt="md">
            <Button type="button" variant="default" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" loading={loading} color="teal">
              Guardar cambios
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

export default EditCuotaModal
