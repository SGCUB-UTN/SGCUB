import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JugadoresTable from '../components/jugadores/JugadoresTable'
import useCategorias from '../hooks/useCategorias'
import useJugadores from '../hooks/useJugadores'
import { LIST_VIEW } from '../api/listView'
import PageHeader from '../components/shared/PageHeader'
import { PrimaryButton } from '../components/personas/tabs/parts'
import StatCard from '../components/shared/StatCard'

function Jugadores() {
  const navigate = useNavigate()
  const { jugadores, isLoading, error, recargarJugadores } = useJugadores({ view: LIST_VIEW })
  const { categorias } = useCategorias()
  const [status, setStatus] = useState('activo')
  const [exportSlot, setExportSlot] = useState(null)
  const totales = useMemo(() => {
    const sportStatusOf = (jugador) => (jugador.estado?.nombre ?? '').toLowerCase()
    const isDeactivated = (jugador) => {
      const estado = sportStatusOf(jugador)
      return estado.includes('baja') || estado.includes('inactivo')
    }
    const activos = jugadores.filter((jugador) => sportStatusOf(jugador).includes('activo') && !isDeactivated(jugador)).length
    const bajas = jugadores.filter((jugador) => jugador.tipo_baja === 'completa').length
    return {
      total: jugadores.length.toLocaleString('es-AR'),
      activos: activos.toLocaleString('es-AR'),
      bajas: bajas.toLocaleString('es-AR'),
      bajasParciales: jugadores.filter((jugador) => jugador.tipo_baja === 'parcial').length.toLocaleString('es-AR'),
    }
  }, [jugadores])

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Personas' }, { label: 'Jugadores' }]}
        title="Jugadores"
        actions={(
          <div className="flex flex-wrap items-start gap-2.5">
            <PrimaryButton icon="person_add" onClick={() => navigate('/padron/jugadores/nuevo')}>Nuevo jugador</PrimaryButton>
            <div ref={setExportSlot} className="contents" />
          </div>
        )}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-10">
        <StatCard label="Total" value={error ? '—' : totales.total} isLoading={isLoading} icon="sports_soccer" tone="neutral" onClick={() => setStatus('todos')} isSelected={status === 'todos'} />
        <StatCard label="Activos" value={error ? '—' : totales.activos} isLoading={isLoading} icon="how_to_reg" tone="positive" onClick={() => setStatus('activo')} isSelected={status === 'activo'} />
        <StatCard label="Baja parcial" value={error ? '—' : totales.bajasParciales} isLoading={isLoading} icon="pause_circle" tone="info" onClick={() => setStatus('baja_parcial')} isSelected={status === 'baja_parcial'} />
        <StatCard label="De Baja" value={error ? '—' : totales.bajas} isLoading={isLoading} icon="person_off" tone="muted" onClick={() => setStatus('baja')} isSelected={status === 'baja'} />
      </div>
      <section aria-label="Jugadores">
        <JugadoresTable
          data={jugadores}
          categorias={categorias}
          isLoading={isLoading}
          error={error}
          status={status}
          onStatusChange={setStatus}
          onRetry={recargarJugadores}
          exportSlot={exportSlot}
        />
      </section>
    </div>
  )
}

export default Jugadores
