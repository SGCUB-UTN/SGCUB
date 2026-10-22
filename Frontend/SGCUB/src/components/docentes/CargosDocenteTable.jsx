import DataTable from '../shared/DataTable'
import { etiquetaCategoria } from './docentesUtils'

function EditButton({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex items-center justify-center p-2 rounded-lg text-primary hover:bg-primary-fixed/30 transition-colors cursor-pointer"
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">edit</span>
    </button>
  )
}

function RemoveButton({ label, disabledReason, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(disabledReason)}
      title={disabledReason ?? label}
      aria-label={label}
      className="inline-flex items-center justify-center p-2 rounded-lg text-error hover:bg-error-container/60 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">delete</span>
    </button>
  )
}

// Cargos of a docente with the categorias assigned to each one.
// `removeDisabledReason` disables the remove button and is shown as its tooltip.
function CargosDocenteTable({ asignaciones, editable = false, removeDisabledReason, onEdit, onRemove }) {
  return (
    <DataTable
      className="border border-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm"
      headers={(
        <>
          <th className="py-3 px-4" scope="col">Cargo</th>
          <th className="py-3 px-4" scope="col">Categorías</th>
          {editable && <th className="py-3 px-4 text-right" scope="col">Acciones</th>}
        </>
      )}
    >
      {asignaciones.map((asignacion) => {
        const cargoName = asignacion.cargo_nombre ?? ''
        return (
          <tr key={asignacion.cargo} className="align-top hover:bg-surface-container-low transition-colors">
            <td className="py-3 px-4 font-semibold text-on-surface whitespace-nowrap">{asignacion.cargo_nombre ?? '—'}</td>
            <td className="py-3 px-4">
              <ul className="flex flex-wrap gap-1.5">
                {asignacion.categorias.map((categoria) => (
                  <li
                    key={categoria.categoria_id}
                    className="px-2.5 py-0.5 rounded-md bg-surface-container-high text-on-surface text-sm font-medium"
                  >
                    {etiquetaCategoria(categoria)}
                  </li>
                ))}
              </ul>
            </td>
            {editable && (
              <td className="py-3 px-4">
                <div className="flex items-center justify-end gap-1">
                  <EditButton label={`Editar cargo ${cargoName}`.trim()} onClick={() => onEdit(asignacion)} />
                  <RemoveButton
                    label={`Eliminar cargo ${cargoName}`.trim()}
                    disabledReason={removeDisabledReason}
                    onClick={() => onRemove(asignacion)}
                  />
                </div>
              </td>
            )}
          </tr>
        )
      })}
    </DataTable>
  )
}

export default CargosDocenteTable
