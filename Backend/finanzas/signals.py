from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from padron.models import Socio
from .services import create_first_cuota
from .models import CuentaCorriente, EstadoCuentaCorrienteChoices


def account_state_for(socio):
    if socio.is_inactive:
        return EstadoCuentaCorrienteChoices.INACTIVO
    return EstadoCuentaCorrienteChoices.ACTIVO


def create_first_cuota_after_account_creation(socio_id):
    create_first_cuota(Socio.objects.get(pk=socio_id))


@receiver(post_save, sender=Socio)
def sync_current_account(sender, instance, created, raw=False, **kwargs):
    if raw:
        return
    state = account_state_for(instance)
    if created:
        _, account_created = CuentaCorriente.objects.get_or_create(
            socio=instance,
            defaults={"estado_cuenta_corriente": state},
        )
        if account_created:
            transaction.on_commit(
                lambda socio_id=instance.pk: create_first_cuota_after_account_creation(socio_id)
            )
        return
    CuentaCorriente.objects.filter(socio=instance).exclude(estado_cuenta_corriente=state).update(
        estado_cuenta_corriente=state,
    )
