import { Fragment, useState } from 'react'
import DataTable from '../shared/DataTable'
import { formatAmount, formatDni, formatNumber } from '../personas/format'
import FinancialTab from '../personas/tabs/FinancialTab'

const COLUMN_COUNT = 5

// Socios with overdue debt. Each row expands to show the socio's account statement.
function MorosidadTable({ filas }) {
  const [expandedSocioId, setExpandedSocioId] = useState(null)

  return (
    <DataTable
      className="border border-outline-variant/40 rounded-lg"
      tableClassName="min-w-[760px]"
      headers={(
        <>
          <th className="px-4 py-3" scope="col">Socio</th>
          <th className="px-4 py-3" scope="col">DNI</th>
          <th className="px-4 py-3" scope="col">Categoría deportiva</th>
          <th className="px-4 py-3 text-right" scope="col">Monto adeudado</th>
          <th className="px-4 py-3 text-right" scope="col">Días de mora</th>
        </>
      )}
    >
      {filas.map((fila) => {
        const expanded = String(expandedSocioId) === String(fila.socio_id)
        return (
          <Fragment key={fila.socio_id}>
            <tr className="hover:bg-surface-container-low/70">
              <td className="px-4 py-3">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setExpandedSocioId(expanded ? null : fila.socio_id)}
                  className="inline-flex items-center gap-2 text-left font-semibold text-primary hover:underline"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{expanded ? 'expand_less' : 'expand_more'}</span>
                  {fila.apellido}, {fila.nombre}
                </button>
                <span className="block pl-7 text-xs text-on-surface-variant">Socio {formatNumber(fila.numero_socio)}</span>
              </td>
              <td className="px-4 py-3 text-on-surface-variant">{formatDni(fila.dni)}</td>
              <td className="px-4 py-3 text-on-surface-variant">{fila.categoria_deportiva}</td>
              <td className="px-4 py-3 text-right font-semibold text-error">{formatAmount(fila.monto_adeudado)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-on-surface">{fila.dias_mora}</td>
            </tr>
            {expanded && (
              <tr className="bg-surface-container-low/50">
                <td colSpan={COLUMN_COUNT} className="p-4"><FinancialTab socio={fila} /></td>
              </tr>
            )}
          </Fragment>
        )
      })}
    </DataTable>
  )
}

export default MorosidadTable
