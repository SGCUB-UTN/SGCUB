import { formatAmount } from '../personas/format'

function DesgloseComprobante({ detalle }) {
  const periodos = detalle?.periodos ?? []

  const renderPeriodoLabel = (periodo) => {
    if (!periodo) return '—'
    const [year, month] = periodo.split('-')
    const date = new Date(Number(year), Number(month) - 1, 1)
    const label = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
    return label.charAt(0).toUpperCase() + label.slice(1)
  }

  return (
    <section className="border border-outline-variant/30 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-surface-container-low border-b border-outline-variant/30">
        <h3 className="font-semibold text-on-surface">Períodos abonados</h3>
      </div>
      <div className="divide-y divide-outline-variant/20">
        {periodos.length === 0 && <p className="px-3 py-2 text-sm text-on-surface-variant">Sin períodos imputados.</p>}
        {periodos.map((periodo) => (
          <div key={periodo.cuota_id} className="p-3">
            <div className="flex justify-between items-center mb-1.5">
              <strong className="text-on-surface text-sm">{renderPeriodoLabel(periodo.periodo)}</strong>
              <span className="font-semibold text-on-surface text-sm">{formatAmount(periodo.monto_aplicado)}</span>
            </div>
            {periodo.detalle && periodo.detalle.length > 0 && (
              <ul className="flex flex-col gap-1 pl-1">
                {periodo.detalle.map((linea) => (
                  <li key={linea.concepto} className="flex justify-between text-sm">
                    <span className="text-on-surface-variant flex items-center gap-1.5 before:content-[''] before:block before:w-1 before:h-1 before:bg-outline-variant/50 before:rounded-full">
                      {linea.concepto_nombre}
                    </span>
                    <span className={Number(linea.monto) < 0 ? 'text-emerald-700 font-medium' : 'text-on-surface-variant'}>
                      {formatAmount(linea.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default DesgloseComprobante
