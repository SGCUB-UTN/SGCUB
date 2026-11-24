import { useId } from 'react'

// Select de las barras de filtros. La flecha nativa queda pegada al borde e ignora el padding,
// así que se oculta (appearance-none) y se dibuja una propia con margen a la derecha.
// `etiqueta` muestra un texto fijo a la izquierda (p. ej. "Estado:") para que se entienda qué filtra.
export default function FilterSelect({ etiqueta, className = '', width, children, ...props }) {
  const id = useId()
  return (
    <div className={`flex items-center gap-2 w-full min-w-0 max-w-full ${width ?? 'sm:w-auto'}`}>
      {etiqueta && (
        <label htmlFor={id} className="text-sm font-medium text-on-surface-variant whitespace-nowrap">
          {etiqueta}
        </label>
      )}
      <div className={`relative flex-1 min-w-0 ${width ? '' : 'sm:flex-none'}`}>
        <select id={id} className={`w-full h-10 pl-2.5 pr-8 appearance-none ${className}`} {...props}>
          {children}
        </select>
        {/* Tamaño en línea: la hoja de Google Fonts fija 24px y le gana a las clases text-[..] de Tailwind. */}
        <span
          className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-outline pointer-events-none"
          style={{ fontSize: 18 }}
          aria-hidden="true"
        >
          expand_more
        </span>
      </div>
    </div>
  )
}
