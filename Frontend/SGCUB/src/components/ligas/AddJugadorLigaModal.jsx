import { useEffect, useMemo, useState } from 'react'
import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core'
import { getJugadores, patchJugador } from '../../api/jugadores'
import { formatDni, getErrorMessage, isActiveStatus } from '../personas/format'

const jugadorLabel = (jugador) => {
  const socio = jugador.socio ?? {}
  const name = [socio.apellido, socio.nombre].filter(Boolean).join(', ') || 'Sin nombre'
  const details = [socio.dni && `DNI ${formatDni(socio.dni)}`, jugador.categoria?.nombre].filter(Boolean)
  return details.length ? `${name} · ${details.join(' · ')}` : name
}

const currentLeaguesText = (jugador) => (jugador?.ligas ?? []).map((liga) => liga.nombre).join(', ')

function AddJugadorLigaModal({ opened, onClose, onAdded, liga, assignedJugadorIds }) {
  const [carga, setCarga] = useState({ isLoading: true, error: '', jugadores: [] })
  const [jugadorId, setJugadorId] = useState(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!opened) return undefined
    let active = true
    getJugadores({ view: 'listado' })
      .then((jugadores) => active && setCarga({ isLoading: false, error: '', jugadores }))
      .catch((requestError) => active && setCarga({
        isLoading: false,
        error: getErrorMessage(requestError, 'No se pudieron cargar los jugadores.'),
        jugadores: [],
      }))
    return () => { active = false }
  }, [opened])

  const options = useMemo(
    () => carga.jugadores
      .filter((jugador) => isActiveStatus(jugador.socio?.estado_administrativo_nombre) && !assignedJugadorIds.includes(jugador.jugador_id))
      .map((jugador) => ({ value: String(jugador.jugador_id), label: jugadorLabel(jugador) }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [carga.jugadores, assignedJugadorIds],
  )

  const selected = carga.jugadores.find((jugador) => String(jugador.jugador_id) === jugadorId)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!selected) return
    setIsSaving(true)
    setError('')
    try {
      const ligas = [...(selected.ligas ?? []).map((item) => item.liga_id), liga.liga_id]
      await patchJugador(selected.jugador_id, { ligas })
      await onAdded(selected)
      onClose()
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'No se pudo agregar el jugador a la liga.'))
      setIsSaving(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => !isSaving && onClose()}
      centered
      size="lg"
      title={<Text fw={700} size="xl">Agregar jugador a {liga.nombre}</Text>}
    >
      <form onSubmit={handleSubmit}>
        <Stack>
          <Select
            label="Jugador"
            placeholder={carga.isLoading ? 'Cargando jugadores...' : 'Buscar por apellido, nombre, DNI o categoría...'}
            data={options}
            value={jugadorId}
            onChange={(value) => {
              setJugadorId(value)
              setError('')
            }}
            description={selected ? `Ligas actuales: ${currentLeaguesText(selected) || 'ninguna'}` : undefined}
            nothingFound="No hay jugadores para agregar."
            dropdownPosition="bottom"
            maxDropdownHeight={260}
            withinPortal
            disabled={carga.isLoading || Boolean(carga.error)}
            searchable
            required
            data-autofocus
          />
          {carga.error && <Text color="red" size="sm">{carga.error}</Text>}
          {error && <Text color="red" size="sm">{error}</Text>}
          <Group position="right" mt="md">
            <Button type="button" variant="default" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" loading={isSaving} disabled={!selected}>
              Agregar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  )
}

export default AddJugadorLigaModal
