from decimal import Decimal

from django.db.models import Prefetch
from rest_framework import serializers

from .models import (
    Beca,
    Comprobante,
    ConceptoItemChoices,
    ConfiguracionFinanciera,
    CuentaCorriente,
    Cuota,
    ExclusionBeca,
    Imputacion,
    ItemPago,
    ItemCuota,
    MovimientoCuenta,
    Pago,
    TipoMovimientoChoices,
    TipoMovimientoOrigenChoices,
    EstadoCuotaChoices,
    MedioDePagoChoices,
    ModalidadMontoChoices,
)
from .services import (
    BENEFIT_DISCOUNT,
    BENEFIT_SCHOLARSHIP,
    credit_balance,
    cuota_credit_notes_summary,
    discountable_pending,
    is_surplus_movement,
    net_amount,
    parse_period,
    pending_amounts,
    receipt_detail,
    remaining_reversible_amount,
    reversed_amount_for,
    surcharge_reason,
)

CUOTA_ITEM_PREFETCHES = (
    Prefetch("items", queryset=ItemCuota.objects.select_related("beca")),
    Prefetch("items", queryset=ItemCuota.all_objects.anulados().select_related("beca"), to_attr="items_anulados"),
    Prefetch("movimiento__reversiones"),
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


class MedioPagoSerializer(serializers.Serializer):
    medio_de_pago = serializers.ChoiceField(choices=MedioDePagoChoices.choices)
    monto = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal("0.01"),
    )


class ExcedenteCorreccionSerializer(serializers.Serializer):
    monto = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    medio_de_pago = serializers.ChoiceField(choices=MedioDePagoChoices.choices, required=False, allow_null=True, default=None)
    concepto = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class NotaCreditoCuotaCorreccionSerializer(serializers.Serializer):
    cuota_id = serializers.IntegerField(min_value=1)
    monto = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    concepto = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")


class CorreccionPagoSerializer(serializers.Serializer):
    motivo = serializers.CharField(max_length=500, allow_blank=False, trim_whitespace=True)
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
    actualizar_medios = serializers.BooleanField(required=False, default=True)
    excedente = ExcedenteCorreccionSerializer(required=False, allow_null=True, default=None)
    notas_credito = NotaCreditoCuotaCorreccionSerializer(many=True, required=False, default=list)

    def validate_cuota_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("No se deben repetir cuotas.")
        return value

    def validate(self, attrs):
        total_medios = sum((medio["monto"] for medio in attrs["medios"]), start=0)
        if total_medios != attrs["monto_total"]:
            raise serializers.ValidationError({
                "medios": "La suma de los medios debe coincidir con el monto total."
            })
        return attrs


class CondonacionMoraSerializer(serializers.Serializer):
    cuota_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    autorizado_por = serializers.CharField(max_length=120, trim_whitespace=True)
    motivo = serializers.CharField(max_length=180, trim_whitespace=True)


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

    def validate_cuota_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError("No se deben repetir cuotas.")
        return value

    def validate(self, attrs):
        total_medios = sum((medio["monto"] for medio in attrs["medios"]), Decimal("0.00"))
        if total_medios != attrs["monto_total"]:
            raise serializers.ValidationError({
                "medios": "La suma de los medios debe coincidir con el monto total."
            })
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
    monto_nota_credito = serializers.SerializerMethodField()
    monto_neto = serializers.SerializerMethodField()
    notas_credito = serializers.SerializerMethodField()
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
            "monto_nota_credito",
            "monto_neto",
            "notas_credito",
            "monto_pagado",
            "saldo_pendiente",
            "saldo_sin_recargo",
        ]
        read_only_fields = fields

    def _credit_notes_info(self, obj):
        cache = self.__dict__.setdefault("_nc_cache", {})
        if obj.pk not in cache:
            cache[obj.pk] = cuota_credit_notes_summary(getattr(obj, "movimiento", None))
        return cache[obj.pk]

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

    def get_monto_nota_credito(self, obj):
        _, total_nc, _ = self._credit_notes_info(obj)
        return total_nc

    def get_monto_neto(self, obj):
        _, total_nc, _ = self._credit_notes_info(obj)
        return max(Decimal("0.00"), monto_total_cuota(obj) - total_nc)

    def get_notas_credito(self, obj):
        notes_data, _, _ = self._credit_notes_info(obj)
        return notes_data

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
        read_only_fields = ["item_cuota_id"]


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


class ComprobanteListSerializer(ComprobanteSerializer):
    socio = serializers.SerializerMethodField()

    def get_socio(self, obj):
        movement = getattr(obj.pago, "movimiento", None)
        return socio_data(movement.cuenta_corriente.socio) if movement else None


class ComprobanteDetalleSerializer(ComprobanteSerializer):
    pago_detalle = serializers.SerializerMethodField()
    reemplazado_por_numero = serializers.IntegerField(source="reemplazado_por.numero", read_only=True, default=None)
    reemplaza_a_numero = serializers.SerializerMethodField()

    class Meta(ComprobanteSerializer.Meta):
        fields = [
            "comprobante_id",
            "pago",
            "fecha_emision",
            "numero",
            "monto_total",
            "estado",
            "reemplazado_por",
            "reemplazado_por_numero",
            "reemplaza_a_numero",
            "pago_detalle",
        ]
        read_only_fields = ["comprobante_id"]

    def get_reemplaza_a_numero(self, obj):
        replaced = getattr(obj, "reemplaza_a", None)
        return replaced.numero if replaced else None

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




class CuentaCorrienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CuentaCorriente
        fields = ["cuenta_corriente_id", "socio", "saldo", "estado_cuenta_corriente"]
        read_only_fields = fields


class CuentaCorrienteEstadoSerializer(serializers.ModelSerializer):
    socio = serializers.SerializerMethodField()
    cuotas = serializers.SerializerMethodField()
    cuotas_generadas = serializers.SerializerMethodField()
    cuotas_pagas = serializers.SerializerMethodField()
    cuotas_impagas = serializers.SerializerMethodField()
    total_adeudado = serializers.SerializerMethodField()
    total_mora = serializers.SerializerMethodField()
    saldo_a_favor = serializers.SerializerMethodField()

    class Meta:
        model = CuentaCorriente
        fields = [
            "cuenta_corriente_id",
            "socio",
            "saldo",
            "saldo_a_favor",
            "estado_cuenta_corriente",
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

    def get_cuotas(self, obj):
        return CuotaSerializer(
            self._account_cuotas(obj),
            many=True,
            context={"pending": self._account_pending(obj)},
        ).data

    def get_cuotas_generadas(self, obj):
        return len(self._account_cuotas(obj))

    def get_cuotas_pagas(self, obj):
        return sum(1 for cuota in self._account_cuotas(obj) if cuota.estado_cuota == EstadoCuotaChoices.PAGA)

    def get_cuotas_impagas(self, obj):
        return sum(1 for cuota in self._account_cuotas(obj) if cuota.estado_cuota != EstadoCuotaChoices.PAGA)

    def get_total_pagado(self, obj):
        pending = self._account_pending(obj)
        return sum(
            (monto_total_cuota(cuota) - pending[cuota.pk] for cuota in self._account_cuotas(obj)),
            Decimal("0.00"),
        )

    def get_total_adeudado(self, obj):
        return sum(self._account_pending(obj).values(), Decimal("0.00"))

    def get_saldo_a_favor(self, obj):
        return credit_balance(obj)

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
    origen_manual_nombre = serializers.CharField(source="get_origen_manual_display", read_only=True)
    medio_de_pago_nombre = serializers.CharField(source="get_medio_de_pago_display", read_only=True)
    socio = serializers.SerializerMethodField()
    cuota_detalle = serializers.SerializerMethodField()
    monto_revertido = serializers.SerializerMethodField()
    saldo_reversible = serializers.SerializerMethodField()
    es_excedente = serializers.SerializerMethodField()

    class Meta:
        model = MovimientoCuenta
        fields = [
            "movimiento_cuenta_id", "numero_comprobante", "cuenta_corriente", "socio", "pago", "cuota",
            "cuota_detalle", "movimiento_revertido", "monto_revertido", "saldo_reversible", "es_excedente",
            "tipo_movimiento", "tipo_movimiento_nombre",
            "fecha", "monto", "concepto", "medio_de_pago", "medio_de_pago_nombre",
            "origen_manual", "origen_manual_nombre", "usuario",
        ]
        read_only_fields = ["movimiento_cuenta_id", "numero_comprobante"]

    def get_socio(self, obj):
        account = getattr(obj, "cuenta_corriente", None)
        return socio_data(account.socio) if account and getattr(account, "socio", None) else None

    def get_monto_revertido(self, obj):
        return reversed_amount_for(obj)

    def get_saldo_reversible(self, obj):
        return remaining_reversible_amount(obj)

    def get_es_excedente(self, obj):
        return is_surplus_movement(obj)

    def get_cuota_detalle(self, obj):
        if not obj.cuota_id or not getattr(obj, "cuota", None):
            return None
        cuota = obj.cuota
        items = [
            {
                "item_cuota_id": item.item_cuota_id,
                "concepto": item.concepto,
                "concepto_nombre": item.get_concepto_display(),
                "monto": str(item.monto),
                "es_descuento": item.es_descuento,
                "motivo": item.motivo,
            }
            for item in cuota.items.all()
        ]
        return {
            "cuota_id": cuota.cuota_id,
            "periodo": cuota.periodo,
            "estado_cuota": cuota.estado_cuota,
            "monto_total": str(obj.monto),
            "items": items,
        }


class MovimientoManualSerializer(serializers.Serializer):
    socio_id = serializers.IntegerField(min_value=1)
    tipo = serializers.ChoiceField(choices=TipoMovimientoChoices.choices)
    origen = serializers.ChoiceField(choices=TipoMovimientoOrigenChoices.choices)
    concepto = serializers.CharField(max_length=200, trim_whitespace=True)
    monto = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0.01"))
    medio_de_pago = serializers.ChoiceField(
        choices=MedioDePagoChoices.choices,
        required=False,
        allow_null=True,
        default=None,
    )
    movimiento_revertido_id = serializers.IntegerField(required=False, min_value=1, allow_null=True, default=None)

    def validate(self, attrs):
        if attrs["tipo"] == TipoMovimientoChoices.CARGO and attrs["origen"] == TipoMovimientoOrigenChoices.INGRESO_MANUAL:
            raise serializers.ValidationError({"origen": "Un cargo no puede ser un ingreso manual."})
        if attrs["tipo"] == TipoMovimientoChoices.ABONO and attrs["origen"] == TipoMovimientoOrigenChoices.EGRESO:
            raise serializers.ValidationError({"origen": "Un abono no puede ser un egreso."})
        is_surplus_refund = (
            attrs["origen"] == TipoMovimientoOrigenChoices.EGRESO
            and (attrs.get("concepto") or "").startswith("Devolución de saldo / Excedente")
        )
        if attrs["origen"] == TipoMovimientoOrigenChoices.NOTA_CREDITO:
            if attrs["tipo"] != TipoMovimientoChoices.CARGO or not attrs.get("movimiento_revertido_id"):
                raise serializers.ValidationError({
                    "movimiento_revertido_id": "La nota de crédito debe revertir un movimiento y ser un cargo."
                })
        elif is_surplus_refund:
            if not attrs.get("movimiento_revertido_id"):
                raise serializers.ValidationError({
                    "movimiento_revertido_id": "La devolución de saldo debe asociarse a un excedente registrado."
                })
        elif attrs.get("movimiento_revertido_id"):
            raise serializers.ValidationError({
                "movimiento_revertido_id": "Solo las notas de crédito o devoluciones de saldo pueden asociarse a un ingreso original."
            })
        return attrs


class ImputacionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Imputacion
        fields = "__all__"
        read_only_fields = ["imputacion_id"]


class ConfiguracionFinancieraSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionFinanciera
        exclude = ["configuracion_financiera_id"]
        read_only_fields = ["fecha_actualizacion", "usuario_actualizacion"]
        extra_kwargs = {
            "monto_cuota_social": {"min_value": Decimal("0.01")},
            "monto_cuota_deportiva": {"min_value": Decimal("0.01")},
            "dia_vencimiento_1": {"min_value": 1, "max_value": 31},
            "dia_vencimiento_2": {"min_value": 1, "max_value": 31},
            "valor_recargo_1": {"min_value": Decimal("0.00")},
            "valor_recargo_2": {"min_value": Decimal("0.00")},
        }

    def validate(self, attrs):
        def current(field):
            return attrs.get(field, getattr(self.instance, field, None))

        errors = {}
        if current("dia_vencimiento_2") < current("dia_vencimiento_1"):
            errors["dia_vencimiento_2"] = "El segundo vencimiento no puede ser anterior al primero."
        for number in (1, 2):
            if current(f"tipo_recargo_{number}") == ModalidadMontoChoices.PORCENTAJE and current(f"valor_recargo_{number}") > 100:
                errors[f"valor_recargo_{number}"] = "El porcentaje de recargo no puede superar el 100%."
        if errors:
            raise serializers.ValidationError(errors)
        return attrs


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
