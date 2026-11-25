import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { getJugadoresByLiga } from '../api/jugadores'
import { getLiga } from '../api/ligas'
import CategoriaEmptyState from '../components/categorias/CategoriaEmptyState'
import CategoriaHeader from '../components/categorias/CategoriaHeader'
import LigaJugadoresTable from '../components/ligas/LigaJugadoresTable'
import { LoadingFile, ErrorFile } from '../components/personas/FileStatus'
import { getErrorMessage } from '../components/personas/format'
import { TabHeader } from '../components/personas/tabs/parts'

function LigaDetail() {
  const { id } = useParams()
  const [detail, setDetail] = useState({ id: null, liga: null, jugadores: [], error: null })

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
        <TabHeader title="Jugadores" description="Jugadores activos y de baja parcial registrados en la liga." />
        {jugadores.length === 0 ? (
          <CategoriaEmptyState icon="groups" title="Sin jugadores" description="Todavía no hay jugadores registrados en esta liga." />
        ) : (
          <LigaJugadoresTable jugadores={jugadores} ligaNombre={liga.nombre} />
        )}
      </div>
    </div>
  )
}

export default LigaDetail
