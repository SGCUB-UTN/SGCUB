import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import PermissionGate from '../../auth/PermissionGate';
import { PERMISSIONS } from '../../auth/permissions';
import StatusBadge from '../shared/StatusBadge';
import './sidebar.css';

const DURACION_CONTRAER = 220;
const DEMORA_DESPLEGAR = 120;
const DEMORA_CONTRAER = 150;

export default function Sidebar({ collapsed, onToggle, mobile = false, mobileOpen = false, onNavigate }) {
  const { pathname } = useLocation();

  const [alertas, setAlertas] = useState(null);

  useEffect(() => {
    const fetchAlertas = async () => {
      try {
        const { getAlertasCount } = await import('../../api/documentacion');
        const data = await getAlertasCount();
        setAlertas(data);
      } catch (err) {
        console.error('Error fetching alertas count:', err);
      }
    };
    
    fetchAlertas();

    window.addEventListener('documentacionCambiada', fetchAlertas);
    return () => window.removeEventListener('documentacionCambiada', fetchAlertas);
  }, []);

  const [mouseEncima, setMouseEncima] = useState(false);
  const [focoTeclado, setFocoTeclado] = useState(false);
  const hoverTimer = useRef(null);
  const desplegado = collapsed && (mouseEncima || focoTeclado);
  const contraido = collapsed && !desplegado;

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  const programarHover = (valor, demora) => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setMouseEncima(valor), demora);
  };

  const handleFocus = (event) => {
    if (event.target.matches(':focus-visible')) setFocoTeclado(true);
  };

  const handleBlur = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setFocoTeclado(false);
  };

  const [contrayendo, setContrayendo] = useState(false);
  const [contraidoAnterior, setContraidoAnterior] = useState(contraido);
  if (contraido !== contraidoAnterior) {
    setContraidoAnterior(contraido);
    setContrayendo(contraido);
  }

  useEffect(() => {
    if (!contrayendo) return undefined;
    const timer = setTimeout(() => setContrayendo(false), DURACION_CONTRAER);
    return () => clearTimeout(timer);
  }, [contrayendo]);

  const claseEstado = mobile
    ? mobileOpen ? 'app-sidebar--mobile-open' : ''
    : contrayendo
    ? 'app-sidebar--collapsing'
    : contraido
      ? 'app-sidebar--collapsed'
      : desplegado
        ? 'app-sidebar--peek'
        : '';
  const matches = (routes) => routes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const finanzasActive = matches(['/finanzas', '/resumen-financiero', '/caja']);
  const padronActive = matches(['/padron/socios', '/padron/jugadores', '/padron/docentes', '/padron/categorias', '/docentes', '/categorias']);
  const comunicacionesActive = matches(['/comunicaciones']);
  const reportesActive = matches(['/padron/reportes', '/morosidad']);
  const ajustesActive = matches(['/usuarios', '/automatizaciones', '/configuracion']);

  const [openSections, setOpenSections] = useState({
    finanzas: finanzasActive,
    padron: padronActive,
    comunicaciones: comunicacionesActive,
    reportes: reportesActive,
    ajustes: ajustesActive,
  });

  useEffect(() => {
    setOpenSections((current) => ({
      ...current,
      ...(finanzasActive && { finanzas: true }),
      ...(padronActive && { padron: true }),
      ...(comunicacionesActive && { comunicaciones: true }),
      ...(reportesActive && { reportes: true }),
      ...(ajustesActive && { ajustes: true }),
    }));
  }, [finanzasActive, padronActive, comunicacionesActive, reportesActive, ajustesActive]);

  return (
    <aside
      id="app-sidebar"
      className={`app-sidebar ${claseEstado}`}
      onMouseEnter={() => collapsed && programarHover(true, DEMORA_DESPLEGAR)}
      onMouseLeave={() => programarHover(false, DEMORA_CONTRAER)}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <div className="app-sidebar-content">
        <div className="app-sidebar-scroll">
          <nav
            className="app-sidebar-nav"
            aria-label="Navegación principal"
            onClick={(event) => mobile && event.target.closest('a') && onNavigate?.()}
          >
            <NavLink end to="/" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors text-base font-semibold ${isActive ? 'app-sidebar-link--active' : ''}`}>
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">grid_view</span>
                <span className="app-sidebar-label text-base">Inicio</span>
              </div>
            </NavLink>

            <details
              open={openSections.finanzas}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                setOpenSections((prev) => (prev.finanzas === isOpen ? prev : { ...prev, finanzas: isOpen }));
              }}
              className="app-sidebar-group flex flex-col gap-0.5"
            >
              <summary className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${finanzasActive ? 'app-sidebar-section--active' : ''}`}>
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">account_balance_wallet</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">Finanzas</span>
                </div>
                <span className="app-sidebar-section-chevron material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </summary>
              <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                <NavLink to="/caja" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">point_of_sale</span>
                    <span className="app-sidebar-label text-base">Caja y cobros</span>
                  </span>
                </NavLink>
                <NavLink to="/finanzas/cuotas" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">receipt_long</span>
                    <span className="app-sidebar-label text-base">Cuotas</span>
                  </span>
                </NavLink>
                <NavLink to="/resumen-financiero" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">account_balance</span>
                    <span className="app-sidebar-label text-base">Resumen financiero</span>
                  </span>
                </NavLink>
              </div>
            </details>

            <details
              open={openSections.padron}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                setOpenSections((prev) => (prev.padron === isOpen ? prev : { ...prev, padron: isOpen }));
              }}
              className="app-sidebar-group flex flex-col gap-0.5"
            >
              <summary className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${padronActive ? 'app-sidebar-section--active' : ''}`}>
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">groups</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">Padrón</span>
                </div>
                <span className="app-sidebar-section-chevron material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </summary>
              <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                <NavLink to="/padron/socios" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">person</span>
                    <span className="app-sidebar-label text-base">Socios</span>
                  </span>
                </NavLink>
                <NavLink to="/padron/jugadores" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">sports</span>
                    <span className="app-sidebar-label text-base">Jugadores</span>
                  </span>
                </NavLink>
                <NavLink to="/padron/docentes" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive || pathname.startsWith('/docentes') ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">school</span>
                    <span className="app-sidebar-label text-base">Docentes</span>
                  </span>
                </NavLink>
                <NavLink to="/padron/categorias" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive || pathname.startsWith('/categorias/') ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">sports_soccer</span>
                    <span className="app-sidebar-label text-base">Categorías</span>
                  </span>
                </NavLink>
              </div>
            </details>

            <NavLink to="/documental" className={({ isActive }) => `app-sidebar-link app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface font-medium transition-colors ${isActive ? 'app-sidebar-section--active' : ''}`}>
              <div className="flex items-center gap-space-sm">
                <span className="relative inline-flex" aria-hidden="true">
                  <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                  {alertas && (alertas.vencidos > 0 || alertas.proximos > 0) && (
                    <span className={`app-sidebar-alert-dot ${alertas.vencidos > 0 ? 'bg-error' : 'bg-amber-500'}`} />
                  )}
                </span>
                <span className="app-sidebar-label text-base font-semibold text-on-surface">Documentación</span>
              </div>
              {alertas && (alertas.vencidos > 0 || alertas.proximos > 0) && (
                <span className="app-sidebar-badges font-label-sm flex items-center gap-1">
                  <span className="sr-only">
                    {[
                      alertas.vencidos > 0 && `${alertas.vencidos} vencidos`,
                      alertas.proximos > 0 && `${alertas.proximos} por vencer`,
                    ].filter(Boolean).join(', ')}
                  </span>
                  <span className="contents" aria-hidden="true">
                  {alertas.vencidos > 0 && (
                    <StatusBadge badge={{ label: alertas.vencidos, tono: 'error', icon: 'error', hideDot: true, title: 'Vencidos' }} />
                  )}
                  {alertas.proximos > 0 && (
                    <StatusBadge badge={{ label: alertas.proximos, tono: 'alerta', icon: 'schedule', hideDot: true, title: 'Por vencer' }} />
                  )}
                  </span>
                </span>
              )}
            </NavLink>

            <details
              open={openSections.comunicaciones}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                setOpenSections((prev) => (prev.comunicaciones === isOpen ? prev : { ...prev, comunicaciones: isOpen }));
              }}
              className="app-sidebar-group flex flex-col gap-0.5"
            >
              <summary className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${comunicacionesActive ? 'app-sidebar-section--active' : ''}`}>
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">campaign</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">Comunicaciones</span>
                </div>
                <span className="app-sidebar-section-chevron material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </summary>
              <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                <NavLink end to="/comunicaciones" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">dashboard</span>
                    <span className="app-sidebar-label text-base">Panel e historial</span>
                  </span>
                </NavLink>
                <NavLink to="/comunicaciones/nuevo" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">send</span>
                    <span className="app-sidebar-label text-base">Nuevo envío</span>
                  </span>
                </NavLink>
              </div>
            </details>

            <details
              open={openSections.reportes}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                setOpenSections((prev) => (prev.reportes === isOpen ? prev : { ...prev, reportes: isOpen }));
              }}
              className="app-sidebar-group flex flex-col gap-0.5"
            >
              <summary className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${reportesActive ? 'app-sidebar-section--active' : ''}`}>
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">monitoring</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">Reportes</span>
                </div>
                <span className="app-sidebar-section-chevron material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </summary>
              <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                <NavLink to="/padron/reportes" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">groups</span>
                    <span className="app-sidebar-label text-base">Padrón</span>
                  </span>
                </NavLink>
                <NavLink to="/morosidad" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">warning</span>
                    <span className="app-sidebar-label text-base">Morosidad</span>
                  </span>
                </NavLink>
              </div>
            </details>

            <details
              open={openSections.ajustes}
              onToggle={(e) => {
                const isOpen = e.currentTarget.open;
                setOpenSections((prev) => (prev.ajustes === isOpen ? prev : { ...prev, ajustes: isOpen }));
              }}
              className="app-sidebar-group flex flex-col gap-0.5"
            >
              <summary className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${ajustesActive ? 'app-sidebar-section--active' : ''}`}>
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]" aria-hidden="true">tune</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">Ajustes</span>
                </div>
                <span className="app-sidebar-section-chevron material-symbols-outlined" aria-hidden="true">chevron_right</span>
              </summary>
              <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                <PermissionGate permission={PERMISSIONS.manageUsers}>
                  <NavLink to="/usuarios" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                    <span className="app-sidebar-subitem-main">
                      <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
                      <span className="app-sidebar-label text-base">Usuarios</span>
                    </span>
                  </NavLink>
                </PermissionGate>
                <NavLink to="/configuracion" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">settings</span>
                    <span className="app-sidebar-label text-base">Configuración</span>
                  </span>
                </NavLink>
                <PermissionGate permission={PERMISSIONS.manageAutomations}>
                  <NavLink to="/automatizaciones" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                    <span className="app-sidebar-subitem-main">
                      <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">autorenew</span>
                      <span className="app-sidebar-label text-base">Automatizaciones</span>
                    </span>
                  </NavLink>
                </PermissionGate>
              </div>
            </details>
          </nav>
        </div>
      </div>
      <div className="app-sidebar-footer">
        <button
          type="button"
          className="app-sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Fijar menú abierto' : 'Contraer menú'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Fijar menú abierto' : 'Contraer menú'}
        >
          <span className="app-sidebar-toggle-label">{collapsed ? 'Fijar menú abierto' : 'Contraer menú'}</span>
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">keyboard_double_arrow_left</span>
        </button>
      </div>
    </aside>
  );
}