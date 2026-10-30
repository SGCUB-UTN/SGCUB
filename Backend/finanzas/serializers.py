import re
import unicodedata
from decimal import Decimal

from django.db.models import Prefetch
from django.utils import timezone
from rest_framework import serializers

from .generators import PERIOD_FORMAT
from .models import (
    CONFIGURATION_FIELDS,
    Beca,
    Comprobante,
    ConceptoItemChoices,
    ConceptoMovimiento,
    ConfiguracionFinanciera,
    CuentaCorriente,
    Cuota,
    DesenlaceReversionChoices,
    Devolucion,
    EjecucionTareaCuota,
    ExclusionBeca,
    Imputacion,
    ItemPago,
    ItemCuota,
    MovimientoCuenta,
    Pago,
    RegistroAuditoria,
    TipoDevolucionChoices,
    TipoMovimientoChoices,
    EstadoComprobanteChoices,
    EstadoCuotaChoices,
    EstadoPagoChoices,
    MedioPago,
    OrigenConceptoChoices,
    ModalidadMontoChoices,
)
from .services import (
    BENEFIT_DISCOUNT,
    BENEFIT_SCHOLARSHIP,
    discountable_pending,
    net_amount,
    parse_period,
    pending_amounts,
    latest_cuota_payment,
    latest_payment_cuota_ids,
    receipt_code,
    receipt_detail,
    refund_code,
    refunded_amount,
    revertible_settlement,
    surcharge_reason,
    user_name,
)

CUOTA_ITEM_PREFETCHES = (
    Prefetch("items", queryset=ItemCuota.objects.select_related("beca")),
    Prefetch("items", queryset=ItemCuota.all_objects.anulados().select_related("beca"), to_attr="items_anulados"),
)


def monto_total_cuota(cuota):
    return net_amount(cuota.items.all())


def socio_data(socio):
    return {
        "socio_id": socio.socio_id,
        "numero_socio": socio.numero_socio,
        "nombre": socio.persona.nombre,
        "apellido": socio.persona.apellido,
        "dni": socio.persona.dni,
    }


def cuota_account(cuota):
    movement = getattr(cuota, "movimiento", None)
    return movement.cuenta_corriente if movement else None


def validate_payment_method(value):
    if not MedioPago.objects.filter(codigo=value, activo=True).exists():
        raise serializers.ValidationError("El medio de pago no existe o no está habilitado.")
    return value


AMOUNT_FIELD = {"max_digits": 10, "decimal_places": 2, "min_value": Decimal("0.01")}


class MedioPagoSerializer(serializers.Serializer):
    medio_de_pago = serializers.CharField(max_length=40, validators=[validate_payment_method])
    monto = serializers.DecimalField(**AMOUNT_FIELD)


def validate_methods_total(attrs):
    total_medios = sum((medio["monto"] for medio in attrs["medios"]), Decimal("0.00"))
    if total_medios != attrs["monto_total"]:
        raise serializers.ValidationError({"medios": "La suma de los medios debe coincidir con el monto total."})
    return attrs


def payment_method_in_use(code):
    return ItemPago.objects.filter(medio_de_pago=code).exists() or Devolucion.objects.filter(medio_de_pago=code).exists()


def payment_method_code(name):
    """'Tarjeta de débito' -> 'TarjetaDeDebito'."""
    plain = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return "".join(word[:1].upper() + word[1:] for word in re.findall(r"[A-Za-z0-9]+", plain))[:40]


class MedioPagoAceptadoSerializer(serializers.ModelSerializer):
    en_uso = serializers.SerializerMethodField()

    class Meta:
        model = MedioPago
        fields = ["medio_pago_id", "codigo", "nombre", "activo", "en_uso"]
        read_only_fields = ["medio_pago_id", "codigo"]

    def get_en_uso(self, obj) -> bool:
        return payment_method_in_use(obj.codigo)

    def validate_nombre(self, value):
        value = value.strip()
        if not payment_method_code(value):
            raise serializers.ValidationError("Ingresá un nombre con letras o números.")
        others = MedioPago.objects.exclude(pk=getattr(self.instance, "pk", None))
        if others.filter(nombre__iexact=value).exists() or (
            self.instance is None and others.filter(codigo=payment_method_code(value)).exists()
        ):
            raise serializers.ValidationError("Ya existe un medio de pago con ese nombre.")
        return value

    def validate_activo(self, value):
        if self.instance and self.instance.activo and not value:
            if not MedioPago.objects.filter(activo=True).exclude(pk=self.instance.pk).exists():
                raise serializers.ValidationError("Tiene que quedar al menos un medio de pago habilitado.")
        return value

    def create(self, validated_data):
        return MedioPago.objects.create(codigo=payment_method_code(validated_data["nombre"]), **validated_data)


class CondonacionMoraSerializer(serializers.Serializer):
    cuota_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    autorizado_por = serializers.CharField(max_length=120, trim_whitespace=True)
    motivo = serializers.CharField(max_length=180, trim_whitespace=True)


class NotaCreditoSerializer(serializers.Serializer):
    monto = serializers.DecimalField(**AMOUNT_FIELD)
    medio_de_pago = serializers.CharField(max_length=40, validators=[validate_payment_method])
    motivo = serializers.CharField(max_length=200, trim_whitespace=True)
    responsable = serializers.CharField(max_length=120, trim_whitespace=True)


class NotaCreditoPagoSerializer(NotaCreditoSerializer):
    """Credit note issued together with a new payment: refunds the excess of the reverted receipt."""

    comprobante_id = serializers.IntegerField(min_value=1)


class IngresoSerializer(serializers.Serializer):
    socio_id = serializers.IntegerField(min_value=1)
    concepto = serializers.CharField(max_length=200, trim_whitespace=True)
    monto_total = serializers.DecimalField(**AMOUNT_FIELD)
    medios = MedioPagoSerializer(many=True, allow_empty=False)

    def validate(self, attrs):
        return validate_methods_total(attrs)


class ReversionPagoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500, trim_whitespace=True)
    responsable = serializers.CharField(max_length=120, trim_whitespace=True)
    desenlace = serializers.ChoiceField(choices=DesenlaceReversionChoices.choices, required=False)
    # Refund method of the credit note for the whole receipt, only for that outcome
    medio_de_pago = serializers.CharField(max_length=40, required=False, validators=[validate_payment_method])

    def validate(self, attrs):
        full_credit_note = attrs.get("desenlace") == DesenlaceReversionChoices.NOTA_CREDITO_TOTAL
        if full_credit_note and not attrs.get("medio_de_pago"):
            raise serializers.ValidationError({"medio_de_pago": "Elegí el medio de devolución de la nota de crédito."})
        if not full_credit_note and attrs.get("medio_de_pago"):
            raise serializers.ValidationError({"medio_de_pago": "El medio de devolución solo corresponde a una nota de crédito por el total."})
        return attrs


class ReversionSaldoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500, trim_whitespace=True)
    responsable = serializers.CharField(max_length=120, trim_whitespace=True)
    desenlace = serializers.ChoiceField(choices=DesenlaceReversionChoices.choices, required=False)

    def validate_desenlace(self, value):
        if value != DesenlaceReversionChoices.NUNCA_INGRESO:
            raise serializers.ValidationError(
                "La cuota se saldó con una beca o un descuento: no ingresó dinero, solo corresponde que el pago nunca ingresó."
            )
        return value


class DevolucionManualSerializer(serializers.Serializer):
    socio_id = serializers.IntegerField(min_value=1)
    concepto = serializers.CharField(max_length=200, trim_whitespace=True)
    monto = serializers.DecimalField(**AMOUNT_FIELD)
    medio_de_pago = serializers.CharField(max_length=40, validators=[validate_payment_method])
    responsable = serializers.CharField(max_length=120, trim_whitespace=True)


class RegistroPagoSerializer(serializers.Serializer):
    socio_id = serializers.IntegerField(min_value=1)
    cuota_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    monto_total = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )
    medios = MedioPagoSerializer(many=True, allow_empty=False)
    observacion = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    condonacion_mora = CondonacionMoraSerializer(required=False, allow_null=True, default=None)
    nota_credito = NotaCreditoPagoSerializer(required=False, allow_null=True, default=None)

    def validate_cuota_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("No se deben repetir cuotas.")
        return value

    def validate(self, attrs):
        validate_methods_total(attrs)
        waiver = attrs.get("condonacion_mora")
        if waiver and not set(waiver["cuota_ids"]) <= set(attrs["cuota_ids"]):
            raise serializers.ValidationError({
                "condonacion_mora": "Solo se puede condonar el recargo de las cuotas que se están pagando."
            })
        return attrs


class CuotaSerializer(serializers.ModelSerializer):
    socio = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    items_anulados = serializers.SerializerMethodField()
    monto_total = serializers.SerializerMethodField()
    monto_pagado = serializers.SerializerMethodField()
    saldo_pendiente = serializers.SerializerMethodField()
    saldo_sin_recargo = serializers.SerializerMethodField()

    class Meta:
        model = Cuota
        fields = [
            "cuota_id",
            "socio",
            "estado_cuota",
            "fecha_creacion",
            "fecha_venc1",
            "fecha_venc2",
            "periodo",
            "items",
            "items_anulados",
            "monto_total",
            "monto_pagado",
            "saldo_pendiente",
            "saldo_sin_recargo",
        ]
        read_only_fields = fields

    def get_socio(self, obj):
        account = cuota_account(obj)
        if not account:
            return None
        player = getattr(account.socio, "jugador", None)
        return {**socio_data(account.socio), "jugador_id": player.pk if player else None}

    def get_items(self, obj):
        return ItemCuotaSerializer(obj.items.all(), many=True).data

    def get_items_anulados(self, obj):
        annulled = getattr(obj, "items_anulados", None)
        if annulled is None:
            annulled = ItemCuota.all_objects.anulados().filter(cuota=obj).select_related("beca")
        return ItemCuotaSerializer(annulled, many=True).data

    def get_monto_total(self, obj):
        return monto_total_cuota(obj)

    def get_monto_pagado(self, obj):
        return monto_total_cuota(obj) - self._pending(obj)

    def get_saldo_pendiente(self, obj):
        return self._pending(obj)

    def get_saldo_sin_recargo(self, obj):
        return discountable_pending(obj, list(obj.items.all()), self._pending(obj))

    def _pending(self, obj):
        pending = self.context.get("pending")
        if pending is not None and obj.pk in pending:
            return pending[obj.pk]
        if getattr(obj, "movimiento", None) is None:
            return monto_total_cuota(obj)
        return pending_amounts([obj])[obj.pk]


def validate_due_dates(attrs, instance=None):
    first = attrs.get("fecha_venc1", getattr(instance, "fecha_venc1", None))
    second = attrs.get("fecha_venc2", getattr(instance, "fecha_venc2", None))
    if first and second and second < first:
        raise serializers.ValidationError({
            "fecha_venc2": "El segundo vencimiento no puede ser anterior al primero."
        })
    return attrs


class CuotaCreateSerializer(serializers.Serializer):
    socio_id = serializers.IntegerField(min_value=1)
    periodo = serializers.CharField(max_length=20)
    fecha_venc1 = serializers.DateField(required=False)
    fecha_venc2 = serializers.DateField(required=False)

    def validate_periodo(self, value):
        try:
            parse_period(value)
        except ValueError as error:
            raise serializers.ValidationError(str(error))
        return value

    def validate(self, attrs):
        return validate_due_dates(attrs)


class CuotaUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cuota
        fields = ["fecha_venc1", "fecha_venc2"]

    def validate(self, attrs):
        return validate_due_dates(attrs, self.instance)


def item_description(item):
    if item.concepto == ConceptoItemChoices.MORA and item.vencimiento:
        return surcharge_reason(item.vencimiento)
    if item.concepto == ConceptoItemChoices.CONDONACION_MORA and item.vencimiento:
        return f"Condonación del recargo por {item.vencimiento}° vencimiento"
    if item.concepto == ConceptoItemChoices.BECA and item.beca_id and item.beca.porcentaje is not None:
        return f"Beca {item.beca.porcentaje.normalize():f}%"
    return item.get_concepto_display()


class ItemCuotaSerializer(serializers.ModelSerializer):
    concepto_nombre = serializers.CharField(source="get_concepto_display", read_only=True)
    descripcion = serializers.SerializerMethodField()

    def get_descripcion(self, obj):
        return item_description(obj)

    class Meta:
        model = ItemCuota
        fields = "__all__"
        read_only_fields = ["item_cuota_id", "fecha_creacion"]


class PagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pago
        fields = "__all__"
        read_only_fields = ["pago_id"]


class ItemPagoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ItemPago
        fields = "__all__"
        read_only_fields = ["id_item_pago"]


class ComprobanteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Comprobante
        fields = "__all__"
        read_only_fields = ["comprobante_id"]


def annulment_data(payment):
    if payment.estado_pago != EstadoPagoChoices.ANULADO:
        return None
    return {
        "fecha": payment.fecha_anulacion,
        "motivo": payment.motivo_anulacion,
        "responsable": payment.responsable_anulacion,
        "usuario": user_display_name(payment.usuario_anulacion),
    }


class ComprobanteListSerializer(ComprobanteSerializer):
    codigo = serializers.SerializerMethodField()
    socio = serializers.SerializerMethodField()
    es_ingreso = serializers.SerializerMethodField()
    concepto = serializers.SerializerMethodField()
    monto_devuelto = serializers.SerializerMethodField()

    class Meta(ComprobanteSerializer.Meta):
        fields = [
            "comprobante_id", "pago", "codigo", "fecha_emision", "numero", "monto_total", "estado",
            "socio", "es_ingreso", "concepto", "monto_devuelto",
        ]

    def get_codigo(self, obj):
        return receipt_code(obj)

    def get_socio(self, obj):
        movement = getattr(obj.pago, "movimiento", None)
        return socio_data(movement.cuenta_corriente.socio) if movement else None

    def get_es_ingreso(self, obj):
        movement = getattr(obj.pago, "movimiento", None)
        return movement is not None and movement.tipo_movimiento == TipoMovimientoChoices.INGRESO

    def get_concepto(self, obj):
        movement = getattr(obj.pago, "movimiento", None)
        return movement.concepto if movement else ""

    def get_monto_devuelto(self, obj):
        annotated = getattr(obj, "monto_devuelto", None)
        return annotated if annotated is not None else refunded_amount(obj)


class ComprobanteDetalleSerializer(ComprobanteListSerializer):
    pago_detalle = serializers.SerializerMethodField()
    anulacion = serializers.SerializerMethodField()
    notas_credito = serializers.SerializerMethodField()
    revertible = serializers.SerializerMethodField()

    class Meta(ComprobanteListSerializer.Meta):
        fields = [*ComprobanteListSerializer.Meta.fields, "pago_detalle", "anulacion", "notas_credito", "revertible"]

    def get_revertible(self, obj):
        """An income in force can always be annulled; a payment of cuotas, only if it is the latest."""
        if obj.estado != EstadoComprobanteChoices.VIGENTE:
            return False
        movement = obj.pago.movimiento
        if movement.tipo_movimiento == TipoMovimientoChoices.INGRESO:
            return True
        latest = latest_cuota_payment(movement.cuenta_corriente)
        return latest is not None and latest.pk == obj.pago_id

    def to_representation(self, instance):
        data = super().to_representation(instance)
        detail = receipt_detail(instance)
        data.update({
            "tipo": detail["tipo"],
            "periodos": detail["periodos"],
            "desglose": detail["desglose"],
        })
        return data

    def get_pago_detalle(self, obj):
        pago = obj.pago
        detalle = PagoSerializer(pago).data
        detalle["items_pago"] = ItemPagoSerializer(pago.items_pago.all(), many=True).data
        movimiento = getattr(pago, "movimiento", None)
        detalle["socio"] = socio_data(movimiento.cuenta_corriente.socio) if movimiento else None
        return detalle

    def get_anulacion(self, obj):
        return annulment_data(obj.pago)

    def get_notas_credito(self, obj):
        return DevolucionSerializer(obj.notas_credito.order_by("pk"), many=True).data


class DevolucionSerializer(serializers.ModelSerializer):
    codigo = serializers.SerializerMethodField()
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)
    medio_de_pago_nombre = serializers.SerializerMethodField()
    socio = serializers.SerializerMethodField()
    comprobante_anulado_codigo = serializers.SerializerMethodField()
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = Devolucion
        fields = [
            "devolucion_id", "tipo", "tipo_nombre", "numero", "codigo", "fecha", "socio", "concepto", "monto",
            "medio_de_pago", "medio_de_pago_nombre", "comprobante_anulado", "comprobante_anulado_codigo",
            "responsable", "usuario", "usuario_nombre",
        ]
        read_only_fields = fields

    def get_codigo(self, obj):
        return refund_code(obj)

    def get_medio_de_pago_nombre(self, obj):
        return MedioPago.label(obj.medio_de_pago)

    def get_socio(self, obj):
        return socio_data(obj.cuenta_corriente.socio)

    def get_comprobante_anulado_codigo(self, obj):
        return receipt_code(obj.comprobante_anulado) if obj.comprobante_anulado_id else None

    def get_usuario_nombre(self, obj):
        return user_display_name(obj.usuario)


class CuentaCorrienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuentaCorriente
        fields = ["cuenta_corriente_id", "socio", "estado_cuenta_corriente"]
        read_only_fields = fields


class CuentaCorrienteEstadoSerializer(serializers.ModelSerializer):
    socio = serializers.SerializerMethodField()
    cuotas = serializers.SerializerMethodField()
    cuotas_generadas = serializers.SerializerMethodField()
    cuotas_pagas = serializers.SerializerMethodField()
    cuotas_impagas = serializers.SerializerMethodField()
    total_adeudado = serializers.SerializerMethodField()
    total_mora = serializers.SerializerMethodField()
    comprobante_revertible_id = serializers.SerializerMethodField()
    cuotas_revertibles = serializers.SerializerMethodField()
    saldo_beneficio_revertible = serializers.SerializerMethodField()

    class Meta:
        model = CuentaCorriente
        fields = [
            "cuenta_corriente_id",
            "socio",
            "estado_cuenta_corriente",
            "comprobante_revertible_id",
            "cuotas_revertibles",
            "saldo_beneficio_revertible",
            "cuotas",
            "cuotas_generadas",
            "cuotas_pagas",
            "cuotas_impagas",
            "total_pagado",
            "total_adeudado",
            "total_mora",
        ]

    total_pagado = serializers.SerializerMethodField()

    def _account_cuotas(self, obj):
        cache = self.__dict__.setdefault("_cuotas_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = list(
                obj.cuotas.select_related("movimiento__cuenta_corriente__socio__persona")
                .prefetch_related(*CUOTA_ITEM_PREFETCHES)
                .order_by("pk")
            )
        return cache[obj.pk]

    def _account_pending(self, obj):
        cache = self.__dict__.setdefault("_pending_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = pending_amounts(self._account_cuotas(obj))
        return cache[obj.pk]

    def get_socio(self, obj):
        return socio_data(obj.socio)

    def _latest_payment(self, obj):
        cache = self.__dict__.setdefault("_latest_payment_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = latest_cuota_payment(obj)
        return cache[obj.pk]

    def get_comprobante_revertible_id(self, obj):
        """Receipt of the only payment of cuotas that can be reverted: the latest one."""
        payment = self._latest_payment(obj)
        return payment.comprobante.pk if payment else None

    def get_cuotas_revertibles(self, obj):
        """Cuotas paid by that latest payment."""
        return latest_payment_cuota_ids(self._latest_payment(obj))

    def get_saldo_beneficio_revertible(self, obj):
        cuota, item = revertible_settlement(obj)
        return {"cuota_id": cuota.pk, "item_cuota_id": item.pk} if cuota else None

    def get_cuotas(self, obj):
        return CuotaSerializer(
            self._account_cuotas(obj),
            many=True,
            context={"pending": self._account_pending(obj)},
        ).data

    def _current_period(self):
        return timezone.localdate().strftime(PERIOD_FORMAT)

    def _due_cuotas(self, obj):
        current = self._current_period()
        return [cuota for cuota in self._account_cuotas(obj) if str(cuota.periodo) <= current]

    def get_cuotas_generadas(self, obj):
        return len(self._account_cuotas(obj))

    def get_cuotas_pagas(self, obj):
        return sum(1 for cuota in self._account_cuotas(obj) if cuota.estado_cuota == EstadoCuotaChoices.PAGA)

    def get_cuotas_impagas(self, obj):
        return sum(1 for cuota in self._due_cuotas(obj) if cuota.estado_cuota != EstadoCuotaChoices.PAGA)

    def get_total_pagado(self, obj):
        pending = self._account_pending(obj)
        return sum(
            (monto_total_cuota(cuota) - pending[cuota.pk] for cuota in self._account_cuotas(obj)),
            Decimal("0.00"),
        )

    def get_total_adeudado(self, obj):
        pending = self._account_pending(obj)
        return sum((pending[cuota.pk] for cuota in self._due_cuotas(obj)), Decimal("0.00"))

    def get_total_mora(self, obj):
        return sum(
            (
                -item.monto if item.es_descuento else item.monto
                for cuota in self._account_cuotas(obj)
                for item in cuota.items.all()
                if item.concepto in (ConceptoItemChoices.MORA, ConceptoItemChoices.CONDONACION_MORA)
            ),
            Decimal("0.00"),
        )


class MovimientoCuentaSerializer(serializers.ModelSerializer):
    tipo_movimiento_nombre = serializers.CharField(source="get_tipo_movimiento_display", read_only=True)
    socio = serializers.SerializerMethodField()
    comprobante = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoCuenta
        fields = [
            "movimiento_cuenta_id", "cuenta_corriente", "socio", "pago", "cuota", "comprobante",
            "tipo_movimiento", "tipo_movimiento_nombre", "fecha", "monto", "concepto", "usuario",
        ]
        read_only_fields = fields

    def get_socio(self, obj):
        return socio_data(obj.cuenta_corriente.socio)

    def get_comprobante(self, obj):
        receipt = getattr(obj.pago, "comprobante", None) if obj.pago_id else None
        if receipt is None:
            return None
        return {"comprobante_id": receipt.pk, "codigo": receipt_code(receipt), "estado": receipt.estado}


def concept_in_use(concept):
    if concept.origen == OrigenConceptoChoices.INGRESO:
        return MovimientoCuenta.objects.filter(
            tipo_movimiento=TipoMovimientoChoices.INGRESO, concepto__iexact=concept.nombre,
        ).exists()
    return Devolucion.objects.filter(tipo=TipoDevolucionChoices.MANUAL, concepto__iexact=concept.nombre).exists()


class ConceptoMovimientoSerializer(serializers.ModelSerializer):
    en_uso = serializers.SerializerMethodField()

    class Meta:
        model = ConceptoMovimiento
        fields = ["concepto_movimiento_id", "nombre", "origen", "en_uso"]
        read_only_fields = ["concepto_movimiento_id", "en_uso"]
        validators = []

    def get_en_uso(self, obj) -> bool:
        return concept_in_use(obj)

    def validate_nombre(self, value):
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Este campo es obligatorio.")
        return value


class ImputacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Imputacion
        fields = "__all__"
        read_only_fields = ["imputacion_id"]


def user_display_name(user):
    return (user.get_full_name().strip() or user.username) if user else None


class RegistroAuditoriaSerializer(serializers.ModelSerializer):
    accion_nombre = serializers.CharField(source="get_accion_display", read_only=True)
    usuario_nombre = serializers.SerializerMethodField()
    socio = serializers.SerializerMethodField()

    class Meta:
        model = RegistroAuditoria
        fields = [
            "registro_auditoria_id", "fecha", "accion", "accion_nombre", "descripcion",
            "usuario", "usuario_nombre", "responsable", "socio", "monto", "referencia", "detalle",
        ]
        read_only_fields = fields

    def get_usuario_nombre(self, obj):
        return user_display_name(obj.usuario) or "Sistema"

    def get_socio(self, obj):
        return socio_data(obj.socio) if obj.socio_id else None


class ConfiguracionFinancieraSerializer(serializers.ModelSerializer):
    usuario_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ConfiguracionFinanciera
        fields = [
            "configuracion_financiera_id",
            "periodo_vigencia",
            *CONFIGURATION_FIELDS,
            "fecha_creacion",
            "cuotas_actualizadas",
            "responsable",
            "usuario_creacion",
            "usuario_nombre",
        ]
        read_only_fields = ["configuracion_financiera_id", "fecha_creacion", "cuotas_actualizadas", "responsable", "usuario_creacion"]
        extra_kwargs = {
            "periodo_vigencia": {"required": True},
            "monto_inscripcion": {"min_value": Decimal("0.00")},
            "monto_cuota_social": {"min_value": Decimal("0.01")},
            "monto_cuota_deportiva": {"min_value": Decimal("0.01")},
            "dia_vencimiento_1": {"min_value": 1, "max_value": 28},
            "dia_vencimiento_2": {"min_value": 1, "max_value": 28},
            "dia_generacion": {"min_value": 1, "max_value": 28},
            "valor_recargo_1": {"min_value": Decimal("0.00")},
            "valor_recargo_2": {"min_value": Decimal("0.00")},
        }

    def get_usuario_nombre(self, obj) -> str | None:
        return user_display_name(obj.usuario_creacion)

    def validate_periodo_vigencia(self, value):
        try:
            period = parse_period(value).strftime(PERIOD_FORMAT)
        except ValueError as error:
            raise serializers.ValidationError(str(error)) from None
        current = timezone.localdate().strftime(PERIOD_FORMAT)
        if period <= current:
            raise serializers.ValidationError("El período de vigencia debe ser posterior al período actual.")
        return period

    def validate(self, attrs):
        def current(field):
            return attrs.get(field, getattr(self.instance, field, None))

        errors = {}
        if current("dia_vencimiento_2") < current("dia_vencimiento_1"):
            errors["dia_vencimiento_2"] = "El segundo vencimiento no puede ser anterior al primero."
        if current("dia_generacion") > current("dia_vencimiento_1"):
            errors["dia_generacion"] = "Las cuotas deben generarse antes del primer vencimiento o el mismo día."
        for number in (1, 2):
            if current(f"tipo_recargo_{number}") == ModalidadMontoChoices.PORCENTAJE and current(f"valor_recargo_{number}") > 100:
                errors[f"valor_recargo_{number}"] = "El porcentaje de recargo no puede superar el 100%."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class VersionConfiguracionFinancieraSerializer(ConfiguracionFinancieraSerializer):
    cambios = serializers.SerializerMethodField()

    class Meta(ConfiguracionFinancieraSerializer.Meta):
        fields = [*ConfiguracionFinancieraSerializer.Meta.fields, "cambios"]

    def get_cambios(self, obj) -> list:
        previous = obj.previous_version()
        if previous is None:
            return []
        return [
            {"campo": field, "anterior": str(getattr(previous, field)), "nuevo": str(getattr(obj, field))}
            for field in CONFIGURATION_FIELDS
            if getattr(previous, field) != getattr(obj, field)
        ]


class OtorgarBecaSerializer(serializers.Serializer):
    modalidad = serializers.ChoiceField(choices=ModalidadMontoChoices.choices)
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    fecha_aplicacion = serializers.DateField()
    fecha_fin = serializers.DateField(required=False, allow_null=True, default=None)
    motivo = serializers.CharField(max_length=180, trim_whitespace=True)
    autorizado_por = serializers.CharField(max_length=120, trim_whitespace=True)

    def validate(self, attrs):
        errors = {}
        if attrs["modalidad"] == ModalidadMontoChoices.PORCENTAJE and not Decimal("1") <= attrs["valor"] <= Decimal("100"):
            errors["valor"] = "El porcentaje debe estar entre 1% y 100%."
        if attrs["fecha_fin"] and attrs["fecha_fin"] < attrs["fecha_aplicacion"]:
            errors["fecha_fin"] = "La finalización no puede ser anterior a la fecha de alta del beneficio."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


class BeneficioSerializer(OtorgarBecaSerializer):
    tipo = serializers.ChoiceField(choices=[BENEFIT_SCHOLARSHIP, BENEFIT_DISCOUNT])


class EdicionDescuentoSerializer(serializers.Serializer):
    modalidad = serializers.ChoiceField(choices=ModalidadMontoChoices.choices)
    valor = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    motivo = serializers.CharField(max_length=180, trim_whitespace=True)
    autorizado_por = serializers.CharField(max_length=120, trim_whitespace=True)

    def validate(self, attrs):
        if attrs["modalidad"] == ModalidadMontoChoices.PORCENTAJE and not Decimal("1") <= attrs["valor"] <= Decimal("100"):
            raise serializers.ValidationError({"valor": "El porcentaje debe estar entre 1% y 100%."})
        return attrs


class AnulacionSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=180, trim_whitespace=True)
    autorizado_por = serializers.CharField(max_length=120, trim_whitespace=True)


class ExclusionBecaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExclusionBeca
        fields = ["exclusion_beca_id", "periodo", "motivo", "autorizado_por", "fecha_creacion"]


class BecaSerializer(serializers.ModelSerializer):
    exclusiones = ExclusionBecaSerializer(many=True, read_only=True)

    class Meta:
        model = Beca
        fields = "__all__"


class EjecucionTareaCuotaSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    origen_display = serializers.CharField(source="get_origen_display", read_only=True)
    usuario = serializers.SerializerMethodField()

    class Meta:
        model = EjecucionTareaCuota
        fields = [
            "ejecucion_id",
            "tipo",
            "tipo_display",
            "periodo",
            "fecha_inicio",
            "fecha_fin",
            "origen",
            "origen_display",
            "usuario",
            "exitosa",
            "resumen",
        ]
        read_only_fields = fields

    def get_usuario(self, obj):
        return user_name(obj.usuario) if obj.usuario_id else None


class EjecucionTareaCuotaDetalleSerializer(EjecucionTareaCuotaSerializer):
    class Meta(EjecucionTareaCuotaSerializer.Meta):
        fields = [*EjecucionTareaCuotaSerializer.Meta.fields, "metricas", "registro"]
        read_only_fields = fields
