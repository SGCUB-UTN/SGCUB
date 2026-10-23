import DataTable from '../shared/DataTable'
import { formatAmount } from '../personas/format'
import { formatPeriod, periodOf } from '../shared/periodFormat'
import { cuotaDiscounts, scholarshipState, todayIso } from './accountStatement'

const TABLE_CLASS = 'border border-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm'

const BADGE_CLASS = 'inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border whitespace-nowrap'

const SCHOLARSHIP_STATES = {
  active: { label: 'Vigente', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  upcoming: { label: 'Próxima', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  finished: { label: 'Finalizada', className: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40' },
}

const APPLIED_STATE = { label: 'Aplicado', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' }

const TYPES = {
  beca: { label: 'Beca', className: 'bg-primary/5 text-primary border-primary/20' },
  descuento: { label: 'Descuento', className: 'bg-surface-container-high text-on-surface border-outline-variant/40' },
}

const monthYear = (date) => formatPeriod(periodOf(date))

const scholarshipValue = (beca) => (beca.porcentaje != null
  ? `${Number(beca.porcentaje).toLocaleString('es-AR')}%`
  : formatAmount(beca.monto))

const scholarshipRows = (becas, today) => (becas ?? []).map((beca) => ({
  key: `beca-${beca.beca_id}`,
  type: TYPES.beca,
  sortDate: beca.fecha_aplicacion,
  validity: `${monthYear(beca.fecha_aplicacion)} → ${monthYear(beca.fecha_fin)}`,
  reason: beca.motivo,
  value: scholarshipValue(beca),
  state: SCHOLARSHIP_STATES[scholarshipState(beca, today)],
}))

const discountRows = (cuotas) => cuotaDiscounts(cuotas).map((discount) => ({
  key: `descuento-${discount.item_cuota_id}`,
  type: TYPES.descuento,
  sortDate: `${discount.periodo}-01`,
  validity: formatPeriod(discount.periodo),
  reason: discount.motivo,
  value: `− ${formatAmount(discount.monto)}`,
  state: APPLIED_STATE,
}))

export function BenefitsTable({ becas, cuotas }) {
  const rows = [...scholarshipRows(becas, todayIso()), ...discountRows(cuotas)]
    .sort((a, b) => String(b.sortDate).localeCompare(String(a.sortDate)))

  return (
    <section className="flex flex-col gap-3" aria-labelledby="beneficios-title">
      <h3 id="beneficios-title" tabIndex="-1" className="text-lg font-bold text-on-surface py-2 scroll-mt-6 focus:outline-none">Becas y descuentos</h3>
      {becas === null && <p className="text-sm text-error" role="alert">No se pudieron cargar las becas del socio.</p>}
      {rows.length ? (
        <DataTable
          className={TABLE_CLASS}
          tableClassName="min-w-[760px] table-fixed"
          headers={(
            <>
              <th className="py-3 px-4 w-[14%]" scope="col">Tipo</th>
              <th className="py-3 px-4 w-[28%]" scope="col">Vigencia</th>
              <th className="py-3 px-4" scope="col">Motivo</th>
              <th className="py-3 px-4 w-[14%] text-right" scope="col">Valor</th>
              <th className="py-3 px-4 w-[15%] text-center" scope="col">Estado</th>
            </>
          )}
        >
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="py-3 px-4">
                <span className={`${BADGE_CLASS} ${row.type.className}`}>{row.type.label}</span>
              </td>
              <td className="py-3 px-4 font-medium text-on-surface whitespace-nowrap">{row.validity}</td>
              <td className="py-3 px-4 text-on-surface-variant break-words">{row.reason || '—'}</td>
              <td className="py-3 px-4 text-right font-semibold text-on-surface whitespace-nowrap">{row.value}</td>
              <td className="py-3 px-4 text-center">
                <span className={`${BADGE_CLASS} ${row.state.className}`}>{row.state.label}</span>
              </td>
            </tr>
          ))}
        </DataTable>
      ) : (
        becas !== null && (
          <p className="text-base text-on-surface-variant py-6 text-center border border-dashed border-outline-variant/40 rounded-xl">
            Sin becas ni descuentos.
          </p>
        )
      )}
    </section>
  )
}
