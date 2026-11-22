// src/layouts/MainLayout.jsx
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/main/Sidebar';
import Header from '../components/main/Header';
import AssignBenefitProvider from '../components/finanzas/AssignBenefitProvider';
import RegisterPaymentProvider from '../components/finanzas/RegisterPaymentProvider';
import RevertPaymentProvider from '../components/finanzas/RevertPaymentProvider';
import './main-layout.css';

export default function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <AssignBenefitProvider>
      <RegisterPaymentProvider>
        <RevertPaymentProvider>
          <div className={`main-layout ${sidebarCollapsed ? 'main-layout--collapsed' : ''}`}>
            <a
              href="#contenido"
              className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-on-primary focus:text-base focus:font-semibold focus:shadow-md"
            >
              Saltar al contenido
            </a>
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((collapsed) => !collapsed)}
            />
            <div className="main-layout-content">
              <Header collapsed={sidebarCollapsed} />
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