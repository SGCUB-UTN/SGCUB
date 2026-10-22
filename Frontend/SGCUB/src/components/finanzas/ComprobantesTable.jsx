import { useMemo, useState } from 'react'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { formatPeriod, periodOf, periodOptions } from '../shared/periodFormat'
import { formatAmount, formatDate, formatDni } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'

const FILTER_CLASS = 'bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm font-medium focus:outline-none focus:border-primary cursor-pointer'
const HEADER_CLASS = 'py-3 px-4'
const COLUMN_COUNT = 5
const ALL = 'todos'
const STATUS_OPTIONS = ['Vigente', 'Anulado']

const socioName = (comprobante) => {
  const socio = comprobante.socio
  return socio ? `${socio.apellido ?? ''}, ${socio.nombre ?? ''}`.replace(/^, |, $/g, '') : ''
}

const SORT_VALUES = {
  number: (comprobante) => Number(comprobante.numero),
  date: (comprobante) => comprobante.fecha_emision,
  socio: (comprobante) => socioName(comprobante) || null,
  amount: (comprobante) => Number(comprobante.monto_total),
}
// On load: latest receipts first.
const INITIAL_SORT = { columna: 'number', direccion: 'desc' }

function ComprobantesTable({ comprobantes = [], isLoading, error, onSelect }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(ALL)
  const [month, setMonth] = useState(ALL)

  const availableMonths = useMemo(
    () => periodOptions(comprobantes, (comprobante) => periodOf(comprobante.fecha_emision)),
    [comprobantes],
  )

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    const textDigits = text.replace(/[.#]/g, '')
    return comprobantes.filter((comprobante) => {
      if (status !== ALL && comprobante.estado !== status) return false
      if (month !== ALL && periodOf(comprobante.fecha_emision) !== month) return false
      if (!text) return true
      return socioName(comprobante).toLowerCase().includes(text)
        || (textDigits !== '' && [comprobante.numero, comprobante.pago, comprobante.socio?.dni]
          .some((field) => String(field ?? '').includes(textDigits)))
    })
  }, [comprobantes, search, status, month])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)

  const handleKeyDown = (event, comprobante) => {
    if (event.key === 'Enter' || event.key === ' ') onSelect?.(comprobante)
  }

  return (
    <section className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-xl shadow-sm overflow-hidden" aria-labelledby="comprobantes-title">
      <div className="p-5 border-b border-outline-variant/20 flex items-center justify-between gap-3">
        <div>
          <h2 id="comprobantes-title" className="text-xl font-bold text-on-surface">Comprobantes de pago</h2>
          <p className="text-sm text-on-surface-variant">Historial completo de comprobantes emitidos.</p>
        </div>
        <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
      </div>

      <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
        <TableSearchInput
          value={search}
          onChange={withPageReset(setSearch)}
          placeholder="Buscar por N° de comprobante, socio, DNI o pago..."
          label="Filtrar comprobantes"
        />
        <FilterSelect
          className={FILTER_CLASS}
          value={month}
          onChange={(event) => withPageReset(setMonth)(event.target.value)}
          aria-label="Filtrar por mes de emisión"
        >
          <option value={ALL}>Mes: Todos</option>
          {availableMonths.map((value) => <option key={value} value={value}>{formatPeriod(value)}</option>)}
        </FilterSelect>
        <FilterSelect
          className={FILTER_CLASS}
          value={status}
          onChange={(event) => withPageReset(setStatus)(event.target.value)}
          aria-label="Filtrar por estado"
        >
          <option value={ALL}>Estado: Todos</option>
          {STATUS_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
        </FilterSelect>
      </div>

      <DataTable
        tableClassName="min-w-[720px]"
        headers={(
          <>
            <SortableHeader className={HEADER_CLASS} etiqueta="Número" columna="number" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Fecha" columna="date" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className={HEADER_CLASS} etiqueta="Socio" columna="socio" orden={sort} onOrdenar={sortAndReset} />
            <th className={HEADER_CLASS} scope="col">Pago asociado</th>
            <SortableHeader className={`${HEADER_CLASS} text-right`} etiqueta="Monto total" columna="amount" orden={sort} onOrdenar={sortAndReset} />
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={Boolean(error) || visibleRows.length === 0}
          error={error}
          loadingText="Cargando comprobantes..."
          errorText="No se pudieron cargar los comprobantes."
          emptyText={comprobantes.length === 0 ? 'Todavía no hay comprobantes registrados.' : 'No hay comprobantes que coincidan con el filtro.'}
        />

        {!isLoading && !error && visibleRows.map((comprobante) => (
          <tr
            key={comprobante.comprobante_id}
            onClick={() => onSelect?.(comprobante)}
            onKeyDown={(event) => handleKeyDown(event, comprobante)}
            tabIndex={0}
            role="button"
            className="hover:bg-surface-container-low focus:bg-surface-container-low focus:outline-none transition-colors cursor-pointer"
          >
            <td className="py-3 px-4 font-semibold text-primary whitespace-nowrap">
              #{comprobante.numero}
              {comprobante.estado === 'Anulado' && (
                <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-error-container text-on-error-container">Anulado</span>
              )}
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDate(comprobante.fecha_emision)}</td>
            <td className="py-3 px-4">
              {comprobante.socio ? (
                <>
                  <span className="block font-medium text-on-surface">{socioName(comprobante)}</span>
                  <span className="block text-sm text-on-surface-variant">DNI {formatDni(comprobante.socio.dni)}</span>
                </>
              ) : (
                <span className="text-on-surface-variant">—</span>
              )}
            </td>
            <td className="py-3 px-4 text-on-surface-variant">Pago #{comprobante.pago}</td>
            <td className="py-3 px-4 text-right font-semibold text-on-surface">{formatAmount(comprobante.monto_total)}</td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="comprobantes-rows-per-page" {...paginationProps} />
    </section>
  )
}

export default ComprobantesTable
