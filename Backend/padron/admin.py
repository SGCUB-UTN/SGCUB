from django.contrib import admin

# Register your models here.
from .models import (
    Genero, Localidad, Barrio, Domicilio, Persona, EstadoAdministrativo, Socio,
    Categoria, EstadoDeportivo, Jugador, CargoDocente, Docente,
    VinculoFamiliar, DocenteCategoria, ActualizacionCategoriasEjecucion, RecategorizacionEjecucion,
    RecategorizacionResultado,
)
admin.site.register(Genero)
admin.site.register(Localidad)
admin.site.register(Barrio)
admin.site.register(Domicilio)
admin.site.register(Persona)
admin.site.register(EstadoAdministrativo)
admin.site.register(Socio)
admin.site.register(Categoria)
admin.site.register(Jugador)
admin.site.register(EstadoDeportivo)
admin.site.register(CargoDocente)
admin.site.register(Docente)
admin.site.register(VinculoFamiliar)
admin.site.register(DocenteCategoria)
admin.site.register(ActualizacionCategoriasEjecucion)
admin.site.register(RecategorizacionEjecucion)
admin.site.register(RecategorizacionResultado)
