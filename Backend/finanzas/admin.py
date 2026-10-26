from django.contrib import admin

from .models import (
	Beca,
	Comprobante,
	ConceptoMovimiento,
	ConfiguracionFinanciera,
	CuentaCorriente,
	Cuota,
	Imputacion,
	ItemPago,
	ItemCuota,
	MovimientoCuenta,
	Pago,
)

admin.site.register(Cuota)
admin.site.register(ItemCuota)
admin.site.register(Pago)
admin.site.register(Comprobante)
admin.site.register(CuentaCorriente)
admin.site.register(MovimientoCuenta)
admin.site.register(Imputacion)
admin.site.register(ItemPago)
admin.site.register(ConfiguracionFinanciera)
admin.site.register(Beca)
admin.site.register(ConceptoMovimiento)
