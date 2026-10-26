from calendar import monthrange
from decimal import Decimal

from django.db.models import Q

from padron.models import ESTADO_ADMINISTRATIVO_ACTIVO, ESTADO_DEPORTIVO_ACTIVO

from .models import Beca, ConceptoItemChoices, ConfiguracionFinanciera, EstadoBecaChoices, ItemCuota

PERIOD_FORMAT = "%Y-%m"


def benefit_reason(reason):
    return reason[:200]


def period_bounds(first_day):
    return first_day, first_day.replace(day=monthrange(first_day.year, first_day.month)[1])


def scholarships_for_period(first_day):
    start, end = period_bounds(first_day)
    return (
        Beca.objects.exclude(estado=EstadoBecaChoices.CANCELADA)
        .filter(fecha_aplicacion__lte=end)
        .filter(Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=start))
        .exclude(exclusiones__periodo=start.strftime(PERIOD_FORMAT))
        .order_by("fecha_aplicacion", "pk")
    )


class GeneradorItemsCuota:
    def __init__(self, socio, application_date, configuration=None):
        self.socio = socio
        self.application_date = application_date
        self.configuration = configuration or ConfiguracionFinanciera.load(application_date)

    def build_items(self):
        if not self._is_member_active():
            return []

        items = [self._item(ConceptoItemChoices.CUOTA_SOCIAL, self.configuration.monto_cuota_social)]
        if self._is_player_active():
            items.append(self._item(ConceptoItemChoices.CUOTA_DEPORTIVA, self.configuration.monto_cuota_deportiva))
        items.extend(self._benefit_items(items))
        return items

    def _is_member_active(self):
        return self.socio.estado_administrativo.nombre.casefold() == ESTADO_ADMINISTRATIVO_ACTIVO.casefold()

    def _is_player_active(self):
        player = getattr(self.socio, "jugador", None)
        return player is not None and player.estado.nombre.casefold() == ESTADO_DEPORTIVO_ACTIVO.casefold()

    def _benefit_items(self, items):
        available = sum((item.monto for item in items), Decimal("0.00"))
        base = available
        benefits = []
        for scholarship in self._scholarships():
            amount = min(scholarship.discount_for(base), available)
            if amount <= 0:
                continue
            benefits.append(self._item(
                ConceptoItemChoices.BECA,
                amount,
                is_discount=True,
                reason=benefit_reason(scholarship.motivo),
                authorized_by=scholarship.autorizado_por,
                scholarship=scholarship,
            ))
            available -= amount
        return benefits

    def _scholarships(self):
        prefetched = getattr(self.socio, "becas_del_periodo", None)
        if prefetched is not None:
            return prefetched
        return scholarships_for_period(self.application_date).filter(socio=self.socio)

    def _item(self, concept, amount, is_discount=False, reason="", authorized_by="", scholarship=None):
        return ItemCuota(
            concepto=concept,
            es_descuento=is_discount,
            fecha_aplicacion=self.application_date,
            monto=amount,
            motivo=reason,
            autorizado_por=authorized_by,
            beca=scholarship,
        )
