import { useNavigate } from 'react-router-dom'
import DataTable from '../shared/DataTable'
import { formatAmount, formatDni } from '../personas/format'
import { profilePath } from './delinquencyFilters'

const HEADER_CLASS = 'px-4 py-3'
const TYPE_BADGES = {
  Jugador: 'bg-primary/10 text-primary border-primary/20',
  Socio: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40',
}
const ACTION_CLASS = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-semibold transition-colors cursor-pointer'

const debtNotice = (row) => ({
  socioId: row.socio_id,
  subject: 'Aviso de deuda pendiente',
  body: `Hola ${row.nombre}, te recordamos que registrás ${row.cuotas_vencidas} ${row.cuotas_vencidas === 1 ? 'cuota vencida' : 'cuotas vencidas'} por un total de ${formatAmount(row.monto_adeudado)}. Podés regularizar tu situación en la secretaría del club.`,
})

function MorosidadTable({ filas }) {
  const navigate = useNavigate()

  return (
    <DataTable
      tableClassName="min-w-[900px]"
      headers={(
        <>
          <th className={HEADER_CLASS} scope="col">Socio / Jugador</th>
          <th className={HEADER_CLASS} scope="col">Tipo</th>
          <th className={HEADER_CLASS} scope="col">Categoría</th>
          <th className={`${HEADER_CLASS} text-right`} scope="col">Cuotas adeudadas</th>
          <th className={`${HEADER_CLASS} text-right`} scope="col">Monto deuda</th>
          <th className={`${HEADER_CLASS} text-right`} scope="col">Acciones</th>
        </>
      )}
    >
      {filas.map((fila) => (
        <tr key={fila.socio_id} className="hover:bg-surface-container-low/70">
          <td className="px-4 py-3">
            <span className="block font-semibold text-on-surface">{fila.apellido}, {fila.nombre}</span>
            <span className="block text-sm text-on-surface-variant">DNI {formatDni(fila.dni)}</span>
          </td>
          <td className="px-4 py-3">
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${TYPE_BADGES[fila.tipo] ?? TYPE_BADGES.Socio}`}>
              {fila.tipo}
            </span>
          </td>
          <td className="px-4 py-3 text-on-surface-variant">{fila.tipo === 'Jugador' ? fila.categoria_deportiva : '—'}</td>
          <td className="px-4 py-3 text-right text-on-surface">
            {fila.cuotas_vencidas}
            <span className="block text-xs text-on-surface-variant">{fila.dias_mora} días de mora</span>
          </td>
          <td className="px-4 py-3 text-right whitespace-nowrap">
            <span className="block font-semibold text-error">{formatAmount(fila.monto_adeudado)}</span>
            {Number(fila.recargos) > 0 && (
              <span className="block text-xs text-on-surface-variant">Incluye {formatAmount(fila.recargos)} de recargos</span>
            )}
          </td>
          <td className="px-4 py-3">
            <div className="flex justify-end gap-1">
              <button
                type="button"
                onClick={() => navigate(profilePath(fila))}
                className={`${ACTION_CLASS} text-primary hover:bg-primary-fixed/30`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">account_balance_wallet</span>
                Estado de cuenta
              </button>
              <button
                type="button"
                onClick={() => navigate('/comunicaciones', { state: { debtNotice: debtNotice(fila) } })}
                className={`${ACTION_CLASS} text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low`}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden="true">campaign</span>
                Notificar deuda
              </button>
            </div>
          </td>
        </tr>
      ))}
    </DataTable>
  )
}

export default MorosidadTable
