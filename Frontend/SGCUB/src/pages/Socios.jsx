import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SociosTable from '../components/socios/SociosTable'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import useSocio from '../hooks/useSocio'
import { LIST_VIEW } from '../api/listView'

function Padron() {
  const { socios, isLoading, error, recargarSocios } = useSocio({ onlyMembers: true, view: LIST_VIEW })
  const navigate = useNavigate()
  const [status, setStatus] = useState('activo')

  const sociosActivos = useMemo(() => socios.filter((socio) => {
    const estado = (socio.estado_administrativo_nombre ?? '').toLowerCase()
    return estado.includes('activo') && !estado.includes('inactivo')
  }), [socios])

  const totales = useMemo(() => {
    const formato = (valor) => valor.toLocaleString('es-AR')
    return {
      total: formato(socios.length),
      activos: formato(sociosActivos.length),
      inactivos: formato(socios.length - sociosActivos.length),
      exJugadores: formato(socios.filter((socio) => socio.es_ex_jugador).length),
    }
  }, [socios, sociosActivos])
  return (
    <>
      <div className="w-full flex flex-col gap-5">
        <PageHeader
          breadcrumb={[{ label: 'Personas' }, { label: 'Socios' }]}
          title="Socios"
          actions={(
            <button
              type="button"
              onClick={() => navigate('/padron/socios/nuevo')}
              className="inline-flex items-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded shadow-sm font-label-lg text-base font-medium transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_add</span>
              <span className="text-xl"> Nuevo socio</span>
            </button>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-10">
          <StatCard label="Total Padrón" value={error ? '—' : totales.total} isLoading={isLoading} icon="group" tone="neutral" onClick={() => setStatus('todos')} isSelected={status === 'todos'} />
          <StatCard label="Activos" value={error ? '—' : totales.activos} isLoading={isLoading} icon="how_to_reg" tone="positive" onClick={() => setStatus('activo')} isSelected={status === 'activo'} />
          <StatCard label="Ex Jugadores" value={error ? '—' : totales.exJugadores} isLoading={isLoading} icon="sports_soccer" tone="info" onClick={() => setStatus('ex_jugador')} isSelected={status === 'ex_jugador'} />
          <StatCard label="De Baja" value={error ? '—' : totales.inactivos} isLoading={isLoading} icon="person_off" tone="muted" onClick={() => setStatus('baja')} isSelected={status === 'baja'} />
        </div>

        <section aria-label="Socios">
          <SociosTable
            data={socios}
            isLoading={isLoading}
            error={error}
            status={status}
            onStatusChange={setStatus}
            onRetry={recargarSocios}
            onEdit={(socio) => navigate(`/padron/socios/${socio.socio_id}/editar`)}
          />
        </section>
      </div>
    </>
  )
}

export default Padron
