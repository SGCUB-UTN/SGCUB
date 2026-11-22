import { Link } from 'react-router-dom'
export default function PageHeader({ breadcrumb = [], title, actions }) {
  return (
    <div className="flex flex-col gap-1 mt-2 mb-2">
      {breadcrumb.length > 0 && (
        <nav className="page-header-breadcrumb flex items-center gap-1.5 text-on-surface-variant font-label-md" aria-label="Ruta">
          {breadcrumb.map((item, index) => (
            <span key={item.label} className="">
              {index > 0 && (
                <span className="mr-2 ml-2" aria-hidden="true">&gt;</span>
              )}
              {item.to ? (
                <Link className="hover:text-primary transition-colors" to={item.to}>
                  {item.label}
                </Link>
              ) : (
                <span>{item.label}</span>
              )}
            </span>
          ))}
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
