import { useMemo, useState } from 'react'
import CategoriasTable, { ALL_CATEGORIES } from '../components/categorias/CategoriasTable'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import useCategorias from '../hooks/useCategorias'

const format = (value) => value.toLocaleString('es-AR')

function Categorias() {
  const { categorias, isLoading, error } = useCategorias()
  const [genero, setGenero] = useState('M')

  const totals = useMemo(() => ({
    total: format(categorias.length),
    male: format(categorias.filter((categoria) => categoria.genero === 'M').length),
    female: format(categorias.filter((categoria) => categoria.genero === 'F').length),
  }), [categorias])

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Categorías' }]}
        title="Categorías"
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard label="Total" value={totals.total} icon="sports_soccer" tone="neutral" onClick={() => setGenero(ALL_CATEGORIES)} isSelected={genero === ALL_CATEGORIES} />
        <StatCard label="Masculinas" value={totals.male} icon="man" tone="neutral" onClick={() => setGenero('M')} isSelected={genero === 'M'} />
        <StatCard label="Femeninas" value={totals.female} icon="woman" tone="neutral" onClick={() => setGenero('F')} isSelected={genero === 'F'} />
      </div>

      <section aria-label="Categorías">
        <CategoriasTable data={categorias} isLoading={isLoading} error={error} genero={genero} onGeneroChange={setGenero} />
      </section>
    </div>
  )
}

export default Categorias
