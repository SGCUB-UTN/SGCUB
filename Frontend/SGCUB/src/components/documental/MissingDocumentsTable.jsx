import DataTable from '../shared/DataTable'
import SectionHeading from '../shared/SectionHeading'
import { INSET_PADDING_X_CLASS } from '../shared/flushTable'
import DocumentStatusBadge from './DocumentStatusBadge'

const HEADER_CLASS = 'py-3 px-4'
const compareText = new Intl.Collator('es', { sensitivity: 'base' }).compare

export default function MissingDocumentsTable({ tipos, onUpload, className = '' }) {
  const sortedTipos = [...tipos].sort((a, b) => compareText(a.nombre, b.nombre))
  return (
    <section aria-labelledby="documentos-faltantes-title" className={`min-w-0 overflow-hidden rounded-xl border border-error/30 bg-surface-container-lowest ${className}`}>
      <SectionHeading
        id="documentos-faltantes-title"
        as="h3"
        icon="assignment_late"
        title={`Documentación faltante (${tipos.length})`}
        className={`${INSET_PADDING_X_CLASS} border-b`}
      />
      <DataTable
        headers={(
          <>
            <th className={`${HEADER_CLASS} pl-6`} scope="col">Documento</th>
            <th className={HEADER_CLASS} scope="col">Estado</th>
            <th className={`${HEADER_CLASS} pr-6 text-right`} scope="col">Acciones</th>
          </>
        )}
      >
        {sortedTipos.map((tipo) => (
          <tr key={tipo.id_tipo_documento} className="hover:bg-surface-container-low/80 transition-colors">
            <td className="py-3 px-4 pl-6 font-medium text-base">{tipo.nombre}</td>
            <td className="py-3 px-4"><DocumentStatusBadge status="faltante" /></td>
            <td className="py-3 px-4 pr-6">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onUpload(tipo)}
                  aria-label={`Cargar ${tipo.nombre}`}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-semibold text-primary hover:bg-primary-fixed/30 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">upload_file</span>
                  Cargar
                </button>
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  )
}
