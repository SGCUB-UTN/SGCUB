import { useState } from 'react'
import { Link } from 'react-router-dom'
import CategoriasTable from '../components/categorias/CategoriasTable'
import PageHeader from '../components/shared/PageHeader'
import { TEXT_BUTTON_CLASS } from '../components/shared/textButton'
import useCategorias from '../hooks/useCategorias'

function Categorias() {
  const { categorias, isLoading, error } = useCategorias()
  const [genero, setGenero] = useState('M')

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Categorías' }]}
        title="Categorías"
        actions={(
          <Link to="/configuracion?tab=deporte" className={`${TEXT_BUTTON_CLASS} text-base`}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">settings</span>
            Editar categorías
          </Link>
        )}
      />

      <section aria-label="Listado de categorías">
        <CategoriasTable data={categorias} isLoading={isLoading} error={error} genero={genero} onGeneroChange={setGenero} />
      </section>
    </div>
  )
}

export default Categorias
