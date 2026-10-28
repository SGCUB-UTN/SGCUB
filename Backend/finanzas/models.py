from calendar import monthrange
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone


class EstadoCuotaChoices(models.TextChoices):
    EN_FECHA = "EnFecha", "En Fecha"
    VENCIDA_1 = "Vencida1", "Vencida (1° venc.)"
    VENCIDA_2 = "Vencida2", "Vencida (2° venc.)"
    PAGA = "Paga", "Paga"


OVERDUE_CUOTA_STATES = (EstadoCuotaChoices.VENCIDA_1, EstadoCuotaChoices.VENCIDA_2)


class ConceptoItemChoices(models.TextChoices):
    CUOTA_SOCIAL = "CuotaSocial", "Cuota Social"
    CUOTA_DEPORTIVA = "CuotaDeportiva", "Cuota Deportiva"
    INSCRIPCION = "Inscripcion", "Inscripción"
    CONDONACION_INSCRIPCION = "CondonacionInscripcion", "Condonación de inscripción"
    MORA = "Mora", "Recargo por mora"
    CONDONACION_MORA = "CondonacionMora", "Condonación de recargo por mora"
    DESCUENTO_UNICO = "DescuentoUnico", "Descuento único"
    BECA = "Beca", "Beca"
    OTRO = "Otro", "Otro"


class EstadoPagoChoices(models.TextChoices):
    ACREDITADO = "Acreditado", "Acreditado"
    ANULADO = "Anulado", "Anulado"
    PENDIENTE_VERIFICACION = "PendienteVerificacion", "Pendiente de verificacion"


class EstadoComprobanteChoices(models.TextChoices):
    VIGENTE = "Vigente", "Vigente"
    ANULADO = "Anulado", "Anulado"


class MedioDePagoChoices(models.TextChoices):
    EFECTIVO = "Efectivo", "Efectivo"
    TRANSFERENCIA = "Transferencia", "Transferencia"
    BILLETERA_VIRTUAL = "BilleteraVirtual", "Billetera Virtual"


class TipoMovimientoChoices(models.TextChoices):
    ABONO = "Abono", "Abono"
    CARGO = "Cargo", "Cargo"


class TipoMovimientoOrigenChoices(models.TextChoices):
    INGRESO_MANUAL = "IngresoManual", "Ingreso manual"
    EGRESO = "Egreso", "Egreso"
    NOTA_CREDITO = "NotaCredito", "Nota de crédito"


class ModalidadMontoChoices(models.TextChoices):
    MONTO_FIJO = "MontoFijo", "Monto fijo"
    PORCENTAJE = "Porcentaje", "Porcentaje"


class EstadoItemCuotaChoices(models.TextChoices):
    VIGENTE = "Vigente", "Vigente"
    ANULADO = "Anulado", "Anulado"


class EstadoBecaChoices(models.TextChoices):
    APLICADA = "Aplicada", "Aplicada"
    FINALIZADA = "Finalizada", "Finalizada"
    CANCELADA = "Cancelada", "Cancelada"


class EstadoCuentaCorrienteChoices(models.TextChoices):
    ACTIVO = "Activo", "Activo"
    INACTIVO = "Inactivo", "Inactivo"


class Cuota(models.Model):
    cuota_id = models.AutoField(primary_key=True)
    estado_cuota = models.CharField(
        max_length=40,
        choices=EstadoCuotaChoices.choices,
        default=EstadoCuotaChoices.EN_FECHA,
    )
    fecha_creacion = models.DateTimeField(default=timezone.now)
    fecha_venc1 = models.DateField()
    fecha_venc2 = models.DateField()
    periodo = models.CharField(max_length=20)
    recargos_aplicados = models.PositiveSmallIntegerField(default=0)

    class Meta:
        db_table = "cuota"

    def __str__(self):
        return f"Cuota {self.periodo}"


class ItemCuotaQuerySet(models.QuerySet):
    def vigentes(self):
        return self.filter(estado=EstadoItemCuotaChoices.VIGENTE)

    def anulados(self):
        return self.filter(estado=EstadoItemCuotaChoices.ANULADO)


class ItemCuotaManager(models.Manager.from_queryset(ItemCuotaQuerySet)):
    def get_queryset(self):
        return super().get_queryset().vigentes()


class ItemCuota(models.Model):
    item_cuota_id = models.AutoField(primary_key=True)
    cuota = models.ForeignKey(
        Cuota,
        on_delete=models.CASCADE,
        related_name="items",
    )
    concepto = models.CharField(
        max_length=40,
        choices=ConceptoItemChoices.choices,
        default=ConceptoItemChoices.CUOTA_SOCIAL,
    )
    es_descuento = models.BooleanField(default=False)
    fecha_aplicacion = models.DateField()
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    motivo = models.CharField(max_length=200, blank=True)
    autorizado_por = models.CharField(max_length=120, blank=True)
    beca = models.ForeignKey(
        "Beca",
        on_delete=models.PROTECT,
        related_name="items",
        null=True,
        blank=True,
    )
    vencimiento = models.PositiveSmallIntegerField(null=True, blank=True)
    estado = models.CharField(
        max_length=20,
        choices=EstadoItemCuotaChoices.choices,
        default=EstadoItemCuotaChoices.VIGENTE,
    )
    fecha_anulacion = models.DateTimeField(null=True, blank=True)
    motivo_anulacion = models.CharField(max_length=200, blank=True)
    anulado_por = models.CharField(max_length=120, blank=True)
    usuario_anulacion = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="items_cuota_anulados",
        null=True,
        blank=True,
    )

    objects = ItemCuotaManager()
    all_objects = ItemCuotaQuerySet.as_manager()

    class Meta:
        db_table = "item_cuota"
        base_manager_name = "all_objects"

    def __str__(self):
        return f"{self.concepto} - {self.monto}"


class Pago(models.Model):
    pago_id = models.AutoField(primary_key=True)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="pagos",
        null=True,
        blank=True,
    )
    estado_pago = models.CharField(
        max_length=40,
        choices=EstadoPagoChoices.choices,
        default=EstadoPagoChoices.ACREDITADO,
    )
    fecha = models.DateTimeField(default=timezone.now)
    observacion = models.CharField(max_length=200, blank=True)
    motivo_anulacion = models.TextField(blank=True)

    class Meta:
        db_table = "pago"

    def __str__(self):
        return f"Pago {self.pago_id} - {self.fecha}"


class MedioPago(models.Model):
    """Payment methods the club accepts. Disabling one keeps the payments already made with it."""

    medio_pago_id = models.AutoField(primary_key=True)
    codigo = models.CharField(max_length=40, unique=True)
    nombre = models.CharField(max_length=60, unique=True)
    activo = models.BooleanField(default=True)

    class Meta:
        db_table = "medio_pago"
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    @classmethod
    def label(cls, code):
        return cls.objects.filter(codigo=code).values_list("nombre", flat=True).first() or code


MANUAL_MOVEMENT_ORIGINS = (TipoMovimientoOrigenChoices.INGRESO_MANUAL, TipoMovimientoOrigenChoices.EGRESO)


class ConceptoMovimiento(models.Model):
    concepto_movimiento_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    origen = models.CharField(max_length=40, choices=TipoMovimientoOrigenChoices.choices)

    class Meta:
        db_table = "concepto_movimiento"
        ordering = ["concepto_movimiento_id"]
        constraints = [
            models.UniqueConstraint(fields=["nombre", "origen"], name="concepto_movimiento_unico_por_origen"),
        ]

    def __str__(self):
        return f"{self.nombre} ({self.origen})"


class ItemPago(models.Model):
    id_item_pago = models.AutoField(primary_key=True)
    # Code of a MedioPago: kept as text so historical payments survive a method being removed
    medio_de_pago = models.CharField(max_length=40)
    pago = models.ForeignKey(
        Pago,
        on_delete=models.PROTECT,
        related_name="items_pago",
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "item_pago"

    def __str__(self):
        return f"{self.medio_de_pago} - {self.monto}"


class Comprobante(models.Model):
    comprobante_id = models.AutoField(primary_key=True)
    pago = models.OneToOneField(
        Pago,
        on_delete=models.PROTECT,
        related_name="comprobante",
    )
    fecha_emision = models.DateField()
    numero = models.IntegerField(unique=True)
    monto_total = models.DecimalField(max_digits=10, decimal_places=2)
    estado = models.CharField(
        max_length=20,
        choices=EstadoComprobanteChoices.choices,
        default=EstadoComprobanteChoices.VIGENTE,
    )
    reemplazado_por = models.OneToOneField(
        "self",
        on_delete=models.PROTECT,
        related_name="reemplaza_a",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "comprobante"

    def __str__(self):
        return f"Comprobante {self.numero}"


class SecuenciaComprobante(models.Model):
    secuencia_comprobante_id = models.AutoField(primary_key=True)
    ultimo_numero = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = "secuencia_comprobante"

    def __str__(self):
        return f"Último comprobante {self.ultimo_numero}"


class CuentaCorriente(models.Model):
    cuenta_corriente_id = models.AutoField(primary_key=True)
    socio = models.OneToOneField(
        "padron.Socio",
        on_delete=models.PROTECT,
        related_name="cuenta_corriente",
    )
    saldo = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estado_cuenta_corriente = models.CharField(
        max_length=40,
        choices=EstadoCuentaCorrienteChoices.choices,
        default=EstadoCuentaCorrienteChoices.ACTIVO,
    )

    class Meta:
        db_table = "cuenta_corriente"

    def __str__(self):
        return f"Cuenta corriente de {self.socio}"

    @property
    def cuotas(self):
        return Cuota.objects.filter(movimiento__cuenta_corriente=self)


class MovimientoCuenta(models.Model):
    movimiento_cuenta_id = models.AutoField(primary_key=True)
    cuenta_corriente = models.ForeignKey(
        CuentaCorriente,
        on_delete=models.PROTECT,
        related_name="movimientos",
    )
    pago = models.OneToOneField(
        Pago,
        on_delete=models.PROTECT,
        related_name="movimiento",
        null=True,
        blank=True,
    )
    cuota = models.OneToOneField(
        Cuota,
        on_delete=models.CASCADE,
        related_name="movimiento",
        null=True,
        blank=True,
    )
    movimiento_revertido = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        related_name="reversiones",
        related_query_name="reversion",
        null=True,
        blank=True,
    )
    medio_de_pago = models.CharField(
        max_length=40,
        choices=MedioDePagoChoices.choices,
        null=True,
        blank=True,
    )
    origen_manual = models.CharField(
        max_length=40,
        choices=TipoMovimientoOrigenChoices.choices,
        null=True,
        blank=True,
    )
    numero_comprobante = models.PositiveIntegerField(
        unique=True,
        null=True,
        blank=True,
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="movimientos_financieros",
        null=True,
        blank=True,
    )
    tipo_movimiento = models.CharField(
        max_length=40,
        choices=TipoMovimientoChoices.choices,
        default=TipoMovimientoChoices.ABONO,
    )
    fecha = models.DateTimeField()
    monto = models.DecimalField(max_digits=10, decimal_places=2)
    concepto = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "movimiento_cuenta"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(cuota__isnull=False, pago__isnull=True, movimiento_revertido__isnull=True)
                    | models.Q(cuota__isnull=True, pago__isnull=False, movimiento_revertido__isnull=True)
                    | models.Q(cuota__isnull=True, pago__isnull=True, movimiento_revertido__isnull=False)
                    | models.Q(cuota__isnull=True, pago__isnull=True, movimiento_revertido__isnull=True)
                ),
                name="movimiento_cuenta_single_origin",
            ),
        ]

    def __str__(self):
        return f"{self.tipo_movimiento} - {self.monto}"


class Imputacion(models.Model):
    imputacion_id = models.AutoField(primary_key=True)
    movimiento_origen = models.ForeignKey(
        MovimientoCuenta,
        on_delete=models.PROTECT,
        related_name="imputaciones_origen",
    )
    movimiento_destino = models.ForeignKey(
        MovimientoCuenta,
        on_delete=models.PROTECT,
        related_name="imputaciones_destino",
    )
    fecha = models.DateTimeField()
    monto_aplicado = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "imputacion"

    def __str__(self):
        return f"Imputación {self.imputacion_id}"


class DetalleImputacion(models.Model):
    detalle_imputacion_id = models.AutoField(primary_key=True)
    imputacion = models.ForeignKey(
        Imputacion,
        on_delete=models.PROTECT,
        related_name="detalles",
    )
    concepto = models.CharField(max_length=40, choices=ConceptoItemChoices.choices)
    monto = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        db_table = "detalle_imputacion"

    def __str__(self):
        return f"{self.concepto} - {self.monto}"


# The first version applies "since always": any period sorts after it.
INITIAL_CONFIGURATION_PERIOD = "2000-01"


def period_key(period=None):
    if period is None:
        return timezone.localdate().strftime("%Y-%m")
    if hasattr(period, "strftime"):
        return period.strftime("%Y-%m")
    return str(period).strip()[:7]


# Cuota parameters that only change from a given period on
CONFIGURATION_FIELDS = (
    "monto_inscripcion",
    "monto_cuota_social",
    "monto_cuota_deportiva",
    "dia_vencimiento_1",
    "dia_vencimiento_2",
    "tipo_recargo_1",
    "valor_recargo_1",
    "tipo_recargo_2",
    "valor_recargo_2",
    "dia_generacion",
)


class ConfiguracionFinanciera(models.Model):
    """One version of the cuota parameters. Each version applies from `periodo_vigencia` on."""

    configuracion_financiera_id = models.AutoField(primary_key=True)
    periodo_vigencia = models.CharField(max_length=7, default=INITIAL_CONFIGURATION_PERIOD)
    monto_inscripcion = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1000.00"))
    monto_cuota_social = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1000.00"))
    monto_cuota_deportiva = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("1500.00"))
    dia_vencimiento_1 = models.PositiveSmallIntegerField(default=10)
    dia_vencimiento_2 = models.PositiveSmallIntegerField(default=20)
    # Day of the month the scheduled task generates that month's cuotas
    dia_generacion = models.PositiveSmallIntegerField(default=1)
    tipo_recargo_1 = models.CharField(
        max_length=20,
        choices=ModalidadMontoChoices.choices,
        default=ModalidadMontoChoices.MONTO_FIJO,
    )
    valor_recargo_1 = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    tipo_recargo_2 = models.CharField(
        max_length=20,
        choices=ModalidadMontoChoices.choices,
        default=ModalidadMontoChoices.MONTO_FIJO,
    )
    valor_recargo_2 = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    fecha_creacion = models.DateTimeField(default=timezone.now)
    cuotas_actualizadas = models.PositiveIntegerField(default=0)
    # Person who authorized the version, chosen when saving; `usuario_creacion` is who was logged in
    responsable = models.CharField(max_length=120, blank=True)
    usuario_creacion = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="configuraciones_financieras",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "configuracion_financiera"
        ordering = ["-periodo_vigencia", "-pk"]

    def __str__(self):
        return f"Configuración financiera desde {self.periodo_vigencia}"

    @classmethod
    def load(cls, period=None):
        """The version in force for `period` (current period by default): the latest one created for the
        most recent periodo_vigencia that is not after it."""
        version = cls.objects.filter(periodo_vigencia__lte=period_key(period)).order_by("-periodo_vigencia", "-pk").first()
        return version or cls.objects.order_by("periodo_vigencia", "pk").first() or cls.objects.create()

    def parameters(self):
        return {field: getattr(self, field) for field in CONFIGURATION_FIELDS}

    def previous_version(self):
        """The version that was in force for this one's period before it was created."""
        return (
            ConfiguracionFinanciera.objects.filter(periodo_vigencia__lte=self.periodo_vigencia, pk__lt=self.pk)
            .order_by("-periodo_vigencia", "-pk")
            .first()
        )

    def surcharge(self, due_number, base_amount):
        kind, value = (
            (self.tipo_recargo_1, self.valor_recargo_1)
            if due_number == 1
            else (self.tipo_recargo_2, self.valor_recargo_2)
        )
        if kind == ModalidadMontoChoices.PORCENTAJE:
            return (base_amount * value / Decimal("100")).quantize(Decimal("0.01"))
        return value


class Beca(models.Model):
    beca_id = models.AutoField(primary_key=True)
    socio = models.ForeignKey(
        "padron.Socio",
        on_delete=models.PROTECT,
        related_name="becas",
    )
    concepto = models.CharField(
        max_length=40,
        choices=ConceptoItemChoices.choices,
        null=True,
        blank=True,
    )
    monto = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    porcentaje = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    fecha_aplicacion = models.DateField()
    fecha_fin = models.DateField(null=True, blank=True)
    motivo = models.CharField(max_length=200)
    autorizado_por = models.CharField(max_length=120, blank=True)
    fecha_creacion = models.DateTimeField(default=timezone.now)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="becas_asignadas",
        null=True,
        blank=True,
    )
    estado = models.CharField(
        max_length=20,
        choices=EstadoBecaChoices.choices,
        default=EstadoBecaChoices.APLICADA,
    )
    fecha_cancelacion = models.DateTimeField(null=True, blank=True)
    motivo_cancelacion = models.CharField(max_length=200, blank=True)
    cancelado_por = models.CharField(max_length=120, blank=True)
    usuario_cancelacion = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="becas_canceladas",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "beca"
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(monto__isnull=False, porcentaje__isnull=True)
                    | models.Q(monto__isnull=True, porcentaje__isnull=False)
                ),
                name="beca_monto_o_porcentaje",
            ),
            models.CheckConstraint(
                condition=models.Q(fecha_fin__isnull=True) | models.Q(fecha_fin__gte=models.F("fecha_aplicacion")),
                name="beca_fecha_fin_posterior_a_alta",
            ),
        ]

    def __str__(self):
        return f"Beca {self.beca_id} - {self.socio}"

    def covers_period(self, first_day):
        last_day = first_day.replace(day=monthrange(first_day.year, first_day.month)[1])
        return self.fecha_aplicacion <= last_day and (self.fecha_fin is None or self.fecha_fin >= first_day)

    def discount_for(self, base_amount):
        if self.porcentaje is not None:
            amount = (base_amount * self.porcentaje / Decimal("100")).quantize(Decimal("0.01"))
        else:
            amount = self.monto
        return max(min(amount, base_amount), Decimal("0.00"))


class ExclusionBeca(models.Model):
    exclusion_beca_id = models.AutoField(primary_key=True)
    beca = models.ForeignKey(
        Beca,
        on_delete=models.PROTECT,
        related_name="exclusiones",
    )
    periodo = models.CharField(max_length=20)
    motivo = models.CharField(max_length=200)
    autorizado_por = models.CharField(max_length=120)
    fecha_creacion = models.DateTimeField(default=timezone.now)
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="exclusiones_beca",
        null=True,
        blank=True,
    )

    class Meta:
        db_table = "exclusion_beca"
        constraints = [
            models.UniqueConstraint(fields=["beca", "periodo"], name="exclusion_beca_unica_por_periodo"),
        ]

    def __str__(self):
        return f"Exclusión de beca {self.beca_id} - {self.periodo}"


class TipoTareaCuotaChoices(models.TextChoices):
    GENERACION = "Generacion", "Generación de cuotas"
    RECARGO_1 = "Recargo1", "Recargo por 1° vencimiento"
    RECARGO_2 = "Recargo2", "Recargo por 2° vencimiento"


class OrigenEjecucionChoices(models.TextChoices):
    AUTOMATICA = "Automatica", "Automática"
    MANUAL = "Manual", "Manual"


class EjecucionTareaCuota(models.Model):
    ejecucion_id = models.AutoField(primary_key=True)
    tipo = models.CharField(max_length=20, choices=TipoTareaCuotaChoices.choices)
    periodo = models.CharField(max_length=7)
    fecha_inicio = models.DateTimeField(default=timezone.now)
    fecha_fin = models.DateTimeField(null=True, blank=True)
    origen = models.CharField(
        max_length=20,
        choices=OrigenEjecucionChoices.choices,
        default=OrigenEjecucionChoices.AUTOMATICA,
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="ejecuciones_tareas_cuota",
        null=True,
        blank=True,
    )
    exitosa = models.BooleanField(default=True)
    resumen = models.CharField(max_length=300, blank=True)
    metricas = models.JSONField(default=dict, blank=True)
    registro = models.TextField(blank=True, default="")

    class Meta:
        db_table = "ejecucion_tarea_cuota"
        ordering = ["-fecha_inicio", "-ejecucion_id"]
        indexes = [models.Index(fields=["periodo", "tipo"], name="ejecucion_tarea_periodo_tipo")]

    def __str__(self):
        return f"{self.get_tipo_display()} {self.periodo}"
