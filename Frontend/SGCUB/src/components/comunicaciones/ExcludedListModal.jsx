export default function ExcludedListModal({ isOpen, onClose, excluidos = [] }) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-on-surface/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl max-w-2xl w-full p-6 shadow-xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-error-container text-error flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">phonelink_erase</span>
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-bold text-on-surface">
                Socios Sin Contacto Validado
              </h3>
              <p className="text-xs text-on-surface-variant">
                No recibirán las notificaciones electrónicas hasta regularizar sus datos en Secretaría.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Tabla / Lista de excluidos */}
        <div className="overflow-y-auto flex-1 pr-1 border border-outline-variant/30 rounded-lg">
          {excluidos.length === 0 ? (
            <div className="p-8 text-center flex flex-col items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[32px]">
                verified
              </span>
              <p className="text-sm font-semibold text-on-surface">
                ¡Todos los socios cuentan con datos de contacto!
              </p>
              <p className="text-xs text-on-surface-variant max-w-md">
                Todos los socios registrados en la base de datos tienen al menos un correo electrónico o teléfono válido.
              </p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-outline-variant/20">
              {excluidos.map((item) => (
                <div key={item.id} className="p-3.5 flex items-center justify-between gap-4 hover:bg-surface-container-low transition-colors">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-on-surface">
                      {item.nombre}
                    </span>
                    <span className="text-xs text-on-surface-variant">
                      DNI {item.dni} • {item.categoria}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-error-container text-error border border-error/20 px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {item.motivo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pie */}
        <div className="flex items-center justify-end pt-2 border-t border-outline-variant/20">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center px-4 py-2 rounded-lg border border-outline-variant/40 bg-surface-container-lowest text-on-surface hover:bg-surface-container-low text-sm font-medium transition-colors cursor-pointer"
          >
            Entendido, cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
