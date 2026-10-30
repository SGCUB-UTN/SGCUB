import { Fragment } from 'react'
import PageHeader from '../shared/PageHeader'

export default function CategoriaHeader({ breadcrumb = [], title, badge, metadata = [], actions }) {
  return (
    <>
      <PageHeader breadcrumb={breadcrumb} />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mt-2 mb-6">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="w-12 h-12 shrink-0 rounded-full bg-primary-container text-on-primary flex items-center justify-center select-none">
            <span className="material-symbols-outlined" style={{ fontSize: 26 }} aria-hidden="true">sports_soccer</span>
          </div>

          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl text-on-surface font-bold tracking-tight">{title}</h1>
              {badge}
            </div>
            {metadata.length > 0 && (
              <div className="flex items-center gap-y-1 gap-x-4 flex-wrap text-base text-on-surface-variant">
                {metadata.map((item, index) => (
                  <Fragment key={item.label}>
                    {index > 0 && <span className="text-outline-variant" aria-hidden="true">•</span>}
                    <div className="flex items-center gap-1">
                      <span className="text-outline">{item.label}:</span>
                      <span className="text-on-surface font-medium">{item.value}</span>
                    </div>
                  </Fragment>
                ))}
              </div>
            )}
          </div>
        </div>

        {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>}
      </div>
    </>
  )
}
