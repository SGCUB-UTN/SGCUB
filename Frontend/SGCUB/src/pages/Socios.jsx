import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import SociosTable from '../components/socios/SociosTable'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import useSocio from '../hooks/useSocio'

function Padron() {
  const { socios, isLoading, error } = useSocio({ onlyMembers: true })
  const navigate = useNavigate()

  const totales = useMemo(() => {
    const activos = socios.filter((socio) => {
      const estado = (socio.estado_administrativo_nombre ?? '').toLowerCase()
      return estado.includes('activo') && !estado.includes('inactivo')
    }).length
    const formato = (valor) => valor.toLocaleString('es-AR')
    return {
      total: formato(socios.length),
      activos: formato(activos),
      inactivos: formato(socios.length - activos),
    }
  }, [socios])

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
          <StatCard label="Total Padrón" value={totales.total} icon="group" tone="neutral" />
          <StatCard label="Activos" value={totales.activos} icon="how_to_reg" tone="positive" />
          <StatCard label="De baja" value={totales.inactivos} icon="person_off" tone="muted" />
        </div>

        <section aria-label="Socios">
          <SociosTable
            data={socios}
            isLoading={isLoading}
            error={error}
            onEdit={(socio) => navigate(`/padron/socios/${socio.socio_id}/editar`)}
          />
        </section>
      </div>
    </>
  )
}

export default Padron
