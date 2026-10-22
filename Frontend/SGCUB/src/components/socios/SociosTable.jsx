import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ActiveStatusBadge from '../shared/ActiveStatusBadge'
import DataTable from '../shared/DataTable'
import FilterSelect from '../shared/FilterSelect'
import ProfileBadge from '../shared/ProfileBadge'
import SortableHeader from '../shared/SortableHeader'
import TableMessageRow from '../shared/TableMessageRow'
import TablePagination from '../shared/TablePagination'
import TableSearchInput from '../shared/TableSearchInput'
import { formatDni, formatPhone } from '../personas/format'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import usePagination from '../../hooks/usePagination'
import useRegisterPayment from '../../hooks/useRegisterPayment'

const COLUMN_COUNT = 7

const formatDate = (date) => {
  if (!date) return '—'
  const parts = String(date).split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return date
}

const phoneOf = (socio) => socio.telefono ?? socio.persona?.telefono ?? ''

const detailPathOf = (socio) => (socio.jugador_id
  ? `/padron/jugadores/${socio.jugador_id}`
  : `/padron/socios/${socio.socio_id}`)

const isActive = (socio) => (socio.estado_administrativo_nombre ?? '').toLowerCase().includes('activo')
  && !(socio.estado_administrativo_nombre ?? '').toLowerCase().includes('inactivo')

const exportCsv = (socios) => {
  const headers = ['N° Socio', 'Nombre', 'Apellido', 'DNI', 'Teléfono', 'Fecha de alta', 'Estado']
  const rows = socios.map((socio) => [
    socio.numero_socio ?? '',
    socio.nombre ?? '',
    socio.apellido ?? '',
    socio.dni ?? '',
    phoneOf(socio),
    formatDate(socio.fecha_alta),
    socio.estado_administrativo_nombre ?? '',
  ])
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')

  const link = document.createElement('a')
  const content = '﻿' + csv
  link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }))
  link.download = `padron-socios-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}

// Value each column is sorted by. Status: active first in ascending order.
const SORT_VALUES = {
  numero: (socio) => (socio.numero_socio ? Number(socio.numero_socio) : null),
  nombre: (socio) => `${socio.nombre ?? ''} ${socio.apellido ?? ''}`.trim(),
  fechaAlta: (socio) => socio.fecha_alta,
  estado: (socio) => (isActive(socio) ? 0 : 1),
}
// On load: most recent first.
const INITIAL_SORT = { columna: 'numero', direccion: 'desc' }

function SociosTable({ data, isLoading, error, status, onStatusChange }) {
  const navigate = useNavigate()
  const { openPayment } = useRegisterPayment()
  const [search, setSearch] = useState('')

  const socios = useMemo(() => data ?? [], [data])

  const filtered = useMemo(() => {
    const text = search.trim().toLowerCase()
    return socios.filter((socio) => {
      if (status === 'activo' && !isActive(socio)) return false
      if (status === 'baja' && isActive(socio)) return false
      if (status === 'ex_jugador' && !socio.es_ex_jugador) return false
      if (!text) return true
      return [socio.nombre, socio.apellido, socio.dni, socio.numero_socio]
        .some((field) => String(field ?? '').toLowerCase().includes(text))
    })
  }, [socios, search, status])

  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filtered, SORT_VALUES, INITIAL_SORT)
  const { visibleRows, resetPage, withPageReset, paginationProps } = usePagination(sorted)
  const sortAndReset = withPageReset(sortBy)
  const [previousStatus, setPreviousStatus] = useState(status)
  if (status !== previousStatus) {
    setPreviousStatus(status)
    resetPage()
  }

  return (
    <div className="min-w-0 bg-surface-container-lowest border border-outline-variant/30 rounded-lg shadow-sm">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="flex flex-1 min-w-0 flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <TableSearchInput
            value={search}
            onChange={withPageReset(setSearch)}
            placeholder="Filtrar por DNI, Nombre o Apellido..."
            label="Filtrar socios"
          />
          <FilterSelect
            className="bg-surface-container-low border border-outline-variant/40 rounded text-on-surface font-body-sm text-sm focus:outline-none focus:border-primary cursor-pointer"
            value={status}
            onChange={(event) => onStatusChange(event.target.value)}
            aria-label="Filtrar por estado"
          >
            <option value="activo">Estado: Activo</option>
            <option value="todos">Estado: Todos</option>
            <option value="baja">De baja / Inactivo</option>
            <option value="ex_jugador">Ex jugadores</option>
          </FilterSelect>
        </div>
        <div className="flex items-center justify-end xl:shrink-0">
          <button
            type="button"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-3 w-full sm:w-auto shrink-0 bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/40 text-on-surface rounded text-base font-medium transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">file_download</span>
            <span>Exportar padrón</span>
          </button>
        </div>
      </div>

      <DataTable
        headers={(
          <>
            <SortableHeader className="py-3 px-4 w-28 whitespace-nowrap" etiqueta="N° Socio" columna="numero" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4" etiqueta="Nombre y Apellido" columna="nombre" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4 pl-5" scope="col">DNI</th>
            <th className="py-3 px-4" scope="col">Teléfono</th>
            <SortableHeader className="py-3 px-4" etiqueta="Fecha de Alta" columna="fechaAlta" orden={sort} onOrdenar={sortAndReset} />
            <SortableHeader className="py-3 px-4 w-36 whitespace-nowrap" etiqueta="Estado" columna="estado" orden={sort} onOrdenar={sortAndReset} />
            <th className="py-3 px-4 text-right" scope="col">Acciones</th>
          </>
        )}
      >
        <TableMessageRow
          colSpan={COLUMN_COUNT}
          isLoading={isLoading}
          isEmpty={visibleRows.length === 0}
          error={error}
          loadingText="Cargando socios..."
          errorText="No se pudieron cargar los socios."
          emptyText="No hay socios que coincidan con el filtro."
        />

        {!isLoading && visibleRows.map((socio) => (
          <tr
            key={socio.socio_id}
            onClick={() => navigate(detailPathOf(socio), { state: { from: 'socios' } })}
            className="hover:bg-surface-container-low/80 transition-colors cursor-pointer group"
          >
            <td className="py-3 px-4 font-bold text-primary text-base pl-6">
              {socio.numero_socio ? `#${socio.numero_socio}` : '—'}
            </td>
            <td className="py-3 px-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-on-surface text-base">
                  {socio.nombre} {socio.apellido}
                </span>
                {socio.es_ex_jugador && <ProfileBadge icon="sports_soccer">Ex jugador</ProfileBadge>}
              </div>
            </td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDni(socio.dni)}</td>
            <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{formatPhone(phoneOf(socio))}</td>
            <td className="py-3 px-4 text-on-surface-variant">{formatDate(socio.fecha_alta)}</td>
            <td className="py-3 px-4"><ActiveStatusBadge isActive={isActive(socio)} /></td>
            <td className="py-3 px-4 text-right" onClick={(event) => event.stopPropagation()}>
              <span title={isActive(socio) ? 'Registrar pago' : 'No se pueden registrar pagos a socios de baja'} className="inline-flex">
                <button
                  type="button"
                  onClick={() => openPayment({ socioId: socio.socio_id })}
                  disabled={!isActive(socio)}
                  aria-label={`Registrar pago de ${socio.nombre} ${socio.apellido}`}
                  className="inline-flex items-center gap-1 h-8 px-2.5 shrink-0 rounded-md border border-primary/30 text-sm font-semibold text-primary hover:bg-primary hover:text-on-primary transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">payments</span>
                  Pagar
                </button>
              </span>
            </td>
          </tr>
        ))}
      </DataTable>

      <TablePagination id="socios-rows-per-page" {...paginationProps} />
    </div>
  )
}

export default SociosTable
