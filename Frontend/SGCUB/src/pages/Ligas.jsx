import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLigas } from '../api/ligas'
import LigasListTable from '../components/ligas/LigasListTable'
import PageHeader from '../components/shared/PageHeader'
import { TEXT_BUTTON_CLASS } from '../components/shared/textButton'
import TableSearchInput from '../components/shared/TableSearchInput'
import { matchesSearch } from '../components/shared/search'

const EDIT_LEAGUES_PATH = '/configuracion?tab=deporte&seccion=ligas'

function Ligas() {
  const [carga, setCarga] = useState({ isLoading: true, error: null, ligas: [] })
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    getLigas()
      .then((ligas) => active && setCarga({ isLoading: false, error: null, ligas }))
      .catch((error) => active && setCarga({ isLoading: false, error, ligas: [] }))
    return () => { active = false }
  }, [])

  const filtered = useMemo(
    () => carga.ligas.filter((liga) => matchesSearch(search, [liga.nombre, liga.abreviatura])),
    [carga.ligas, search],
  )
  const noLeagues = !carga.isLoading && !carga.error && carga.ligas.length === 0

  return (
    <div className="w-full flex flex-col gap-5">
      <PageHeader
        breadcrumb={[{ label: 'Ligas' }]}
        title="Ligas"
        actions={(
          <Link to={EDIT_LEAGUES_PATH} className={`${TEXT_BUTTON_CLASS} text-base`}>
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">settings</span>
            Editar ligas
          </Link>
        )}
      />

      <TableSearchInput
        value={search}
        onChange={setSearch}
        placeholder="Filtrar por nombre o abreviatura..."
        label="Filtrar ligas"
        className="sm:max-w-md"
      />

      <section aria-label="Ligas" className="min-w-0">
        <LigasListTable
          ligas={filtered}
          isLoading={carga.isLoading}
          error={carga.error}
          emptyText={noLeagues ? 'Todavía no hay ligas cargadas.' : 'No hay ligas que coincidan con el filtro.'}
        />
      </section>

      {noLeagues && (
        <p className="text-base text-on-surface-variant">
          Las ligas se agregan en{' '}
          <Link to={EDIT_LEAGUES_PATH} className="font-semibold text-primary hover:underline">Configuración → Deporte</Link>.
        </p>
      )}
    </div>
  )
}

export default Ligas
