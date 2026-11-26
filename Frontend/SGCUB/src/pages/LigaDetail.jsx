import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getJugadoresByLiga, patchJugador } from '../api/jugadores'
import { getLiga } from '../api/ligas'
import CategoriaEmptyState from '../components/categorias/CategoriaEmptyState'
import CategoriaHeader from '../components/categorias/CategoriaHeader'
import AddJugadorLigaModal from '../components/ligas/AddJugadorLigaModal'
import ConfirmRemoveJugadorLigaModal from '../components/ligas/ConfirmRemoveJugadorLigaModal'
import LigaJugadoresTable from '../components/ligas/LigaJugadoresTable'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { getErrorMessage } from '../components/personas/format'
import { PrimaryButton, TabHeader } from '../components/personas/tabs/parts'
import useToast from '../hooks/useToast'

function LigaDetail() {
  const { id } = useParams()
  const { showToast } = useToast()
  const [detail, setDetail] = useState({ id: null, liga: null, jugadores: [], error: null })
  const [modalKey, setModalKey] = useState(0)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [removal, setRemoval] = useState({ opened: false, jugador: null })

  useEffect(() => {
    let active = true
    Promise.all([getLiga(id), getJugadoresByLiga(id)])
      .then(([liga, jugadores]) => active && setDetail({ id, liga, jugadores, error: null }))
      .catch((error) => active && setDetail({
        id,
        liga: null,
        jugadores: [],
        error: getErrorMessage(error, 'No se pudo cargar la información de la liga.'),
      }))
    return () => { active = false }
  }, [id])

  const openAdd = () => {
    setModalKey((key) => key + 1)
    setIsAddOpen(true)
  }

  const handleAdded = async (jugador) => {
    await reloadJugadores()
    showToast({
      title: 'Jugador agregado',
      description: `${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''} quedó registrado en ${detail.liga.nombre}.`.trim(),
    })
  }

  const reloadJugadores = async () => {
    const jugadores = await getJugadoresByLiga(id)
    setDetail((current) => ({ ...current, jugadores }))
  }

  const openRemoval = (jugador) => {
    setModalKey((key) => key + 1)
    setRemoval({ opened: true, jugador })
  }

  const handleRemove = async () => {
    const { jugador } = removal
    const ligas = (jugador.ligas ?? []).map((item) => item.liga_id).filter((ligaId) => ligaId !== detail.liga.liga_id)
    await patchJugador(jugador.jugador_id, { ligas })
    await reloadJugadores()
    showToast({
      title: 'Jugador quitado',
      description: `${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''} ya no figura en ${detail.liga.nombre}.`.trim(),
    })
  }

  if (detail.id !== id) return <LoadingFile text="Cargando detalle de la liga..." />
  const { liga, jugadores, error } = detail
  if (error || !liga) {
    return <ErrorFile message={error || 'La liga solicitada no existe.'} backTo="/padron/ligas" backText="Volver a ligas" />
  }

  return (
    <div className="flex flex-col w-full pb-8">
      <CategoriaHeader
        icon="emoji_events"
        breadcrumb={[
          { label: 'Ligas', to: '/padron/ligas' },
          { label: liga.nombre },
        ]}
        title={liga.nombre}
        metadata={[
          { label: 'Abreviatura', value: liga.abreviatura },
          { label: 'Jugadores', value: jugadores.length },
        ]}
      />

      <div className="flex flex-col gap-4 min-w-0">
        <TabHeader
          title="Jugadores"
          description="Jugadores activos y de baja parcial registrados en la liga."
          actions={<PrimaryButton icon="person_add" onClick={openAdd}>Agregar jugador</PrimaryButton>}
        />
        {jugadores.length === 0 ? (
          <CategoriaEmptyState icon="groups" title="Sin jugadores" description="Todavía no hay jugadores registrados en esta liga." />
        ) : (
          <LigaJugadoresTable jugadores={jugadores} ligaNombre={liga.nombre} onRemove={openRemoval} />
        )}
      </div>

      <AddJugadorLigaModal
        key={`add-${modalKey}`}
        opened={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onAdded={handleAdded}
        liga={liga}
        assignedJugadorIds={jugadores.map((jugador) => jugador.jugador_id)}
      />

      <ConfirmRemoveJugadorLigaModal
        key={`remove-${modalKey}`}
        opened={removal.opened}
        onClose={() => setRemoval((current) => ({ ...current, opened: false }))}
        onConfirm={handleRemove}
        jugador={removal.jugador}
        liga={liga}
      />
    </div>
  )
}

export default LigaDetail
