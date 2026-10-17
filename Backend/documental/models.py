from django.db import models
from django.core.validators import FileExtensionValidator
from django.utils import timezone
from padron.models import Persona

class TipoDocumento(models.Model):
    id_tipo_documento = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        db_table = "tipo_documento"

    def __str__(self):
        return self.nombre


class EstadoDocumento(models.Model):
    id_estado_documento = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=20)

    class Meta:
        db_table = "estado_documento"

    def __str__(self):
        return self.nombre


def get_upload_path(instance, filename):
    persona = instance.persona
    dni = persona.dni
    nombre = f"{persona.nombre}_{persona.apellido}".replace(" ", "_")
    # Check if persona has docente relation
    if hasattr(persona, 'docente'):
        tipo = 'docentes'
    else:
        tipo = 'jugadores'
    return f'{tipo}/{dni}-{nombre}/{filename}'

class Documento(models.Model):
    id_documento = models.AutoField(primary_key=True)
    tipo_documento = models.ForeignKey(TipoDocumento, on_delete=models.PROTECT, related_name='documentos')
    estado_documento = models.ForeignKey(EstadoDocumento, on_delete=models.PROTECT, related_name='documentos')
    persona = models.ForeignKey(Persona, on_delete=models.CASCADE, related_name='documentos')
    archivoUrl = models.FileField(upload_to=get_upload_path, max_length=200, blank=True, null=True, validators=[FileExtensionValidator(['pdf'])])
    nombre = models.CharField(max_length=100)
    fecha_emision = models.DateTimeField(blank=True, null=True)
    fecha_recepcion = models.DateTimeField(blank=True, null=True)
    fecha_vencimiento = models.DateTimeField(blank=True, null=True)
    requiere_firma = models.BooleanField(default=False)

    class Meta:
        db_table = "documento"

    def __str__(self):
        return f"{self.nombre} - {self.persona}"

    def save(self, *args, **kwargs):
        self.nombre = build_nombre(self.persona.dni, self.tipo_documento.nombre, self.fecha_vencimiento)
        self.estado_documento = EstadoDocumento.objects.get(nombre=resolve_estado_nombre(self.fecha_vencimiento))
        super().save(*args, **kwargs)


def _local_date(value):
    if timezone.is_aware(value):
        value = timezone.localtime(value)
    return value.date()



def build_nombre(dni, tipo_nombre, fecha_vencimiento):
    due_date = _local_date(fecha_vencimiento).strftime('%d/%m/%Y') if fecha_vencimiento else 'Sin vencimiento'
    return f"{dni} - {tipo_nombre} - {due_date}"


def resolve_estado_nombre(fecha_vencimiento):
    if fecha_vencimiento and _local_date(fecha_vencimiento) < timezone.localdate():
        return 'Vencido'
    return 'Vigente'
