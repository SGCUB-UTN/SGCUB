// src/layouts/MainLayout.jsx
import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import Sidebar from '../components/main/Sidebar';
import Header from '../components/main/Header';
import AssignBenefitProvider from '../components/finanzas/AssignBenefitProvider';
import RegisterPaymentProvider from '../components/finanzas/RegisterPaymentProvider';
import RevertPaymentProvider from '../components/finanzas/RevertPaymentProvider';
import usePageTitle from '../hooks/usePageTitle';
import './main-layout.css';

const SIDEBAR_STORAGE_KEY = 'sgcub.sidebarContraido';

const leerContraido = () => {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

export default function MainLayout() {
  usePageTitle();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(leerContraido);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [sidebarDesplegado, setSidebarDesplegado] = useState(false);
  const mobile = useMediaQuery('(max-width: 1023px)', false, { getInitialValueInEffect: false });
  const menuAbierto = mobile && menuMovilAbierto;
  const contraido = !mobile && sidebarCollapsed;

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const cerrarConEscape = (event) => event.key === 'Escape' && setMenuMovilAbierto(false);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', cerrarConEscape);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener('keydown', cerrarConEscape);
    };
  }, [menuAbierto]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0');
    } catch {
      return;
    }
  }, [sidebarCollapsed]);

  return (
    <AssignBenefitProvider>
      <RegisterPaymentProvider>
        <RevertPaymentProvider>
          <div className={`main-layout ${contraido ? 'main-layout--collapsed' : ''}`}>
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-on-primary focus:text-base focus:font-semibold focus:shadow-md"
            >
              Saltar al contenido
            </a>
            <Sidebar
              collapsed={contraido}
              onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
              onPeekChange={setSidebarDesplegado}
              mobile={mobile}
              mobileOpen={menuAbierto}
              onNavigate={() => setMenuMovilAbierto(false)}
            />
            {menuAbierto && (
              <div className="app-sidebar-scrim" aria-hidden="true" onClick={() => setMenuMovilAbierto(false)} />
            )}
            <div className="main-layout-content">
              <Header
                collapsed={contraido}
                peek={contraido && sidebarDesplegado}
                mobile={mobile}
                menuOpen={menuAbierto}
                onMenuToggle={() => setMenuMovilAbierto((abierto) => !abierto)}
              />
              <main id="contenido" tabIndex={-1} className="main-layout-main focus:outline-none">
                <Outlet />
              </main>
            </div>
          </div>
        </RevertPaymentProvider>
      </RegisterPaymentProvider>
    </AssignBenefitProvider>
  );
}