import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/conf'
import DocentesTable from '../components/docentes/DocentesTable'
import { esActivo } from '../components/docentes/docentesUtils'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import useCategorias from '../hooks/useCategorias'
import useDocentes from '../hooks/useDocentes'

function Docentes() {
  const navigate = useNavigate()
  const { docentes, isLoading, error } = useDocentes()
  const { categorias } = useCategorias()
  const [categoriasPorDocente, setCategoriasPorDocente] = useState({})
  const [status, setStatus] = useState('activo')

  useEffect(() => {
    let cancelado = false
    api.get('padron/docente-categoria/')
      .then((response) => {
        if (cancelado) return
        const agrupadas = {}
        ;(response.data ?? []).forEach(({ docente, categoria, cargo }) => {
          if (!docente || !categoria) return
          agrupadas[docente.docente_id] = [...(agrupadas[docente.docente_id] ?? []), { ...categoria, cargo }]
        })
        setCategoriasPorDocente(agrupadas)
      })
      .catch(() => {
        if (!cancelado) setCategoriasPorDocente({})
      })
    return () => {
      cancelado = true
    }
  }, [])

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
