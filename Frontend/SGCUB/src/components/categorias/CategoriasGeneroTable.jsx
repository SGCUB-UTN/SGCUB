import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import { ROW_LINK_CLASS, stopRowClick } from '../shared/rowLink'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import useToast from '../../hooks/useToast'
import { formatRangoEdad, GENERO_TAB_TONES } from './categoriaFormat'
import { downloadPlanillasCategoria } from '../../api/comet'
import { downloadCategoriaDocumentosZip } from '../../api/documentacion'

const SORT_VALUES = {
  name: (categoria) => categoria.nombre,
  maxAge: (categoria) => categoria.edad_maxima,
  jugadores: (categoria) => categoria.cantidad_jugadores,
  docentes: (categoria) => categoria.cantidad_docentes,
}
const INITIAL_SORT = { columna: 'maxAge', direccion: 'desc' }
const COLUMN_COUNT = 5
const NO_PLAYERS_HINT = 'La categoría no tiene jugadores'
const DOWNLOAD_BUTTON_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-outline-variant/40 text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent'

const omittedText = (total) => {
  const count = Number(total)
  if (!count) return ''
  return `${count} jugador${count > 1 ? 'es' : ''} sin apto físico vigente ${count > 1 ? 'quedaron' : 'quedó'} afuera.`
}

function CategoriasGeneroTable({ categorias, isLoading, error, showGenero = false, emptyText, onRetry, onClearFilters }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(categorias, SORT_VALUES, INITIAL_SORT)

  const [descargandoCometId, setDescargandoCometId] = useState(null)
  const [descargandoZipId, setDescargandoZipId] = useState(null)

  const handleDownloadPlanillas = async (e, categoria) => {
    e.stopPropagation()
    setDescargandoCometId(categoria.categoria_id)
    try {
      const res = await downloadPlanillasCategoria(categoria.categoria_id, categoria.nombre)
      const omitted = omittedText(res?.totalExcluidos)
      showToast({
        tone: omitted ? 'info' : 'success',
        title: `Planillas COMET de ${categoria.nombre} descargadas`,
        description: omitted || 'Se incluyeron todos los jugadores.',
      })
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'No se pudieron descargar las planillas COMET',
        description: err.response?.data?.detail || 'Probá de nuevo en unos minutos.',
      })
    } finally {
      setDescargandoCometId(null)
    }
  }

  const handleDownloadZip = async (e, categoria) => {
    e.stopPropagation()
    setDescargandoZipId(categoria.categoria_id)
    try {
      await downloadCategoriaDocumentosZip(categoria.categoria_id, categoria.nombre)
      showToast({ title: `Documentación de ${categoria.nombre} descargada`, description: 'Se descargó en un archivo ZIP.' })
    } catch (err) {
      showToast({
        tone: 'error',
        title: 'No se pudo descargar la documentación',
        description: err.response?.data?.detail || 'Probá de nuevo en unos minutos.',
      })
    } finally {
      setDescargandoZipId(null)
    }
  }

  return (
    <div className="min-w-0">
      <DataTable
        headerCase="title"
        tableClassName="table-fixed min-w-[860px]"
        headers={(
          <>
            <SortableHeader className="py-3 px-4 pl-6" etiqueta="Nombre" columna="name" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-40" etiqueta="Edad" columna="maxAge" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-32 text-center" etiqueta="Jugadores" columna="jugadores" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-32 text-center" etiqueta="Docentes" columna="docentes" orden={sort} onOrdenar={sortBy} />
            <th className="py-3 px-4 w-80 text-center font-medium text-on-surface-variant text-sm" scope="col">Descargar</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={sorted.length === 0}
          error={error}
          loadingText="Cargando categorías..."
          errorText="No se pudieron cargar las categorías."
          emptyText={emptyText}
          onRetry={onRetry}
          onClearFilters={onClearFilters}
        />

        {!isLoading && !error && sorted.map((categoria) => {
          const sinJugadores = !categoria.cantidad_jugadores
          return (
            <tr
              key={categoria.categoria_id}
              onClick={() => navigate(`/padron/categorias/${categoria.categoria_id}`)}
              className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
            >
              <td className="py-3 px-4 pl-6 font-medium text-on-surface text-base">
                <Link
                  to={`/padron/categorias/${categoria.categoria_id}`}
                  onClick={stopRowClick}
                  className={ROW_LINK_CLASS}
                >
                  {categoria.nombre}
                </Link>
                {showGenero && GENERO_TAB_TONES[categoria.genero] && (
                  <span className={`ml-1.5 font-semibold ${GENERO_TAB_TONES[categoria.genero].text}`}>({categoria.genero})</span>
                )}
              </td>
              <td className="py-3 px-4 text-on-surface-variant">{formatRangoEdad(categoria)}</td>
              <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{categoria.cantidad_jugadores ?? '—'}</td>
              <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{categoria.cantidad_docentes ?? '—'}</td>
              <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    title={sinJugadores ? NO_PLAYERS_HINT : 'Descargar planillas COMET (PDF)'}
                    onClick={(e) => handleDownloadPlanillas(e, categoria)}
                    disabled={sinJugadores || descargandoCometId === categoria.categoria_id}
                    className={DOWNLOAD_BUTTON_CLASS}
                    aria-label={`Descargar planillas COMET de ${categoria.nombre}`}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {descargandoCometId === categoria.categoria_id ? 'progress_activity' : 'description'}
                    </span>
                    Planillas COMET
                  </button>
                  <button
                    type="button"
                    title={sinJugadores ? NO_PLAYERS_HINT : 'Descargar documentación de la categoría (ZIP)'}
                    onClick={(e) => handleDownloadZip(e, categoria)}
                    disabled={sinJugadores || descargandoZipId === categoria.categoria_id}
                    className={DOWNLOAD_BUTTON_CLASS}
                    aria-label={`Descargar documentación de ${categoria.nombre} en ZIP`}
                  >
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                      {descargandoZipId === categoria.categoria_id ? 'progress_activity' : 'folder_zip'}
                    </span>
                    Documentación
                  </button>
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>
    </div>
  )
}

export default CategoriasGeneroTable
