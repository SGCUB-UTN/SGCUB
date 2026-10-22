import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'

function CategoriaDocenteTable({ docenteCategorias, onRemove }) {
  const navigate = useNavigate()

  return (
    <DataTable
      className="border border-outline-variant/30 rounded-lg"
      headers={(
        <>
          <th className="py-3 px-4 pl-6 w-28 whitespace-nowrap" scope="col">N° Legajo</th>
          <th className="py-3 px-4" scope="col">Nombre y Apellido</th>
          <th className="py-3 px-4" scope="col">Cargo</th>
          <th className="py-3 px-4 pr-6 text-right" scope="col">Acciones</th>
        </>
      )}
    >
      {docenteCategorias.map((docenteCategoria) => {
        const docente = docenteCategoria.docente
        const persona = docente?.persona_detalle
        const fullName = persona ? `${persona.nombre} ${persona.apellido}` : 'Docente sin nombre'
        return (
          <tr
            key={docenteCategoria.docente_categoria_id}
            onClick={() => navigate(`/padron/docentes/${docente.docente_id}`)}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer"
          >
            <td className="py-3 px-4 pl-6 font-bold text-primary text-base">
              {docente?.legajo ? `#${docente.legajo}` : '—'}
            </td>
            <td className="py-3 px-4 font-medium text-base">{fullName}</td>
            <td className="py-3 px-4">
              {docenteCategoria.cargo?.nombre ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold bg-primary-fixed/30 text-primary">
                  {docenteCategoria.cargo.nombre}
                </span>
              ) : (
                <span className="text-on-surface-variant">Sin cargo</span>
              )}
            </td>
            <td className="py-3 px-4 pr-6">
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="inline-flex items-center justify-center p-2 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container/60 transition-colors cursor-pointer"
                  onClick={(event) => {
                    event.stopPropagation()
                    onRemove(docenteCategoria)
                  }}
                  title="Quitar de la categoría"
                  aria-label={`Quitar a ${fullName} de la categoría`}
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person_remove</span>
                </button>
              </div>
            </td>
          </tr>
        )
      })}
    </DataTable>
  )
}

export default CategoriaDocenteTable
