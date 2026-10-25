import { useState } from 'react'
import { Button, Group, Modal, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core'
import { GENERO_OPTIONS, TIPO_OPTIONS } from './categoriaFormat'
import { collectErrorMessages } from '../personas/format'

const FIELDS = ['nombre', 'anio_vigente', 'edad_minima', 'edad_maxima', 'genero', 'tipo']

const emptyForm = () => ({
  nombre: '', anio_vigente: new Date().getFullYear(), edad_minima: 0, edad_maxima: '', genero: null, tipo: 'juvenil',
})

const parseErrors = (requestError) => {
  const data = requestError.response?.data
  if (!data || typeof data !== 'object') {
    return { general: requestError.response ? 'No se pudo guardar la categoría.' : 'No se pudo conectar con el servidor.' }
  }
  const errors = {}
  Object.entries(data).forEach(([field, messages]) => {
    const message = collectErrorMessages(messages).join(' ')
    if (!message) return
    if (FIELDS.includes(field)) errors[field] = message
    else errors.general = message
  })
  return errors
}

function CategoriaFormModal({ opened, onClose, onSubmit, categoria }) {
  const isEditing = Boolean(categoria)
  const [form, setForm] = useState(() => (categoria
    ? {
      nombre: categoria.nombre ?? '',
      anio_vigente: categoria.anio_vigente ?? new Date().getFullYear(),
      edad_minima: categoria.edad_minima ?? 0,
      edad_maxima: categoria.edad_maxima ?? '',
      genero: categoria.genero || null,
      tipo: categoria.tipo || 'juvenil',
    }
    : emptyForm()))
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    setErrors({})
    try {
      await onSubmit({ ...form, nombre: form.nombre.trim() })
      onClose()
    } catch (requestError) {
      setErrors(parseErrors(requestError))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => !isSaving && onClose()}
      centered
      title={<Text fw={700} size="xl">{isEditing ? 'Editar categoría' : 'Nueva categoría'}</Text>}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput
            label="Nombre"
            placeholder="Ej: Sub 15"
            value={form.nombre}
            onChange={(event) => setField('nombre', event.currentTarget.value)}
            error={errors.nombre}
            required
            data-autofocus
          />
          <Group grow align="flex-start">
            <NumberInput
              label="Año vigente"
              value={form.anio_vigente}
              onChange={(value) => setField('anio_vigente', value)}
              error={errors.anio_vigente}
              min={1900}
              required
            />
          </Group>
          <Group grow align="flex-start">
            <NumberInput
              label="Edad mínima"
              placeholder="Ej: 35"
              value={form.edad_minima}
              onChange={(value) => setField('edad_minima', value)}
              error={errors.edad_minima}
              min={0}
              required
            />
            <NumberInput
              label="Edad máxima"
              placeholder="Ej: 15"
              value={form.edad_maxima}
              onChange={(value) => setField('edad_maxima', value)}
              error={errors.edad_maxima}
              min={0}
              required
            />
          </Group>
          <Select
            label="Género"
            placeholder="Seleccione un género..."
            data={GENERO_OPTIONS}
            value={form.genero}
            onChange={(value) => setField('genero', value)}
            error={errors.genero}
            required
          />
          <Select
            label="Tipo"
            description="Juveniles se recategorizan solos, 4ta siempre se revisa a mano y mayores no se recategorizan."
            data={TIPO_OPTIONS}
            value={form.tipo}
            onChange={(value) => setField('tipo', value)}
            error={errors.tipo}
            required
          />
          {errors.general && <Text color="red" size="sm">{errors.general}</Text>}
          <Group position="right" mt="md">
            <Button type="button" variant="default" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSaving}>
              {isEditing ? 'Guardar cambios' : 'Crear categoría'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

export default CategoriaFormModal
