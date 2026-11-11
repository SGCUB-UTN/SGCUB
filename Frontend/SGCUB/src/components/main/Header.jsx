import { useState } from "react";
import { Link } from "react-router-dom";
import { Menu } from "@mantine/core";
import { useAuth } from "../../auth/useAuth";
import useTheme from "../../hooks/useTheme";
import HeaderSearch from "./HeaderSearch";
import "./header.css";

const getRoleLabel = (user) => {
  if (!user) return "";
  if (user.roles?.length > 0) return user.roles.join(", ");
  return user.is_superuser ? "Administrador" : "Sin rol";
};

export default function Header({ collapsed = false }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpened, setMenuOpened] = useState(false);

  return (
    <header className={`app-header fixed top-0 right-0 z-40 bg-surface-container-lowest flex flex-row flex-nowrap items-stretch ${collapsed ? 'app-header--collapsed' : ''}`}>
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
            <Menu
              opened={menuOpened}
              onChange={setMenuOpened}
              trigger="hover"
              openDelay={100}
              closeDelay={200}
              position="bottom-end"
              shadow="md"
              width={240}
              withinPortal
            >
              <Menu.Target>
                <button
                  type="button"
                  onClick={() => setMenuOpened((prev) => !prev)}
                  aria-label="Menú de usuario"
                  aria-expanded={menuOpened}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-outline-variant/30 hover:bg-surface-container-low transition-colors cursor-pointer text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary shrink-0">
                    <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person</span>
                  </div>
                  <div className="hidden sm:flex flex-col text-left min-w-0 max-w-[180px]">
                    <span className="text-sm text-on-surface font-semibold leading-tight truncate">{user.full_name}</span>
                    <span className="text-xs text-primary font-medium truncate">{getRoleLabel(user)}</span>
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
                  <p className="text-sm font-semibold text-on-surface truncate">{user.full_name}</p>
                  <p className="text-xs text-on-surface-variant truncate">{user.email || getRoleLabel(user)}</p>
                </div>

                <Menu.Item
                  icon={
                    <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">
                      {isDark ? "light_mode" : "dark_mode"}
                    </span>
                  }
                  onClick={toggleTheme}
                >
                  <span className="text-sm text-on-surface">
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
                  <span className="text-sm font-medium">Cerrar sesión</span>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
        </div>
      </div>
    </header>
  );
}
