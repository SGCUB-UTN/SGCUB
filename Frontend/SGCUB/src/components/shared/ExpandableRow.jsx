import { Fragment } from 'react'

export const DETAIL_ROW_CLASS = 'bg-surface-container-low/60'
export const DETAIL_CELL_CLASS = 'px-4 py-4 border-l-4 border-primary'

export default function ExpandableRow({ expanded, onToggle, label, colSpan, detail, children }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  return (
    <Fragment>
      <tr
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={label}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        className={`cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60 ${expanded ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
      >
        <td className="py-3 pl-4 pr-0 text-outline">
          <span className={`material-symbols-outlined text-[22px] transition-transform ${expanded ? 'rotate-180 text-primary' : ''}`} aria-hidden="true">expand_more</span>
        </td>
        {children}
      </tr>
      {expanded && (
        <tr className={DETAIL_ROW_CLASS}>
          <td colSpan={colSpan} className={DETAIL_CELL_CLASS}>{detail}</td>
        </tr>
      )}
    </Fragment>
  )
}

export function DetailList({ items }) {
  const visible = items.filter((item) => item && item.value !== undefined && item.value !== null && item.value !== '')
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3">
      {visible.map((item) => (
        <div key={item.label} className={`min-w-0 ${item.wide ? 'sm:col-span-2 lg:col-span-3' : ''}`}>
          <dt className="text-sm text-on-surface-variant">{item.label}</dt>
          <dd className="text-base text-on-surface font-medium break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function DetailSection({ title, tone = 'default', children }) {
  const toneClass = tone === 'error'
    ? 'border-error/30 bg-error-container/30'
    : 'border-outline-variant/30 bg-surface-container-lowest'
  return (
    <section className={`flex flex-col gap-3 p-4 rounded-lg border ${toneClass}`}>
      <h4 className="text-base font-semibold text-on-surface">{title}</h4>
      {children}
    </section>
  )
}
