import { Tooltip } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import SortableHeader from '../shared/SortableHeader'
import useOrdenTabla from '../../hooks/useOrdenTabla'
import { formatAmount, formatDni } from '../personas/format'
import { debtNotice } from './debtNotices'
import { profilePath } from './delinquencyFilters'

const HEADER_CLASS = 'px-4 py-3 normal-case tracking-normal font-semibold'
const SORT_VALUES = {
  name: (fila) => `${fila.apellido}, ${fila.nombre}`,
  category: (fila) => (fila.tipo === 'Jugador' ? fila.categoria_deportiva : ''),
  cuotas: (fila) => fila.cuotas_vencidas,
  debt: (fila) => Number(fila.monto_adeudado),
}
const TYPE_BADGES = {
  Jugador: 'bg-primary/10 text-primary border-primary/20',
  Socio: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40',
}
const ACTION_CLASS = 'inline-flex items-center justify-center w-9 h-9 rounded-md transition-colors cursor-pointer'

function ActionButton({ label, icon, className, onClick }) {
  return (
    <Tooltip label={label} withArrow position="top">
      <button type="button" onClick={onClick} aria-label={label} className={`${ACTION_CLASS} ${className}`}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>
      </button>
    </Tooltip>
  )
}

function MorosidadTable({ filas }) {
  const navigate = useNavigate()
  const { ordenadas: sorted, orden: sort, ordenarPor: sortBy } = useOrdenTabla(filas, SORT_VALUES)
  const sortProps = { className: HEADER_CLASS, labelClassName: '', orden: sort, onOrdenar: sortBy }

  return (
    <DataTable
      tableClassName="min-w-[720px]"
      headers={(
        <>
          <SortableHeader {...sortProps} etiqueta="Socio / Jugador" columna="name" />
          <SortableHeader {...sortProps} etiqueta="Categoría" columna="category" />
          <SortableHeader {...sortProps} etiqueta="Cuotas adeudadas" columna="cuotas" />
          <SortableHeader {...sortProps} etiqueta="Monto deuda" columna="debt" />
          <th className={`${HEADER_CLASS} text-right`} scope="col">Acciones</th>
        </>
      )}
    >
      {sorted.map((fila) => (
        <tr key={fila.socio_id} className="hover:bg-surface-container-low/70">
          <td className="px-4 py-3">
            <span className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">{fila.apellido}, {fila.nombre}</span>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${TYPE_BADGES[fila.tipo] ?? TYPE_BADGES.Socio}`}>
                {fila.tipo}
              </span>
            </span>
            <span className="block text-sm text-on-surface-variant">DNI {formatDni(fila.dni)}</span>
          </td>
          <td className="px-4 py-3 text-on-surface-variant">{fila.tipo === 'Jugador' ? fila.categoria_deportiva : '—'}</td>
          <td className="px-4 py-3 text-on-surface">{fila.cuotas_vencidas}</td>
          <td className="px-4 py-3 whitespace-nowrap font-semibold text-error">{formatAmount(fila.monto_adeudado)}</td>
          <td className="px-4 py-3">
            <div className="flex justify-end gap-1">
              <ActionButton
                label="Ver estado de cuenta"
                icon="visibility"
                className="text-primary hover:bg-primary-fixed/30"
                onClick={() => navigate(profilePath(fila))}
              />
              <ActionButton
                label="Notificar deuda"
                icon="campaign"
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
                onClick={() => navigate('/comunicaciones', { state: { debtNotice: debtNotice(fila) } })}
              />
            </div>
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

export default MorosidadTable
