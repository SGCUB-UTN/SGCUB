from dataclasses import dataclass
from datetime import date, timedelta

from django.db import IntegrityError, transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    ESTADO_ADMINISTRATIVO_INACTIVO,
    ESTADO_DEPORTIVO_ACTIVO,
    Categoria,
    Jugador,
    RecategorizacionEjecucion,
    RecategorizacionResultado,
)

GENERO_PERSONA_A_CATEGORIA = {
    "Masculino": Categoria.GENERO_MASCULINO,  # "M"
    "Femenino": Categoria.GENERO_FEMENINO,    # "F"
}

YOUTH_MAX_AGE = 20
STALE_RUN_TIMEOUT = timedelta(minutes=30)

Estado = RecategorizacionEjecucion.EstadoChoices
Tipo = RecategorizacionResultado.TipoChoices
Motivo = RecategorizacionResultado.MotivoChoices
Decision = RecategorizacionResultado.DecisionChoices

DECISION_LOG_HEADER = "Revisiones manuales:"


class RecategorizationInProgress(Exception):
    pass


class RecategorizationDecisionError(Exception):
    pass


@dataclass
class Clasificacion:
    tipo: str
    motivo: str = ""
    detalle: str = ""
    categoria_nueva: Categoria | None = None
    categoria_sugerida: Categoria | None = None
    quitar_secundaria_sugerido: bool = False


def build_category_ladders():
    ladders = {gender: [] for gender in GENERO_PERSONA_A_CATEGORIA.values()}
    for category in Categoria.objects.filter(genero__in=ladders).order_by("edad_maxima", "categoria_id"):
        ladders[category.genero].append(category)
    return ladders


def category_for_age(ladder, age):
    return next((category for category in ladder if category.edad_maxima >= age), None)


def _error(motivo, detalle):
    return Clasificacion(tipo=Tipo.ERROR, motivo=motivo, detalle=detalle)


def _classify_main_category(principal, expected, age, birth_year, ladder, current_year, last_run_year):
    if (
        expected.edad_maxima > YOUTH_MAX_AGE
        and principal.edad_maxima > YOUTH_MAX_AGE
        and principal.edad_maxima >= age
    ):
        return Clasificacion(tipo=Tipo.EXITO, categoria_nueva=principal)

    if last_run_year is None or last_run_year >= current_year:
        if principal.edad_maxima == expected.edad_maxima:
            return Clasificacion(tipo=Tipo.EXITO, categoria_nueva=principal)
        if principal.edad_maxima > expected.edad_maxima:
            return Clasificacion(
                tipo=Tipo.PENDIENTE,
                motivo=Motivo.CATEGORIA_MAYOR,
                detalle=f"Está en {principal.nombre}, mayor a la que le corresponde ({expected.nombre}).",
                categoria_sugerida=expected,
            )
    else:
        previous_expected = category_for_age(ladder, last_run_year - birth_year)
        was_in_natural_category = (
            previous_expected is not None and principal.edad_maxima == previous_expected.edad_maxima
        )
        if was_in_natural_category and expected.edad_maxima <= YOUTH_MAX_AGE:
            new_category = principal if principal.edad_maxima == expected.edad_maxima else expected
            return Clasificacion(tipo=Tipo.EXITO, categoria_nueva=new_category)
        if principal.edad_maxima >= expected.edad_maxima:
            return Clasificacion(
                tipo=Tipo.PENDIENTE,
                motivo=Motivo.CATEGORIA_IGUAL_O_MAYOR,
                detalle=f"Está en {principal.nombre}, igual o mayor a la que le corresponde ({expected.nombre}).",
                categoria_sugerida=expected,
            )

    return Clasificacion(
        tipo=Tipo.PENDIENTE,
        motivo=Motivo.CATEGORIA_MENOR,
        detalle=f"Está en {principal.nombre}, menor a la que le corresponde ({expected.nombre}).",
        categoria_sugerida=expected,
    )


def classify_player(player, ladders, current_year, last_run_year):
    person = player.socio.persona
    if not person.fecha_nacimiento:
        return _error(Motivo.SIN_FECHA_NACIMIENTO, "El jugador no tiene fecha de nacimiento cargada.")

    gender = GENERO_PERSONA_A_CATEGORIA.get(getattr(person.genero, "nombre", None))
    if gender is None:
        return _error(Motivo.SIN_GENERO, "El género del jugador no tiene categorías asociadas.")

    ladder = ladders.get(gender, [])
    birth_year = person.fecha_nacimiento.year
    age = current_year - birth_year
    expected = category_for_age(ladder, age)
    if expected is None:
        return _error(Motivo.SIN_CATEGORIA_DISPONIBLE, f"Ninguna categoría admite jugadores de {age} años.")

    principal = player.categoria
    if principal is None or principal.genero != gender:
        return _error(Motivo.CATEGORIA_INCOMPATIBLE, "La categoría principal no está asignada o es de otro género.")

    result = _classify_main_category(principal, expected, age, birth_year, ladder, current_year, last_run_year)

    secondary = player.categoria_secundaria
    if secondary is None:
        return result

    if (
        secondary.genero == gender
        and secondary.edad_maxima == expected.edad_maxima
        and principal.edad_maxima != expected.edad_maxima
    ):
        return Clasificacion(
            tipo=Tipo.PENDIENTE,
            motivo=Motivo.SECUNDARIA_CORRESPONDE,
            detalle=(
                f"Le corresponde {secondary.nombre}, que tenía como secundaria: "
                "se sugiere como principal y quitar la secundaria."
            ),
            categoria_sugerida=secondary,
            quitar_secundaria_sugerido=True,
        )

    remove_secondary = secondary.genero != gender or secondary.edad_maxima < age
    secondary_detail = (
        f"Posee categoría secundaria {secondary.nombre}"
        + (", que ya no admite su edad." if remove_secondary else ".")
    )
    if result.tipo == Tipo.EXITO:
        return Clasificacion(
            tipo=Tipo.PENDIENTE,
            motivo=Motivo.TIENE_SECUNDARIA,
            detalle=secondary_detail,
            categoria_sugerida=result.categoria_nueva,
            quitar_secundaria_sugerido=remove_secondary,
        )
    result.detalle = f"{result.detalle} {secondary_detail}"
    result.quitar_secundaria_sugerido = remove_secondary
    return result


def players_to_recategorize():
    return (
        Jugador.objects
        .filter(Q(estado__nombre=ESTADO_DEPORTIVO_ACTIVO) | ~Q(socio__estado_administrativo__nombre=ESTADO_ADMINISTRATIVO_INACTIVO))
        .select_related("socio__persona__genero", "categoria", "categoria_secundaria")
    )


def last_run_year(exclude_id=None):
    runs = RecategorizacionEjecucion.objects.filter(estado__in=[Estado.REVISION_PENDIENTE, Estado.FINALIZADA])
    if exclude_id is not None:
        runs = runs.exclude(pk=exclude_id)
    return runs.order_by("-anio").values_list("anio", flat=True).first()


def format_datetime(value):
    return timezone.localtime(value).strftime("%d/%m/%Y %H:%M")


def player_label(player):
    person = player.socio.persona
    birth_year = person.fecha_nacimiento.year if person.fecha_nacimiento else "s/f"
    return f"{person.apellido}, {person.nombre} (DNI {person.dni}, {birth_year})"


def category_label(category):
    return category.nombre if category else "—"


def _result_log_line(player, result):
    if result.tipo == Tipo.EXITO:
        return (
            f"[ÉXITO] {player_label(player)}: "
            f"{category_label(player.categoria)} -> {category_label(result.categoria_nueva)}"
        )
    if result.tipo == Tipo.PENDIENTE:
        return f"[PENDIENTE] {player_label(player)}: {result.detalle}"
    return f"[ERROR] {player_label(player)}: {result.detalle}"


def mark_stale_runs_as_failed():
    RecategorizacionEjecucion.objects.filter(
        estado=Estado.EN_CURSO,
        fecha_inicio__lt=timezone.now() - STALE_RUN_TIMEOUT,
    ).update(estado=Estado.FALLIDA, fecha_fin=timezone.now())


def start_recategorization(user, executed_by):
    from django_q.tasks import async_task

    mark_stale_runs_as_failed()
    if RecategorizacionEjecucion.objects.filter(estado__in=[Estado.EN_CURSO, Estado.REVISION_PENDIENTE]).exists():
        raise RecategorizationInProgress()
    try:
        with transaction.atomic():
            execution = RecategorizacionEjecucion.objects.create(usuario=user, ejecutado_por=executed_by)
            transaction.on_commit(lambda: async_task("padron.services.run_recategorization", execution.pk))
    except IntegrityError as error:
        raise RecategorizationInProgress() from error
    return execution


def run_recategorization(execution_id):
    execution = RecategorizacionEjecucion.objects.get(pk=execution_id)
    try:
        _process_execution(execution)
    except Exception as error:
        execution.estado = Estado.FALLIDA
        execution.fecha_fin = timezone.now()
        execution.registro += f"\nLa ejecución falló: {error}\n"
        execution.save(update_fields=["estado", "fecha_fin", "registro"])
        raise


@transaction.atomic
def _process_execution(execution):
    previous_year = last_run_year(exclude_id=execution.pk)
    ladders = build_category_ladders()
    log_lines = [
        f"Recategorización {execution.anio} iniciada el {format_datetime(execution.fecha_inicio)} "
        f"por {execution.ejecutado_por}.",
        f"Última ejecución previa: {previous_year or 'sin registros'}.",
        "",
    ]
    results = []
    players_to_update = []

    for player in players_to_recategorize().order_by("socio__persona__fecha_nacimiento", "jugador_id"):
        try:
            result = classify_player(player, ladders, execution.anio, previous_year)
        except Exception as error:
            result = _error(Motivo.ERROR_INESPERADO, str(error)[:255])

        results.append(RecategorizacionResultado(
            ejecucion=execution,
            jugador=player,
            tipo=result.tipo,
            motivo=result.motivo,
            detalle=result.detalle[:255],
            categoria_anterior=player.categoria,
            categoria_secundaria_anterior=player.categoria_secundaria,
            categoria_nueva=result.categoria_nueva,
            categoria_secundaria_nueva=player.categoria_secundaria if result.tipo == Tipo.EXITO else None,
            categoria_sugerida=result.categoria_sugerida,
            quitar_secundaria_sugerido=result.quitar_secundaria_sugerido,
        ))
        log_lines.append(_result_log_line(player, result))

        if result.tipo == Tipo.EXITO and result.categoria_nueva != player.categoria:
            player.categoria = result.categoria_nueva
            players_to_update.append(player)

    RecategorizacionResultado.objects.bulk_create(results)
    Jugador.objects.bulk_update(players_to_update, ["categoria"])

    totals = {tipo: sum(1 for result in results if result.tipo == tipo) for tipo in Tipo.values}
    execution.exitosos = totals[Tipo.EXITO]
    execution.pendientes = totals[Tipo.PENDIENTE]
    execution.errores = totals[Tipo.ERROR]
    execution.estado = Estado.REVISION_PENDIENTE if execution.pendientes else Estado.FINALIZADA
    execution.fecha_fin = timezone.now()
    log_lines += [
        "",
        f"Resultado: {execution.exitosos} exitosos | {execution.pendientes} pendientes | {execution.errores} errores.",
    ]
    execution.registro = "\n".join(log_lines) + "\n"
    execution.save()


def _user_label(user):
    if user is None:
        return "Sistema"
    return user.get_full_name().strip() or user.username


def _append_decision_log(execution, line):
    if DECISION_LOG_HEADER not in execution.registro:
        execution.registro += f"\n{DECISION_LOG_HEADER}\n"
    execution.registro += line + "\n"


def _finish_if_reviewed(execution):
    unresolved = execution.resultados.filter(tipo=Tipo.PENDIENTE, decision="").exists()
    if execution.estado == Estado.REVISION_PENDIENTE and not unresolved:
        execution.estado = Estado.FINALIZADA
        execution.registro += f"Revisión manual completada el {format_datetime(timezone.now())}.\n"


def _apply_decision(execution, result, decision, user, categoria=None, categoria_secundaria=None):
    if execution.estado not in (Estado.REVISION_PENDIENTE, Estado.FINALIZADA):
        raise RecategorizationDecisionError("La ejecución todavía no admite revisiones.")
    if decision in (Decision.ACEPTADA, Decision.MANTENIDA) and (result.tipo != Tipo.PENDIENTE or result.decision):
        raise RecategorizationDecisionError("El jugador ya fue revisado o no requiere revisión.")

    player = result.jugador
    if decision == Decision.ACEPTADA:
        if result.categoria_sugerida is None:
            raise RecategorizationDecisionError("El resultado no tiene una categoría sugerida.")
        player.categoria = result.categoria_sugerida
        if result.quitar_secundaria_sugerido or player.categoria_secundaria_id == player.categoria_id:
            player.categoria_secundaria = None
    elif decision == Decision.EDITADA:
        player.categoria = categoria
        player.categoria_secundaria = categoria_secundaria
    if decision != Decision.MANTENIDA:
        player.save(update_fields=["categoria", "categoria_secundaria"])

    result.decision = decision
    result.categoria_nueva = player.categoria
    result.categoria_secundaria_nueva = player.categoria_secundaria
    result.usuario_decision = user
    result.fecha_decision = timezone.now()
    result.save(update_fields=[
        "decision", "categoria_nueva", "categoria_secundaria_nueva", "usuario_decision", "fecha_decision",
    ])
    _append_decision_log(
        execution,
        f"[{result.get_decision_display().upper()}] {player_label(player)} por {_user_label(user)} "
        f"el {format_datetime(result.fecha_decision)}: principal {category_label(player.categoria)} | "
        f"secundaria {category_label(player.categoria_secundaria)}",
    )


def _result_for_decision(result_id):
    return (
        RecategorizacionResultado.objects
        .select_for_update(of=("self",))
        .select_related("jugador__socio__persona", "jugador__categoria", "jugador__categoria_secundaria", "categoria_sugerida")
        .get(pk=result_id)
    )


@transaction.atomic
def decide_result(result_id, decision, user, categoria=None, categoria_secundaria=None):
    execution_id = RecategorizacionResultado.objects.values_list("ejecucion_id", flat=True).get(pk=result_id)
    execution = RecategorizacionEjecucion.objects.select_for_update().get(pk=execution_id)
    result = _result_for_decision(result_id)
    _apply_decision(execution, result, decision, user, categoria, categoria_secundaria)
    _finish_if_reviewed(execution)
    execution.save(update_fields=["estado", "registro"])
    return result


@transaction.atomic
def accept_all_suggestions(execution_id, user):
    execution = RecategorizacionEjecucion.objects.select_for_update().get(pk=execution_id)
    pending = (
        execution.resultados
        .select_for_update(of=("self",))
        .select_related("jugador__socio__persona", "jugador__categoria", "jugador__categoria_secundaria", "categoria_sugerida")
        .filter(tipo=Tipo.PENDIENTE, decision="", categoria_sugerida__isnull=False)
        .order_by("resultado_id")
    )
    accepted = 0
    for result in pending:
        _apply_decision(execution, result, Decision.ACEPTADA, user)
        accepted += 1
    _finish_if_reviewed(execution)
    execution.save(update_fields=["estado", "registro"])
    return accepted


def pasr_de_anio_vigente_a_categoria():
    current_year = date.today().year
    categorias = Categoria.objects.exclude(anio_vigente=current_year)
    for categoria in categorias:
        categoria.anio_vigente = current_year

        if categoria.nombre.isdigit() and len(categoria.nombre) == 4:
            categoria.nombre = str(categoria.anio_vigente - categoria.edad_maxima)

        categoria.save()
