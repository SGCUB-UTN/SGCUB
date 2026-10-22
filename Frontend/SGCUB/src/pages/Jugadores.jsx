import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import JugadoresTable from '../components/jugadores/JugadoresTable'
import useCategorias from '../hooks/useCategorias'
import useJugadores from '../hooks/useJugadores'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'

function Jugadores() {
  const navigate = useNavigate()
  const { jugadores, isLoading, error } = useJugadores()
  const { categorias } = useCategorias()
  const [status, setStatus] = useState('activo')
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
      bajasTemporales: jugadores.filter((jugador) => jugador.tipo_baja === 'parcial').length.toLocaleString('es-AR'),
    }
  }, [jugadores])

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Personas' }, { label: 'Jugadores' }]}
        title="Jugadores"
        actions={(
          <button
            type="button"
            onClick={() => navigate('/padron/jugadores/nuevo')}
            className="inline-flex items-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded shadow-sm font-label-lg text-base font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_add</span>
            <span className="text-xl"> Nuevo jugador</span>
          </button>
        )}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-10">
        <StatCard label="Total" value={totales.total} icon="sports_soccer" tone="neutral" onClick={() => setStatus('todos')} isSelected={status === 'todos'} />
        <StatCard label="Activos" value={totales.activos} icon="how_to_reg" tone="positive" onClick={() => setStatus('activo')} isSelected={status === 'activo'} />
        <StatCard label="De Baja" value={totales.bajas} icon="person_off" tone="muted" onClick={() => setStatus('baja')} isSelected={status === 'baja'} />
        <StatCard label="Baja temporal" value={totales.bajasTemporales} icon="pause_circle" tone="warning" onClick={() => setStatus('baja_temporal')} isSelected={status === 'baja_temporal'} />
      </div>
      <section aria-label="Jugadores">
        <JugadoresTable
          data={jugadores}
          categorias={categorias}
          isLoading={isLoading}
          error={error}
          status={status}
          onStatusChange={setStatus}
          onEdit={(jugador) => navigate(`/padron/jugadores/${jugador.jugador_id}/editar`)}
        />
      </section>
    </div>
  )
}

export default Jugadores
