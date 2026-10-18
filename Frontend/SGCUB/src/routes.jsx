import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from './layouts/MainLayout'
import AdminLayout from './layouts/AdminLayout'
import ProtectedRoute from './auth/ProtectedRoute'
import RequirePermission from './auth/RequirePermission'
import { PERMISSIONS } from './auth/permissions'
import Login from './pages/Login'
import Principal from './pages/Principal'
import AdminPage from './pages/AdminPage'
import Socios from './pages/Socios'
import Jugadores from './pages/Jugadores'
import JugadorDetail from './pages/JugadorDetail'
import JugadorForm from './pages/JugadorForm'
import SocioDetail from './pages/SocioDetail'
import DocenteDetail from './pages/DocenteDetail'
import DocenteForm from './pages/DocenteForm'
import SocioForm from './pages/SocioForm'
import Categorias from './pages/Categorias'
import Docentes from './pages/Docentes'
import Cuotas from './pages/Cuotas'
import EstadoCuenta from './pages/EstadoCuenta'
import EnDesarrollo from './pages/EnDesarrollo'
import ResumenFinanciero from './pages/ResumenFinanciero'
import Caja from './pages/Caja'
import Morosidad from './pages/Morosidad'

import CometHub from './pages/comet/CometHub'
import CometCompeticiones from './pages/comet/CometCompeticiones'
import CometEquipos from './pages/comet/CometEquipos'
import CometPartidos from './pages/comet/CometPartidos'
import CometTablas from './pages/comet/CometTablas'
import CometInscripciones from './pages/comet/CometInscripciones'
import CometJugadores from './pages/comet/CometJugadores'
import CometLogs from './pages/comet/CometLogs'

import CategoriaDetail from './pages/CategoriaDetail'

import Usuarios from './pages/Usuarios'
import ChangePassword from './pages/ChangePassword'
import { CHANGE_PASSWORD_PATH } from './auth/paths'
import DocumentacionDashboard from './pages/DocumentacionDashboard'
import Comunicaciones from './pages/Comunicaciones'
import HistorialComunicaciones from './pages/HistorialComunicaciones'
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: CHANGE_PASSWORD_PATH,
        element: <ChangePassword />,
      },
      {
        path: '/',
        element: <MainLayout />,
        children: [
          {
            index: true,
            element: <Principal />,
          },
          {
            path: 'padron',
            children: [
              {
                index: true,
                element: <Navigate to="socios" replace />,
              },
              {
                path: 'socios',
                element: <Socios />,
              },
              {
                path: 'socios/nuevo',
                element: <SocioForm />,
              },
              {
                path: 'socios/:id',
                element: <SocioDetail />,
              },
              {
                path: 'socios/:id/editar',
                element: <SocioForm />,
              },
              {
                path: 'jugadores',
                element: <Jugadores />,
              },
              {
                path: 'jugadores/nuevo',
                element: <JugadorForm />,
              },
              {
                path: 'jugadores/:id',
                element: <JugadorDetail />,
              },
              {
                path: 'jugadores/:id/editar',
                element: <JugadorForm />,
              },
              {
                path: 'categorias',
                element: <Categorias />,
              },
              {
                path: 'docentes',
                element: <Docentes />,
              },
              {
                path: 'docentes/nuevo',
                element: <DocenteForm />,
              },
              {
                path: 'docentes/:id',
                element: <DocenteDetail />,
              },
              {
                path: 'docentes/:id/editar',
                element: <DocenteForm />,
              },
              {
                path: 'categorias/:id',
                element: <CategoriaDetail />,
              },
            ],
          },
          {
            path: 'finanzas',
            children: [
              {
                index: true,
                element: <Navigate to="cuotas" replace />,
              },
              {
                path: 'cuotas',
                element: <Cuotas />,
              },
              {
                path: 'estado-cuenta',
                element: <EstadoCuenta />,
              },
            ],
          },
          {
            path: 'resumen-financiero',
            element: <ResumenFinanciero />,
          },
          {
            path: 'morosidad',
            element: <Morosidad />,
          },
          {
            path: 'caja',
            element: <Caja />,
          },
          {
            path: 'documental',
            element: <DocumentacionDashboard />,
          },
          {
            path: 'comunicaciones',
            element: <Comunicaciones />,
          },
          {
            path: 'comunicaciones/historial',
            element: <HistorialComunicaciones />,
          },
          {
            path: 'reportes',
            element: <EnDesarrollo title="Reportes y COMET" />,
          },
          {
            path: 'administracion',
            element: <EnDesarrollo title="Administración" />,
          },
          // Secciones del rol Administrador
          {
            element: <RequirePermission permission={PERMISSIONS.manageUsers} />,
            children: [
              {
                path: 'usuarios',
                element: <Usuarios />,
              },
            ],
          },
          {
            element: <RequirePermission permission={PERMISSIONS.manageAutomations} />,
            children: [
              {
                path: 'automatizaciones',
                element: <EnDesarrollo title="Automatizaciones" />,
              },
            ],
          },
          {
            path: 'docentes',
            element: <Docentes />,
          },
          {
            path: 'docentes/nuevo',
            element: <DocenteForm />,
          },
          {
            path: 'docentes/:id',
            element: <DocenteDetail />,
          },
          {
            path: 'docentes/:id/editar',
            element: <DocenteForm />,
          },
          {
            path: 'categorias/:id',
            element: <CategoriaDetail />,
          },
          {
            path: 'comet',
            children: [
              { index: true, element: <CometHub /> },
              { path: 'competiciones', element: <CometCompeticiones /> },
              { path: 'equipos', element: <CometEquipos /> },
              { path: 'partidos', element: <CometPartidos /> },
              { path: 'tablas', element: <CometTablas /> },
              { path: 'inscripciones', element: <CometInscripciones /> },
              { path: 'jugadores', element: <CometJugadores /> },
              { path: 'logs', element: <CometLogs /> },
            ],
          },
        ],
      },
    ],

    label: 'Inicio',
    showInNavigation: false,
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      {
        index: true,
        element: <AdminPage />,
      },
    ],
    label: 'Admin',
    showInNavigation: true,
  },
    ],
  
  {
    path: '*',
    element: <h1>404 - Página no encontrada</h1>,
  }
)
