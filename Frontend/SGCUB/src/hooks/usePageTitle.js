import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const APP_NAME = 'SGCUB'

const TITLES = [
  ['/caja', 'Caja y cobros'],
  ['/finanzas/cuotas', 'Cuotas'],
  ['/resumen-financiero', 'Resumen financiero'],
  ['/padron/socios', 'Socios'],
  ['/padron/jugadores', 'Jugadores'],
  ['/padron/docentes', 'Docentes'],
  ['/docentes', 'Docentes'],
  ['/padron/categorias', 'Categorías'],
  ['/categorias', 'Categorías'],
  ['/padron/reportes', 'Reporte del padrón'],
  ['/morosidad', 'Morosidad'],
  ['/documental', 'Documentación'],
  ['/comunicaciones/nuevo', 'Nuevo envío'],
  ['/comunicaciones', 'Comunicaciones'],
  ['/usuarios', 'Usuarios'],
  ['/configuracion', 'Configuración'],
  ['/automatizaciones', 'Automatizaciones'],
]

const findTitle = (pathname) => {
  if (pathname === '/') return 'Inicio'
  const match = TITLES.find(([route]) => pathname === route || pathname.startsWith(`${route}/`))
  return match?.[1] ?? null
}

export default function usePageTitle() {
  const { pathname } = useLocation()

  useEffect(() => {
    const title = findTitle(pathname)
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [pathname])
}
