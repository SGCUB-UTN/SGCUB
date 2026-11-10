import { PANEL_CLASS } from '../shared/panel'

export default function ReportCard({ title, caption, actions, className = '', children }) {
  return (
    <div className={`${PANEL_CLASS} p-4 sm:p-5 flex flex-col gap-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-on-surface-variant">{title}</h3>
          {caption && <p className="mt-0.5 text-xs text-on-surface-variant">{caption}</p>}
        </div>
        {actions}
      </div>
      {children}
    </div>
  )
}
