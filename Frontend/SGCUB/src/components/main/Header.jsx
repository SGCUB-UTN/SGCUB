import { useAuth } from "../../auth/useAuth";
import useTheme from "../../hooks/useTheme";
import HeaderSearch from "./HeaderSearch";
import "./header.css";

const getRoleLabel = (user) => {
  if (user.roles.length > 0) return user.roles.join(", ");
  return user.is_superuser ? "Administrador" : "Sin rol";
};

export default function Header({ collapsed = false }) {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className={`app-header fixed top-0 right-0 bg-surface-container-lowest border-b border-outline-variant/30 z-40 flex flex-row flex-nowrap items-center px-6 ${collapsed ? 'app-header--collapsed' : ''}`}>
      
      <div className="app-header-search min-w-0 flex-1">
        <HeaderSearch />
      </div>

      <div className="app-header-actions ml-auto flex shrink-0 items-center gap-4">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          title={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/40 bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
            {isDark ? "light_mode" : "dark_mode"}
          </span>
        </button>

        <div className="h-6 w-px bg-outline-variant/30"></div>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-surface-container-high border border-outline-variant/40 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div className="flex flex-col text-left">
            <span className="text-base text-on-surface font-semibold leading-tight">{user.full_name}</span>
            <span className="text-sm text-primary font-medium">{getRoleLabel(user)}</span>
          </div>
        </div>
        
        <div className="h-6 w-px bg-outline-variant/30"></div>
        
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1 p-2 rounded text-on-surface-variant hover:bg-error-container hover:text-on-error-container transition-colors"
          title="Cerrar sesión"
        >
          <span className="material-symbols-outlined text-[20px]">logout</span>
          <span className="text-sm">Salir</span>
        </button>
      </div>

    </header>
  );
}