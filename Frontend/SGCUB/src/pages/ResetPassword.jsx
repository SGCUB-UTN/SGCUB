import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { confirmPasswordReset } from '../api/auth'

export default function ResetPassword() {
  const { uid, token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      await confirmPasswordReset({ uid, token, newPassword: password })
      navigate('/login?reset=ok')
    } catch (err) {
      const data = err.response?.data
      const message =
        data?.detail
        || (Array.isArray(data?.new_password) ? data.new_password.join(' ') : null)
        || 'No se pudo restablecer la contraseña.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm">
      <h1 className="text-xl font-bold text-on-surface mb-2">Elegí una nueva contraseña</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Debe tener al menos 8 caracteres y no ser demasiado común.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-on-surface">Nueva contraseña</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-on-surface">Confirmar contraseña</span>
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-base"
          />
        </label>
        {error && <p className="text-sm text-error font-medium">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="material-symbols-outlined text-base animate-spin">
                progress_activity
              </span>
              Guardando...
            </>
          ) : (
            'Cambiar contraseña'
          )}
        </button>
      </form>
      <Link
        to="/login"
        className="inline-block mt-6 text-primary hover:underline text-sm font-semibold"
      >
        Volver al inicio de sesión
      </Link>
    </div>
  )
}