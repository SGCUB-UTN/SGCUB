import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LIST_VIEW } from '../api/listView'
import DocentesTable from '../components/docentes/DocentesTable'
import { categoriasDeAsignaciones, esActivo } from '../components/docentes/docentesUtils'
import PageHeader from '../components/shared/PageHeader'
import { PrimaryButton } from '../components/personas/tabs/parts'
import StatCard from '../components/shared/StatCard'
import useCategorias from '../hooks/useCategorias'
import useDocentes from '../hooks/useDocentes'

function Docentes() {
  const navigate = useNavigate()
  const { docentes, isLoading, error, recargarDocentes } = useDocentes({ view: LIST_VIEW })
  const { categorias } = useCategorias()
  const [status, setStatus] = useState('activo')
  const [exportSlot, setExportSlot] = useState(null)

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
        title="Docentes"
        actions={(
          <div className="flex flex-wrap items-start gap-2.5">
            <PrimaryButton icon="person_add" onClick={() => navigate('/padron/docentes/nuevo')}>Nuevo docente</PrimaryButton>
            <div ref={setExportSlot} className="contents" />
          </div>
        )}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 xl:gap-10">
        <StatCard label="Total" value={error ? '—' : totales.total} isLoading={isLoading} icon="school" tone="neutral" onClick={() => setStatus('todos')} isSelected={status === 'todos'} />
        <StatCard label="Activos" value={error ? '—' : totales.activos} isLoading={isLoading} icon="how_to_reg" tone="positive" onClick={() => setStatus('activo')} isSelected={status === 'activo'} />
        <StatCard label="De Baja" value={error ? '—' : totales.bajas} isLoading={isLoading} icon="person_off" tone="muted" onClick={() => setStatus('baja')} isSelected={status === 'baja'} />
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
          onRetry={recargarDocentes}
          exportSlot={exportSlot}
        />
      </section>
    </div>
  )
}

export default Docentes
