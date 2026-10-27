import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { changePassword } from '../api/auth'
import { useAuth } from '../auth/useAuth'
import AuthCard from '../components/auth/AuthCard'
import PasswordField from '../components/auth/PasswordField'

const getErrorMessage = (error) => {
  const data = error.response?.data
  if (!error.response) return 'No se pudo conectar con el servidor. Intentá nuevamente.'
  const message = data?.current_password ?? data?.new_password ?? data?.detail
  if (message) return Array.isArray(message) ? message.join(' ') : String(message)
  return 'No se pudo cambiar la contraseña. Intentá nuevamente.'
}

export default function ChangePassword() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isForced = user.must_change_password
  const redirectTo = location.state?.from ?? '/'

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setIsSubmitting(true)
    try {
      await changePassword(isForced ? null : currentPassword, newPassword)
      await refreshUser()
      navigate(redirectTo, { replace: true })
    } catch (requestError) {
      setError(getErrorMessage(requestError))
      setIsSubmitting(false)
    }
  }

  return (
    <AuthCard subtitle={user.full_name}>
      <form className="w-full space-y-space-md" onSubmit={handleSubmit}>
        <div className="bg-surface-container-low text-on-surface-variant px-3 py-2.5 rounded-lg flex items-start gap-2" role="status">
          <span className="material-symbols-outlined text-primary text-title-md">{isForced ? 'lock_reset' : 'info'}</span>
          <p className="text-base">
            {isForced
              ? 'Es tu primer ingreso o tu contraseña fue reseteada. Elegí una contraseña nueva para continuar. Podés volver a usar tu DNI si lo preferís.'
              : 'Elegí tu nueva contraseña. Podés usar cualquier contraseña, incluso tu DNI.'}
          </p>
        </div>

        {!isForced && (
          <PasswordField
            id="current-password"
            label="Contraseña actual"
            autoComplete="current-password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
        )}
        <PasswordField
          id="new-password"
          label="Nueva contraseña"
          autoComplete="new-password"
          autoFocus
          value={newPassword}
          onChange={setNewPassword}
        />
        <PasswordField
          id="confirm-password"
          label="Repetir nueva contraseña"
          autoComplete="new-password"
          value={confirmation}
          onChange={setConfirmation}
        />

        {error && (
          <div
            className="bg-error-container text-on-error-container px-3 py-2.5 rounded-lg border border-error/30 flex items-center gap-2"
            role="alert"
          >
            <span className="material-symbols-outlined text-error text-title-md">error</span>
            <p className="text-body-sm font-medium">{error}</p>
          </div>
        )}

        <div className="pt-1">
          <button
            className="w-full h-11 bg-primary hover:bg-primary/90 active:scale-[0.99] text-on-primary font-headline-sm text-headline-sm rounded-lg flex items-center justify-center gap-2 shadow-md transition-all duration-200 cursor-pointer disabled:cursor-wait disabled:opacity-80"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin text-title-md">progress_activity</span>
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <span>{isForced ? 'Guardar y continuar' : 'Guardar contraseña'}</span>
                <span className="material-symbols-outlined text-title-md">arrow_forward</span>
              </>
            )}
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            className="inline-flex items-center gap-1 text-primary hover:text-on-primary-container text-body-sm font-label-lg font-medium transition-colors group"
            type="button"
            onClick={isForced ? logout : () => navigate(-1)}
          >
            <span className="material-symbols-outlined text-label-md">{isForced ? 'logout' : 'arrow_back'}</span>
            <span className="group-hover:underline">{isForced ? 'Salir' : 'Volver'}</span>
          </button>
        </div>
      </form>
    </AuthCard>
  )
}
