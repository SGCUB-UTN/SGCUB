import { Link, useSearchParams } from 'react-router-dom'
import CategoriasTable from '../components/categorias/CategoriasTable'
import PageHeader from '../components/shared/PageHeader'
import { TEXT_BUTTON_CLASS } from '../components/shared/textButton'
import useCategorias from '../hooks/useCategorias'

const DEFAULT_GENDER = 'M'

function Categorias() {
  const { categorias, isLoading, error, reloadCategorias } = useCategorias()
  const [searchParams, setSearchParams] = useSearchParams()
  const genero = searchParams.get('genero') ?? DEFAULT_GENDER
  const search = searchParams.get('buscar') ?? ''

  const updateParam = (key, value, fallback = '') => setSearchParams((current) => {
    const next = new URLSearchParams(current)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    return next
  }, { replace: true })

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
        <CategoriasTable
          data={categorias}
          isLoading={isLoading}
          error={error}
          onRetry={reloadCategorias}
          genero={genero}
          onGeneroChange={(value) => updateParam('genero', value, DEFAULT_GENDER)}
          search={search}
          onSearchChange={(value) => updateParam('buscar', value)}
        />
      </section>
    </div>
  )
}

export default Categorias
