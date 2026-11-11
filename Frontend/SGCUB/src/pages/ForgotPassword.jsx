import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../api/auth'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(err.response?.data?.detail || 'No se pudo procesar la solicitud.')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm">
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-primary text-[32px]">mark_email_read</span>
          <h1 className="text-xl font-bold text-on-surface">Revisá tu correo</h1>
        </div>
        <p className="text-base text-on-surface-variant">
          Si <strong>{email}</strong> está registrado en el sistema, vas a recibir un enlace
          para restablecer tu contraseña en los próximos minutos.
        </p>
        <p className="text-sm text-on-surface-variant mt-3">
          Si no lo ves, revisá la carpeta de spam.
        </p>
        <Link
          to="/login"
          className="inline-block mt-6 text-primary hover:underline text-sm font-semibold"
        >
          Volver al inicio de sesión
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-16 p-6 bg-surface-container-lowest rounded-xl border border-outline-variant/40 shadow-sm">
      <h1 className="text-xl font-bold text-on-surface mb-2">Recuperar contraseña</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Ingresá tu correo electrónico y te enviaremos un enlace para restablecerla.
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-semibold text-on-surface">Correo electrónico</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
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
              Enviando...
            </>
          ) : (
            'Enviar enlace'
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