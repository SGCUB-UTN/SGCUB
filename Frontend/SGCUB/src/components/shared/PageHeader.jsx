import { Link } from 'react-router-dom'
export default function PageHeader({ breadcrumb = [], title, actions }) {
  return (
    <div className="flex flex-col gap-1 mt-2 mb-2">
      {breadcrumb.length > 0 && (
        <nav className="page-header-breadcrumb text-on-surface-variant font-label-md" aria-label="Ruta">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            {breadcrumb.map((item, index) => {
              const isLast = index === breadcrumb.length - 1
              return (
                <li key={item.label} className="flex items-center gap-1">
                  {index > 0 && (
                    <span className="material-symbols-outlined text-outline" style={{ fontSize: 18 }} aria-hidden="true">chevron_right</span>
                  )}
                  {item.to ? (
                    <Link className="hover:text-primary hover:underline underline-offset-4 transition-colors" to={item.to}>
                      {item.label}
                    </Link>
                  ) : (
                    <span className={isLast ? 'text-on-surface font-medium' : undefined} aria-current={isLast ? 'page' : undefined}>
                      {item.label}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
      )}

      {(title || actions) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-3">
            {title && <h1 className="text-2xl font-bold text-on-surface tracking-tight font-headline-lg">{title}</h1>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
        </div>
      )}
    </div>
  )
}
