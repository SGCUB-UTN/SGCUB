import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "@mantine/core";
import { useAuth } from "../../auth/useAuth";
import useTheme from "../../hooks/useTheme";
import useRegisterPayment from "../../hooks/useRegisterPayment";
import OtroMovimientoModal from "../finanzas/OtroMovimientoModal";
import { notifyCajaChanged } from "../finanzas/cajaEvents";
import { PrimaryButton, SecondaryButton } from "../personas/tabs/parts";
import HeaderSearch from "./HeaderSearch";
import "./header.css";

const getRoleLabel = (user) => {
  if (!user) return "";
  if (user.roles?.length > 0) return user.roles.join(", ");
  return user.is_superuser ? "Administrador" : "Sin rol";
};

const getInitials = (fullName = "") =>
  fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

export default function Header({ collapsed = false, mobile = false, menuOpen = false, onMenuToggle }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpened, setMenuOpened] = useState(false);
  const [movimientoAbierto, setMovimientoAbierto] = useState(false);
  const { openPayment } = useRegisterPayment();

  return (
    <header className={`app-header fixed top-0 right-0 z-40 bg-surface-container-lowest flex flex-row flex-nowrap items-stretch ${collapsed ? 'app-header--collapsed' : ''}`}>
      {mobile && (
        <button
          type="button"
          className="app-header-menu-button"
          onClick={onMenuToggle}
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          <span className="material-symbols-outlined text-[24px]" aria-hidden="true">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      )}
      <div className="app-header-brand">
        <Link to="/" className="app-header-brand-inner" aria-label="Ir al inicio">
          <img alt="Escudo C.U.B." className="app-header-logo object-contain shrink-0" src="/escudo-sin-fondo.png" />
          <div className="app-header-brand-copy">
            <span className="app-header-brand-name text-on-surface">C.U.B.</span>
            <span className="app-header-brand-subtitle text-on-surface-variant">Club Univ. de Berisso</span>
          </div>
        </Link>
      </div>

      <div className="app-header-main border-b border-outline-variant/30 flex min-w-0 flex-1 flex-row flex-nowrap items-center px-6">
        <div className="app-header-search min-w-0 flex-1">
          <HeaderSearch />
        </div>

        <div className="app-header-actions ml-auto flex shrink-0 items-center">
          {user && (
            <div className="flex items-center gap-2 ml-2">
              <PrimaryButton icon="payments" title="Registrar pago" onClick={() => openPayment({ onSuccess: notifyCajaChanged })}>
                <span className="max-xl:sr-only">Pagar</span>
              </PrimaryButton>
              <SecondaryButton icon="swap_horiz" title="Otros movimientos" onClick={() => setMovimientoAbierto(true)}>
                <span className="max-xl:sr-only">Otro movimiento
                </span>
              </SecondaryButton>
            </div>
          )}
          {user && (
            <Menu
              opened={menuOpened}
              onChange={setMenuOpened}
              trigger="click"
              position="bottom-end"
              shadow="md"
              width={240}
              withinPortal
            >
              <Menu.Target>
                <button
                  type="button"
                  aria-label="Menú de usuario"
                  aria-expanded={menuOpened}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-outline-variant/30 hover:bg-surface-container-low transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="w-9 h-9 rounded-[9999px] bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-on-surface-variant text-sm font-semibold shrink-0" aria-hidden="true">
                    {getInitials(user.full_name) || <span className="material-symbols-outlined text-[20px]">person</span>}
                  </div>
                  <div className="hidden sm:flex flex-col text-left min-w-0 max-w-[200px]">
                    <span className="text-base text-on-surface font-semibold leading-tight truncate">{user.full_name}</span>
                    <span className="text-sm text-on-surface-variant truncate">{getRoleLabel(user)}</span>
                  </div>
                  <span
                    className={`material-symbols-outlined text-on-surface-variant text-[18px] transition-transform duration-200 ${menuOpened ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  >
                    expand_more
                  </span>
                </button>
              </Menu.Target>

              <Menu.Dropdown className="p-1 min-w-[220px]">
                <div className="px-3 py-2 border-b border-outline-variant/20 mb-1">
                  <p className="text-base font-semibold text-on-surface truncate">{user.full_name}</p>
                  <p className="text-sm text-on-surface-variant truncate">{user.email || getRoleLabel(user)}</p>
                </div>

                <Menu.Item
                  icon={
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">
                      {isDark ? "light_mode" : "dark_mode"}
                    </span>
                  }
                  onClick={toggleTheme}
                >
                  <span className="text-base text-on-surface">
                    {isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  </span>
                </Menu.Item>

                <Menu.Divider />

                <Menu.Item
                  color="red"
                  icon={
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
                      logout
                    </span>
                  }
                  onClick={logout}
                >
                  <span className="text-base font-medium">Cerrar sesión</span>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </div>
      </div>

      <OtroMovimientoModal
        opened={movimientoAbierto}
        onClose={() => setMovimientoAbierto(false)}
        onSuccess={notifyCajaChanged}
      />
    </header>
  );
}
