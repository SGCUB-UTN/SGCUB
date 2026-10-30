import { useMemo, useState } from 'react'
import CategoriaFormModal from '../components/categorias/CategoriaFormModal'
import CategoriasTable, { ALL_CATEGORIES } from '../components/categorias/CategoriasTable'
import PageHeader from '../components/shared/PageHeader'
import StatCard from '../components/shared/StatCard'
import useCategorias from '../hooks/useCategorias'

const format = (value) => value.toLocaleString('es-AR')

function Categorias() {
  const { categorias, isLoading, error, createCategoria } = useCategorias()

  const [modalKey, setModalKey] = useState(0)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [genero, setGenero] = useState('M')

  const totals = useMemo(() => ({
    total: format(categorias.length),
    male: format(categorias.filter((categoria) => categoria.genero === 'M').length),
    female: format(categorias.filter((categoria) => categoria.genero === 'F').length),
  }), [categorias])

  const openForm = () => {
    setModalKey((key) => key + 1)
    setIsFormOpen(true)
  }

  const handleSubmitForm = async (data) => {
    await createCategoria(data)
    setNotice(`Se creó la categoría ${data.nombre}.`)
  }

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Categorías' }]}
        title="Categorías"
        actions={(
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-2 bg-primary text-on-primary hover:bg-primary/90 px-4 py-2 rounded shadow-sm font-label-lg text-base font-medium transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            <span className="text-xl"> Nueva categoría</span>
          </button>
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard label="Total" value={totals.total} icon="sports_soccer" tone="neutral" onClick={() => setGenero(ALL_CATEGORIES)} isSelected={genero === ALL_CATEGORIES} />
        <StatCard label="Masculinas" value={totals.male} icon="man" tone="neutral" onClick={() => setGenero('M')} isSelected={genero === 'M'} />
        <StatCard label="Femeninas" value={totals.female} icon="woman" tone="neutral" onClick={() => setGenero('F')} isSelected={genero === 'F'} />
      </div>

      {notice && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-lg flex items-center gap-2.5" role="status">
          <span className="material-symbols-outlined text-emerald-700" aria-hidden="true">check_circle</span>
          <p className="text-base font-medium flex-1">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="p-1 rounded text-emerald-700 hover:bg-emerald-100 transition-colors cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      <section aria-label="Categorías">
        <CategoriasTable data={categorias} isLoading={isLoading} error={error} genero={genero} onGeneroChange={setGenero} />
      </section>

      <CategoriaFormModal
        key={`form-${modalKey}`}
        opened={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSubmit={handleSubmitForm}
      />
    </div>
  )
}

export default Categorias
