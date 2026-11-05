import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import useOrdenTabla from '../../hooks/useOrdenTabla'
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

function CategoriasGeneroTable({ categorias, isLoading, error, showGenero = false }) {
  const navigate = useNavigate()
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(categorias, SORT_VALUES, INITIAL_SORT)

  const [descargandoCometId, setDescargandoCometId] = useState(null)
  const [descargandoZipId, setDescargandoZipId] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const handleDownloadPlanillas = async (e, categoria) => {
    e.stopPropagation()
    setDescargandoCometId(categoria.categoria_id)
    setFeedback(null)
    try {
      const res = await downloadPlanillasCategoria(categoria.categoria_id, categoria.nombre)
      let msg = `Planillas COMET de ${categoria.nombre} descargadas.`
      if (res?.totalExcluidos && Number(res.totalExcluidos) > 0) {
        msg += ` (${res.totalExcluidos} jugador${Number(res.totalExcluidos) > 1 ? 'es' : ''} omitido${Number(res.totalExcluidos) > 1 ? 's' : ''} por no poseer apto físico vigente).`
      }
      setFeedback({ tone: 'success', message: msg })
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudieron descargar las planillas COMET de la categoría.'
      setFeedback({ tone: 'error', message: msg })
    } finally {
      setDescargandoCometId(null)
    }
  }

  const handleDownloadZip = async (e, categoria) => {
    e.stopPropagation()
    setDescargandoZipId(categoria.categoria_id)
    setFeedback(null)
    try {
      await downloadCategoriaDocumentosZip(categoria.categoria_id, categoria.nombre)
      setFeedback({ tone: 'success', message: `Documentación de ${categoria.nombre} descargada en ZIP.` })
    } catch (err) {
      const msg = err.response?.data?.detail || 'No se pudo descargar la documentación de la categoría.'
      setFeedback({ tone: 'error', message: msg })
    } finally {
      setDescargandoZipId(null)
    }
  }

  return (
    <div className="min-w-0">
      {feedback && (
        <div
          className={`mb-3 px-4 py-2.5 rounded-lg flex items-center justify-between gap-2.5 text-sm font-medium ${
            feedback.tone === 'success'
              ? 'bg-[#e6f4ea] text-[#0d652d] border border-[#ceead6]'
              : 'bg-error-container/40 text-on-error-container border border-error/30'
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">
              {feedback.tone === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-0.5 rounded hover:bg-black/10 transition-colors cursor-pointer"
            aria-label="Cerrar aviso"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <DataTable
        headerCase="title"
        tableClassName="table-fixed min-w-[680px]"
        headers={(
          <>
            <SortableHeader className="py-3 px-4 w-40" etiqueta="Edad" columna="maxAge" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 pl-6" etiqueta="Nombre" columna="name" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-32 text-center" etiqueta="Jugadores" columna="jugadores" orden={sort} onOrdenar={sortBy} />
            <SortableHeader className="py-3 px-4 w-32 text-center" etiqueta="Docentes" columna="docentes" orden={sort} onOrdenar={sortBy} />
            <th className="py-3 px-4 w-32 text-center font-medium text-on-surface-variant text-sm">Acciones</th>
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
          emptyText="No hay categorías que coincidan con el filtro."
        />

        {!isLoading && sorted.map((categoria) => (
          <tr
            key={categoria.categoria_id}
            onClick={() => navigate(`/padron/categorias/${categoria.categoria_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
          >
            <td className="py-3 px-4 text-on-surface-variant">{formatRangoEdad(categoria)}</td>
            <td className="py-3 px-4 pl-6 font-medium text-on-surface text-base">
              {categoria.nombre}
              {showGenero && GENERO_TAB_TONES[categoria.genero] && (
                <span className={`ml-1.5 font-semibold ${GENERO_TAB_TONES[categoria.genero].text}`}>({categoria.genero})</span>
              )}
            </td>
            <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{categoria.cantidad_jugadores ?? '—'}</td>
            <td className="py-3 px-4 text-center font-bold text-on-surface-variant">{categoria.cantidad_docentes ?? '—'}</td>
            <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  title="Descargar planillas COMET (PDF)"
                  onClick={(e) => handleDownloadPlanillas(e, categoria)}
                  disabled={descargandoCometId === categoria.categoria_id}
                  className="p-1.5 rounded text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 cursor-pointer"
                  aria-label={`Descargar planillas COMET de ${categoria.nombre}`}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {descargandoCometId === categoria.categoria_id ? 'progress_activity' : 'description'}
                  </span>
                </button>
                <button
                  type="button"
                  title="Descargar documentación de la categoría (ZIP)"
                  onClick={(e) => handleDownloadZip(e, categoria)}
                  disabled={descargandoZipId === categoria.categoria_id}
                  className="p-1.5 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50 cursor-pointer"
                  aria-label={`Descargar documentación de ${categoria.nombre}`}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                    {descargandoZipId === categoria.categoria_id ? 'progress_activity' : 'folder_zip'}
                  </span>
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </div>
  )
}

export default CategoriasGeneroTable
