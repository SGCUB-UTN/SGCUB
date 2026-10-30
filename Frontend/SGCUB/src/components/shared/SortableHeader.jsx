const ICONOS = { asc: 'arrow_upward', desc: 'arrow_downward' }
const ARIA_SORT = { asc: 'ascending', desc: 'descending' }
const SIGUIENTE = { asc: 'de mayor a menor', desc: 'de menor a mayor' }

export default function SortableHeader({ etiqueta, columna, orden, onOrdenar, className = '', labelClassName = 'uppercase tracking-wider' }) {
  const direccion = orden.columna === columna ? orden.direccion : null
  return (
    <th className={className} scope="col" aria-sort={ARIA_SORT[direccion] ?? 'none'}>
      <button
        type="button"
        onClick={() => onOrdenar(columna)}
        title={`Ordenar ${SIGUIENTE[direccion] ?? 'de menor a mayor'}`}
        className={`inline-flex items-center gap-1 ${labelClassName} font-semibold whitespace-nowrap cursor-pointer hover:text-primary transition-colors ${direccion ? 'text-primary' : ''}`}
      >
        {etiqueta}
        <span
          className={`material-symbols-outlined ${direccion ? '' : 'text-outline'}`}
          style={{ fontSize: 14, lineHeight: 1 }}
          aria-hidden="true"
        >
          {ICONOS[direccion] ?? 'unfold_more'}
        </span>
      </button>
    </th>
  )
}
