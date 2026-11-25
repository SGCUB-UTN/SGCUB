import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getJugadoresByLiga } from '../api/jugadores'
import { getLiga } from '../api/ligas'
import CategoriaEmptyState from '../components/categorias/CategoriaEmptyState'
import CategoriaHeader from '../components/categorias/CategoriaHeader'
import AddJugadorLigaModal from '../components/ligas/AddJugadorLigaModal'
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
    const jugadores = await getJugadoresByLiga(id)
    setDetail((current) => ({ ...current, jugadores }))
    showToast({
      title: 'Jugador agregado',
      description: `${jugador.socio?.nombre ?? ''} ${jugador.socio?.apellido ?? ''} quedó registrado en ${detail.liga.nombre}.`.trim(),
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
          <LigaJugadoresTable jugadores={jugadores} ligaNombre={liga.nombre} />
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
    </div>
  )
}

export default LigaDetail
