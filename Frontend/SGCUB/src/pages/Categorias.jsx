import { useState } from 'react'
import CategoriasTable from '../components/categorias/CategoriasTable'
import PageHeader from '../components/shared/PageHeader'
import useCategorias from '../hooks/useCategorias'

function Categorias() {
  const { categorias, isLoading, error } = useCategorias()
  const [genero, setGenero] = useState('M')

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Categorías' }]}
        title="Categorías"
      />

      <section aria-label="Listado de categorías">
        <CategoriasTable data={categorias} isLoading={isLoading} error={error} genero={genero} onGeneroChange={setGenero} />
      </section>
    </div>
  )
}

export default Categorias
