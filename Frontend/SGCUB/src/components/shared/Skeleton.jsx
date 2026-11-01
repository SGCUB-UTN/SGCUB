const PULSE = 'animate-pulse motion-reduce:animate-none'
const CELL_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-2/5']

export function SkeletonBlock({ className = '', soft = false, round = false }) {
  return (
    <div
      className={`${round ? 'rounded-full' : 'rounded'} ${soft ? 'bg-surface-container' : 'bg-surface-container-high'} ${className}`}
      aria-hidden="true"
    />
  )
}

export function SkeletonStatus({ label, className = '', children }) {
  return (
    <div role="status" className={`${PULSE} ${className}`}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

export function TableSkeletonRows({ colSpan, rows = 5, label }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className={PULSE} aria-hidden={row > 0 || undefined}>
      {Array.from({ length: colSpan }, (_, column) => (
        <td key={column} className="py-4 px-4">
          {row === 0 && column === 0 && <span className="sr-only" role="status">{label}</span>}
          <SkeletonBlock className={`h-3.5 ${CELL_WIDTHS[(row + column) % CELL_WIDTHS.length]}`} />
        </td>
      ))}
    </tr>
  ))
}

function FieldSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBlock soft className="h-3 w-24" />
      <SkeletonBlock className="h-4 w-40 max-w-full" />
    </div>
  )
}

export function PanelSkeleton({ label, fields = 6 }) {
  return (
    <SkeletonStatus label={label} className="bg-surface-container-lowest rounded-xl shadow-sm p-6 flex flex-col gap-6">
      <SkeletonBlock className="h-5 w-48" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: fields }, (_, index) => <FieldSkeleton key={index} />)}
      </div>
    </SkeletonStatus>
  )
}

export function DetailSkeleton({ label }) {
  return (
    <SkeletonStatus label={label} className="w-full flex flex-col pb-8">
      <SkeletonBlock soft className="h-4 w-56 mt-2 mb-4" />
      <div className="bg-surface-container-lowest rounded-xl shadow-sm p-6 mb-6 flex items-center gap-4">
        <SkeletonBlock round className="w-20 h-20 shrink-0" />
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          <SkeletonBlock className="h-7 w-64 max-w-full" />
          <SkeletonBlock soft className="h-4 w-80 max-w-full" />
        </div>
      </div>
      <div className="bg-surface-container-lowest rounded-t-xl shadow-sm px-4 pt-4 pb-3 flex gap-6 border-b border-surface-container">
        {[0, 1, 2].map((index) => <SkeletonBlock key={index} className="h-5 w-28" />)}
      </div>
      <div className="bg-surface-container-lowest rounded-b-xl shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 9 }, (_, index) => <FieldSkeleton key={index} />)}
      </div>
    </SkeletonStatus>
  )
}
