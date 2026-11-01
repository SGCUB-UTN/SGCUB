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
    <div role={label ? 'status' : undefined} className={`${PULSE} ${className}`}>
      {label && <span className="sr-only">{label}</span>}
      {children}
    </div>
  )
}

export function TableSkeletonRows({ colSpan, rows = 5, label, cellClassName = 'py-4 px-4', animated = true }) {
  return Array.from({ length: rows }, (_, row) => (
    <tr key={row} className={animated ? PULSE : ''} aria-hidden={row > 0 || !label || undefined}>
      {Array.from({ length: colSpan }, (_, column) => (
        <td key={column} className={cellClassName}>
          {label && row === 0 && column === 0 && <span className="sr-only" role="status">{label}</span>}
          <SkeletonBlock className={`h-3.5 ${CELL_WIDTHS[(row + column) % CELL_WIDTHS.length]}`} />
        </td>
      ))}
    </tr>
  ))
}

export function HeadingSkeleton({ withAction = false }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-outline-variant/30 bg-surface-container-low px-4 sm:px-5 py-3.5">
      <SkeletonBlock className="h-5 w-56 max-w-full" />
      {withAction && <SkeletonBlock className="h-5 w-28 shrink-0" />}
    </div>
  )
}

export function RingSkeleton({ size = 168, stroke = 22 }) {
  return (
    <div
      className="shrink-0 rounded-full border-surface-container-high"
      style={{ width: size, height: size, borderWidth: stroke }}
      aria-hidden="true"
    />
  )
}

export function LineSkeletons({ count = 3, className = 'flex flex-col gap-3' }) {
  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3">
          <SkeletonBlock className="w-2.5 h-2.5 shrink-0" />
          <SkeletonBlock className={`h-3.5 ${CELL_WIDTHS[index % CELL_WIDTHS.length]}`} />
          <SkeletonBlock soft className="h-3.5 w-16 ml-auto shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function TitleSkeleton({ label }) {
  return (
    <SkeletonStatus label={label} className="flex flex-col gap-1.5 py-0.5">
      <SkeletonBlock className="h-4 w-48" />
      <SkeletonBlock soft className="h-3 w-64 max-w-full" />
    </SkeletonStatus>
  )
}

export function TextSkeleton({ label, lines = 5 }) {
  return (
    <SkeletonStatus label={label} className="flex flex-col gap-2.5">
      {Array.from({ length: lines }, (_, index) => (
        <SkeletonBlock key={index} soft className={`h-3.5 ${CELL_WIDTHS[index % CELL_WIDTHS.length]}`} />
      ))}
    </SkeletonStatus>
  )
}

export function ListSkeleton({ label, rows = 3, avatar = false, className = '' }) {
  return (
    <SkeletonStatus label={label} className={`flex flex-col divide-y divide-outline-variant/20 ${className}`}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-3">
          {avatar && <SkeletonBlock round className="w-9 h-9 shrink-0" />}
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            <SkeletonBlock className={`h-3.5 ${CELL_WIDTHS[index % CELL_WIDTHS.length]}`} />
            <SkeletonBlock soft className="h-3 w-1/3" />
          </div>
          <SkeletonBlock soft className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </SkeletonStatus>
  )
}

export function PanelStatusSkeleton({ label }) {
  return (
    <SkeletonStatus label={label} className="flex flex-col gap-3">
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock soft className="h-3.5 w-1/2" />
      <SkeletonBlock className="mt-1 h-10 w-44" />
    </SkeletonStatus>
  )
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

function InputSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonBlock soft className="h-3.5 w-28" />
      <SkeletonBlock className="h-11 w-full" />
    </div>
  )
}

export function FormSkeleton({ label, sections = 2 }) {
  return (
    <SkeletonStatus label={label} className="max-w-5xl mx-auto w-full flex flex-col gap-6 pb-8">
      <div className="flex flex-col gap-3 mt-2">
        <SkeletonBlock soft className="h-4 w-56" />
        <SkeletonBlock className="h-7 w-72 max-w-full" />
      </div>
      {Array.from({ length: sections }, (_, section) => (
        <div key={section} className="bg-surface-container-lowest rounded-xl shadow-sm p-6 flex flex-col gap-5">
          <SkeletonBlock className="h-5 w-48" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }, (_, index) => <InputSkeleton key={index} />)}
          </div>
        </div>
      ))}
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
      <TabsSkeleton />
    </SkeletonStatus>
  )
}

export function TabsSkeleton({ tabs = 3, fields = 9 }) {
  return (
    <div className="flex flex-col">
      <div className="bg-surface-container-lowest rounded-t-xl shadow-sm px-4 pt-4 pb-3 flex gap-6 overflow-hidden border-b border-surface-container">
        {Array.from({ length: tabs }, (_, index) => <SkeletonBlock key={index} className="h-5 w-28 shrink-0" />)}
      </div>
      <div className="bg-surface-container-lowest rounded-b-xl shadow-sm p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: fields }, (_, index) => <FieldSkeleton key={index} />)}
      </div>
    </div>
  )
}
