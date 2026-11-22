import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LIST_VIEW } from '../api/listView'
import DocentesTable from '../components/docentes/DocentesTable'
import { categoriasDeAsignaciones, esActivo } from '../components/docentes/docentesUtils'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import useCategorias from '../hooks/useCategorias'
import useDocentes from '../hooks/useDocentes'

function Docentes() {
  const navigate = useNavigate()
  const { docentes, isLoading, error } = useDocentes({ view: LIST_VIEW })
  const { categorias } = useCategorias()
  const [status, setStatus] = useState('activo')

  const categoriasPorDocente = useMemo(
    () => Object.fromEntries(docentes.map((docente) => [docente.docente_id, categoriasDeAsignaciones(docente.asignaciones)])),
    [docentes],
  )

  const totales = useMemo(() => {
    const activos = docentes.filter(esActivo).length
    return {
      total: docentes.length.toLocaleString('es-AR'),
      activos: activos.toLocaleString('es-AR'),
      bajas: (docentes.length - activos).toLocaleString('es-AR'),
    }
  }, [docentes])

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Personas' }, { label: 'Docentes' }]}
        title="Docentes y Cuerpo Técnico"
        actions={(
          <button
            type="button"
            onClick={() => navigate('/padron/docentes/nuevo')}
            className="inline-flex items-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded shadow-sm font-label-lg text-base font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">person_add</span>
            <span className="text-xl"> Nuevo docente</span>
          </button>
        )}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-10">
        <StatCard label="Total" value={totales.total} icon="school" tone="neutral" onClick={() => setStatus('todos')} isSelected={status === 'todos'} />
        <StatCard label="Activos" value={totales.activos} icon="how_to_reg" tone="positive" onClick={() => setStatus('activo')} isSelected={status === 'activo'} />
        <StatCard label="De Baja" value={totales.bajas} icon="person_off" tone="muted" onClick={() => setStatus('baja')} isSelected={status === 'baja'} />
      </div>
      <section aria-label="Docentes">
        <DocentesTable
          data={docentes}
          categorias={categorias}
          categoriasPorDocente={categoriasPorDocente}
          isLoading={isLoading}
          error={error}
          status={status}
          onStatusChange={setStatus}
        />
      </section>
    </div>
  )
}

export default Docentes
