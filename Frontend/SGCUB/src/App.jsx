import { RouterProvider } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import ToastProvider from './components/shared/ToastProvider'
import { router } from './routes'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <RouterProvider router={router} />
      </ToastProvider>
    </AuthProvider>
  )
}

export default App
