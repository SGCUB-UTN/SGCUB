import DataTable from '../shared/DataTable'
import { formatAmount, formatDate } from '../personas/format'
import { formatPeriod } from '../shared/periodFormat'
import { cuotaDiscounts, scholarshipState, todayIso } from './accountStatement'

const TABLE_CLASS = 'border border-outline-variant/30 rounded-xl bg-surface-container-lowest shadow-sm'

const SCHOLARSHIP_STATES = {
  active: { label: 'Vigente', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  upcoming: { label: 'Próxima', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  finished: { label: 'Finalizada', className: 'bg-surface-container-high text-on-surface-variant border-outline-variant/40' },
}

const scholarshipValue = (beca) => (beca.porcentaje != null
  ? `${Number(beca.porcentaje).toLocaleString('es-AR')}%`
  : formatAmount(beca.monto))

function SectionHeader({ id, title, count, unit }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 id={id} className="text-lg font-bold text-on-surface py-2">{title}</h3>
      {count != null && <span className="text-sm text-on-surface-variant">{count} {unit}</span>}
    </div>
  )
}

function EmptyTable({ children }) {
  return (
    <p className="text-base text-on-surface-variant py-6 text-center border border-dashed border-outline-variant/40 rounded-xl">{children}</p>
  )
}

export function ScholarshipsTable({ becas }) {
  const today = todayIso()
  return (
    <section className="flex flex-col gap-3" aria-labelledby="becas-title">
      <SectionHeader id="becas-title" title="Becas" count={becas?.length} unit={becas?.length === 1 ? 'beca' : 'becas'} />
      {becas === null && <p className="text-sm text-error" role="alert">No se pudieron cargar las becas del socio.</p>}
      {becas && (becas.length ? (
        <DataTable
          className={TABLE_CLASS}
          tableClassName="min-w-[760px] table-fixed"
          headers={(
            <>
              <th className="py-3 px-4 w-[15%]" scope="col">Vigencia</th>
              <th className="py-3 px-4 w-[20%] text-center" scope="col">Valor</th>
              <th className="py-3 px-4" scope="col">Motivo</th>
              <th className="py-3 px-4 w-[16%]" scope="col">Asignada el</th>
              <th className="py-3 px-4 w-[17%] text-center" scope="col">Estado</th>
            </>
          )}
        >
          {becas.map((beca) => {
            const state = SCHOLARSHIP_STATES[scholarshipState(beca, today)]
            return (
              <tr key={beca.beca_id}>
                <td className="py-3 px-4 font-semibold text-on-surface whitespace-nowrap">{formatDate(beca.fecha_aplicacion)} → {formatDate(beca.fecha_fin)}</td>
                <td className="py-3 px-4 text-center font-semibold text-on-surface">{scholarshipValue(beca)}</td>
                <td className="py-3 px-4 text-on-surface-variant break-words">{beca.motivo || '—'}</td>
                <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(beca.fecha_creacion)}</td>
                <td className="py-3 px-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold border ${state.className}`}>{state.label}</span>
                </td>
              </tr>
            )
          })}
        </DataTable>
      ) : (
        <EmptyTable>Sin becas asignadas.</EmptyTable>
      ))}
    </section>
  )
}

export function DiscountsTable({ cuotas }) {
  const discounts = cuotaDiscounts(cuotas)
  return (
    <section className="flex flex-col gap-3" aria-labelledby="descuentos-title">
      <SectionHeader id="descuentos-title" title="Descuentos" count={discounts.length} unit={discounts.length === 1 ? 'descuento' : 'descuentos'} />
      {discounts.length ? (
        <DataTable
          className={TABLE_CLASS}
          tableClassName="min-w-[640px] table-fixed"
          headers={(
            <>
              <th className="py-3 px-4 w-[20%]" scope="col">Cuota</th>
              <th className="py-3 px-4 w-[20%]" scope="col">Fecha de aplicación</th>
              <th className="py-3 px-4" scope="col">Motivo</th>
              <th className="py-3 px-4 w-[16%] text-right" scope="col">Monto</th>
            </>
          )}
        >
          {discounts.map((discount) => (
            <tr key={discount.item_cuota_id}>
              <td className="py-3 px-4 font-semibold text-on-surface whitespace-nowrap">{formatPeriod(discount.periodo)}</td>
              <td className="py-3 px-4 text-on-surface-variant whitespace-nowrap">{formatDate(discount.fecha_aplicacion)}</td>
              <td className="py-3 px-4 text-on-surface-variant break-words">{discount.motivo || '—'}</td>
              <td className="py-3 px-4 text-right font-semibold text-on-surface">− {formatAmount(discount.monto)}</td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <EmptyTable>Sin descuentos aplicados.</EmptyTable>
      )}
    </section>
  )
}
