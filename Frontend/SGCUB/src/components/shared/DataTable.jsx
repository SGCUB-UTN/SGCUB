// Shared table shell: horizontal scroll wrapper, header row and body with the app's table styles.
// `headers` receives the <th>/<SortableHeader> cells; rows go as children.
const HEADER_ROW_CLASS = 'bg-surface-container-low/60 border-b border-outline-variant/30 text-sm font-semibold text-on-surface-variant uppercase tracking-wider'
const FOOTER_ROW_CLASS = 'bg-surface-container-low/60 border-t border-outline-variant/30 text-on-surface tabular-nums'
const BODY_CLASS ='divide-y divide-outline-variant/20 font-body-sm text-on-surface tabular-nums'

export default function DataTable({ headers, children, footer = null, className = '', tableClassName = '', bodyClassName = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className={`w-full text-left border-collapse text-sm ${tableClassName}`}>
        <thead>
          <tr className={HEADER_ROW_CLASS}>{headers}</tr>
        </thead>
        <tbody className={`${BODY_CLASS} ${bodyClassName}`}>{children}</tbody>
        {footer && (
          <tfoot>
            <tr className={FOOTER_ROW_CLASS}>{footer}</tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
