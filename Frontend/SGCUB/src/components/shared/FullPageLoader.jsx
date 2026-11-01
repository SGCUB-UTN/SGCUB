// Pantalla completa de carga mientras se verifica la sesión
export default function FullPageLoader({ text = 'Verificando sesión...' }) {
  return (
    <div className="w-full min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3 text-on-surface-variant" role="status">
        <span className="material-symbols-outlined text-[28px] animate-spin" aria-hidden="true">progress_activity</span>
        <p className="text-base">{text}</p>
      </div>
    </div>
  )
}
