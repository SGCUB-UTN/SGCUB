import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import PermissionGate from '../../auth/PermissionGate';
import { PERMISSIONS } from '../../auth/permissions';
import { useAuth } from '../../auth/useAuth';
import StatusBadge from '../shared/StatusBadge';
import './sidebar.css';

const DURACION_CONTRAER = 220;

export default function Sidebar({ collapsed, onToggle }) {
  const { pathname } = useLocation();
  const { hasPermission } = useAuth();
  const showAdminSection = hasPermission(PERMISSIONS.manageUsers) || hasPermission(PERMISSIONS.manageAutomations);

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

  const [contrayendo, setContrayendo] = useState(false);
  const [collapsedAnterior, setCollapsedAnterior] = useState(collapsed);
  if (collapsed !== collapsedAnterior) {
    setCollapsedAnterior(collapsed);
    setContrayendo(collapsed);
  }

  useEffect(() => {
    if (!contrayendo) return undefined;
    const timer = setTimeout(() => setContrayendo(false), DURACION_CONTRAER);
    return () => clearTimeout(timer);
  }, [contrayendo]);

  const claseEstado = contrayendo ? 'app-sidebar--collapsing' : collapsed ? 'app-sidebar--collapsed' : '';
  const personasActive = ['/padron/socios', '/padron/jugadores', '/padron/docentes']
    .some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const finanzasActive = ['/finanzas', '/finanzas/cuotas', '/finanzas/estado-cuenta', '/resumen-financiero', '/morosidad', '/caja']
    .some((route) => pathname === route || pathname.startsWith(`${route}/`));
  const adminActive = ['/usuarios', '/automatizaciones']
    .some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <aside className={`app-sidebar ${claseEstado}`}>
      <div className="app-sidebar-content">
        <div className="app-sidebar-brand">
          <Link to="/" className="app-sidebar-brand-inner" aria-label="Ir al inicio">
            <img alt="Escudo C.U.B." className="app-sidebar-logo object-contain shrink-0" src="/escudo-sin-fondo.png" />
            <div className="app-sidebar-brand-copy">
              <span className="app-sidebar-brand-name text-on-surface">C.U.B.</span>
              <span className="app-sidebar-brand-subtitle text-on-surface-variant">Club Univ. Berisso</span>
            </div>
          </Link>
        </div>
        <div className="app-sidebar-scroll">
          <nav className="app-sidebar-nav">
            <NavLink end to="/" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-2 rounded transition-colors text-base font-semibold ${isActive ? 'app-sidebar-link--active' : ''}`}>
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                <span className="app-sidebar-label text-base">Inicio</span>
              </div>
            </NavLink>
            
            {/* Sección Personas */}
            <div className="flex flex-col gap-0.5">
              <div className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${personasActive ? 'app-sidebar-section--active' : ''}`}>
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]">groups</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">Personas</span>
                </div>
              </div>
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
                <NavLink to="/padron/docentes" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">school</span>
                    <span className="app-sidebar-label text-base">Docentes</span>
                  </span>
                </NavLink>
              </div>
            </div>

            {/* Sección Finanzas */}
            <div className="flex flex-col gap-0.5">
              <div className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${finanzasActive ? 'app-sidebar-section--active' : ''}`}>
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">Finanzas</span>
                </div>
              </div>
              <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                <NavLink to="/finanzas/cuotas" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">receipt_long</span>
                    <span className="app-sidebar-label text-base">Cuotas</span>
                  </span>
                </NavLink>
                <NavLink to="/finanzas/estado-cuenta" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">account_balance_wallet</span>
                    <span className="app-sidebar-label text-base">Estado de cuenta</span>
                  </span>
                </NavLink>

                <NavLink to="/resumen-financiero" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">account_balance</span>
                    <span className="app-sidebar-label text-base">Resumen financiero</span>
                  </span>
                </NavLink>
                <NavLink to="/morosidad" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">warning</span>
                    <span className="app-sidebar-label text-base">Reporte de morosidad</span>
                  </span>
                </NavLink>
                <NavLink to="/caja" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">point_of_sale</span>
                    <span className="app-sidebar-label text-base">Caja y cobros</span>
                  </span>
                </NavLink>
              </div>
            </div>

            <NavLink to="/documental" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">folder_shared</span>
                <span className="app-sidebar-label font-body-md text-body-md">Documental</span>
              </div>

              {alertas && (alertas.vencidos > 0 || alertas.proximos > 0) && (
                <span className="font-label-sm flex items-center gap-1">
                  {alertas.vencidos > 0 && (
                    <StatusBadge badge={{ label: alertas.vencidos, tono: 'error', icon: 'error', hideDot: true, title: 'Vencidos' }} />
                  )}
                  {alertas.proximos > 0 && (
                    <StatusBadge badge={{ label: alertas.proximos, tono: 'alerta', icon: 'schedule', hideDot: true, title: 'Por vencer' }} />
                  )}
                </span>
              )}
            </NavLink>
            
            <NavLink to="/padron/categorias" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">sports_soccer</span>
                <span className="app-sidebar-label font-body-md text-body-md">Categorías</span>
              </div>
            </NavLink>

            <NavLink to="/comunicaciones" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
              <div className="flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[20px]">campaign</span>
                <span className="app-sidebar-label font-body-md text-body-md">Comunicaciones</span>
              </div>
            </NavLink>

            {/* Sección COMET */}
            <div className="flex flex-col gap-0.5">
              <NavLink
                to="/comet"
                className={({ isActive }) =>
                  `app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium ${isActive ? 'app-sidebar-section--active' : ''}`
                }
              >
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[20px]">cloud_sync</span>
                  <span className="app-sidebar-label text-base font-semibold text-on-surface">COMET</span>
                </div>
              </NavLink>
              <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                <NavLink to="/comet/competiciones" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">emoji_events</span>
                    <span className="app-sidebar-label text-base">Competiciones</span>
                  </span>
                </NavLink>
                <NavLink to="/comet/equipos" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">groups_3</span>
                    <span className="app-sidebar-label text-base">Equipos</span>
                  </span>
                </NavLink>
                <NavLink to="/comet/partidos" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">sports_soccer</span>
                    <span className="app-sidebar-label text-base">Partidos</span>
                  </span>
                </NavLink>
                <NavLink to="/comet/tablas" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">leaderboard</span>
                    <span className="app-sidebar-label text-base">Tablas</span>
                  </span>
                </NavLink>
                <NavLink to="/comet/inscripciones" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">assignment</span>
                    <span className="app-sidebar-label text-base">Inscripciones</span>
                  </span>
                </NavLink>
                <NavLink to="/comet/jugadores" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">badge</span>
                    <span className="app-sidebar-label text-base">Jugadores</span>
                  </span>
                </NavLink>
                <NavLink to="/comet/logs" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                  <span className="app-sidebar-subitem-main">
                    <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">history</span>
                    <span className="app-sidebar-label text-base">Historial</span>
                  </span>
                </NavLink>
              </div>
            </div>
            {/* Sección Administración */}
            {showAdminSection && (
              <div className="flex flex-col gap-0.5">
                <hr className="app-sidebar-divider border-0 border-t border-outline-variant/40 my-2 mx-space-sm" />              

                <div className={`app-sidebar-section flex items-center justify-between px-space-sm py-2 rounded text-on-surface-variant font-medium select-none cursor-pointer ${adminActive ? 'app-sidebar-section--active' : ''}`}>
                  <div className="flex items-center gap-space-sm">
                    <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
                    <span className="app-sidebar-label text-base font-semibold text-on-surface">Administración</span>
                  </div>
                </div>
                <div className="flex flex-col gap-0.5 pl-3 border-l-2 border-outline-variant/30 ml-4 my-0.5">
                  <PermissionGate permission={PERMISSIONS.manageUsers}>
                    <NavLink to="/usuarios" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                      <span className="app-sidebar-subitem-main">
                        <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">admin_panel_settings</span>
                        <span className="app-sidebar-label text-base">Usuarios</span>
                      </span>
                    </NavLink>
                  </PermissionGate>
                  <PermissionGate permission={PERMISSIONS.manageAutomations}>
                    <NavLink to="/automatizaciones" className={({ isActive }) => `app-sidebar-link flex items-center justify-between px-space-sm py-1.5 rounded text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors ${isActive ? 'app-sidebar-link--active' : ''}`}>
                      <span className="app-sidebar-subitem-main">
                        <span className="app-sidebar-subitem-icon material-symbols-outlined" aria-hidden="true">autorenew</span>
                        <span className="app-sidebar-label text-base">Automatizaciones</span>
                      </span>
                    </NavLink>
                  </PermissionGate>
                </div>
              </div>
            )}
            
          </nav>
        </div>
      </div>
      <div className="app-sidebar-footer">
        <button
          type="button"
          className="app-sidebar-toggle"
          onClick={onToggle}
          aria-label={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
          title={collapsed ? 'Mostrar menú' : 'Ocultar menú'}
        >
          <span className="app-sidebar-toggle-label">{collapsed ? 'Mostrar menú' : 'Contraer menú'}</span>
          <span className="material-symbols-outlined text-[18px]">keyboard_double_arrow_left</span>
        </button>
        <div className="app-sidebar-version">
          <p className="font-label-sm text-label-sm text-on-surface-variant">SGCUB - Sistema Interno</p>
        </div>
      </div>
    </aside>
  );
}