from collections import Counter
from statistics import mean

from django.db.models import Q
from django.utils import timezone

from documental.services import build_padron_documental

from .models import Categoria, Genero, Jugador, Persona, age_from

MEMBERS = "socios"
PLAYERS = "jugadores"
PARTIAL_LEAVE = "baja_parcial"
TEACHERS = "docentes"
TEACHER_MEMBERS = "docentes_socios"
ROLE_LABELS = {
    MEMBERS: "Solo socios",
    PLAYERS: "Jugadores",
    PARTIAL_LEAVE: "Jugadores de baja parcial",
    TEACHERS: "Docentes",
    TEACHER_MEMBERS: "Docentes que son socios",
}

MEMBER_PROFILE = "socio"
PLAYER_PROFILE = "jugador"
TEACHER_PROFILE = "docente"
ENTITY_PROFILES = {"socios": MEMBER_PROFILE, "jugadores": PLAYER_PROFILE, "docentes": TEACHER_PROFILE}

ACTIVE = "activos"
INACTIVE = "inactivos"
ALL = "todos"
STATUSES = (ACTIVE, INACTIVE, ALL)

NO_DATA = "sin_datos"
NO_DATA_LABEL = "Sin datos"

AGE_RANGES = (
    ("0-12", "0 a 12", 0, 12),
    ("13-17", "13 a 17", 13, 17),
    ("18-25", "18 a 25", 18, 25),
    ("26-40", "26 a 40", 26, 40),
    ("41-mas", "41 o más", 41, None),
)
AGE_RANGE_LABELS = {key: label for key, label, _, _ in AGE_RANGES} | {NO_DATA: NO_DATA_LABEL}

SENIORITY_RANGES = (
    ("menos-1", "Menos de 1 año", 0, 0),
    ("1-2", "1 a 2 años", 1, 2),
    ("3-4", "3 a 4 años", 3, 4),
    ("5-9", "5 a 9 años", 5, 9),
    ("10-mas", "10 años o más", 10, None),
)
SENIORITY_LABELS = {key: label for key, label, _, _ in SENIORITY_RANGES}

UP_TO_DATE = "al_dia"
PENDING = "pendiente"
VACCINATION_LABELS = {UP_TO_DATE: "Al día", PENDING: "Vacunas pendientes", NO_DATA: NO_DATA_LABEL}

EDUCATION_LABELS = dict(Jugador.NivelEducacionChoices.choices) | {NO_DATA: NO_DATA_LABEL}

WITH_COVERAGE = "con"
WITHOUT_COVERAGE = "sin"
COVERAGE_LABELS = {WITH_COVERAGE: "Con obra social", WITHOUT_COVERAGE: "Sin obra social"}
NO_COVERAGE_LABEL = "Sin obra social"

ENABLED = "habilitado"
DISABLED = "inhabilitado"
DOCUMENTATION_LABELS = {ENABLED: "Habilitados", DISABLED: "Inhabilitados"}

ALL_CATEGORIES = "all"
NO_CATEGORY = "none"
CATEGORY_GENDER_PREFIX = "gender:"
CATEGORY_GENDERS = dict(Categoria.GENERO_CHOICES)

EVOLUTION_MONTHS = 12
EVOLUTION_YEARS = 10


class ReportFilterError(Exception):
    pass


def is_active(profile):
    return profile is not None and not profile.is_inactive


def range_of(value, ranges):
    return next(key for key, _, low, high in ranges if value >= low and (high is None or value <= high))


def age_range_of(age):
    return NO_DATA if age is None else range_of(age, AGE_RANGES)


def full_years(start, end):
    return end.year - start.year - ((end.month, end.day) < (start.month, start.day))


def seniority_of(member, today):
    if member is None:
        return None
    end = member.fecha_baja if member.is_inactive and member.fecha_baja else today
    return max(full_years(member.fecha_alta, end), 0)


def role_of(member, player, teacher):
    if teacher is not None:
        return TEACHER_MEMBERS if member is not None else TEACHERS
    if player is None:
        return MEMBERS
    return PARTIAL_LEAVE if player.is_inactive and not member.is_inactive else PLAYERS


def vaccination_of(player):
    if player is None:
        return None
    if player.esquema_vacunacion is None:
        return NO_DATA
    return UP_TO_DATE if player.esquema_vacunacion else PENDING


def category_item(category):
    label = f"{category.nombre} ({category.get_genero_display()})" if category.genero else category.nombre
    return {"id": category.categoria_id, "name": label, "gender": category.genero}


def categories_of(player, teacher):
    categories = []
    if player is not None:
        categories += [player.categoria, player.categoria_secundaria]
    if teacher is not None:
        categories += [assignment.categoria for assignment in teacher.categorias_docente.all()]
    unique = {category.categoria_id: category for category in categories if category is not None}
    return sorted((category_item(category) for category in unique.values()), key=lambda item: item["name"])


def profile_url(member, player, teacher):
    if player is not None:
        return f"/padron/jugadores/{player.jugador_id}"
    if member is not None:
        return f"/padron/socios/{member.socio_id}"
    return f"/padron/docentes/{teacher.docente_id}"


def join_date_of(member, teacher):
    dates = [date for date in (getattr(member, "fecha_alta", None), getattr(teacher, "fecha_ingreso", None)) if date]
    return min(dates, default=None)


def leave_date_of(member, teacher):
    dates = [date for date in (getattr(member, "fecha_baja", None), getattr(teacher, "fecha_baja", None)) if date]
    return max(dates, default=None)


def documentation_by_person():
    enabled = {}
    for persona in build_padron_documental()["personas"]:
        enabled[persona["persona_id"]] = enabled.get(persona["persona_id"], True) and persona["habilitado"]
    return {persona_id: ENABLED if value else DISABLED for persona_id, value in enabled.items()}


def build_row(persona, documentation, today):
    member = getattr(persona, "socio", None)
    teacher = getattr(persona, "docente", None)
    active = is_active(member) or is_active(teacher)
    if active:
        member = member if is_active(member) else None
        teacher = teacher if is_active(teacher) else None
    player = getattr(member, "jugador", None)
    role = role_of(member, player, teacher)
    url = profile_url(member, player, teacher)
    if role == PARTIAL_LEAVE:
        player = None

    age = age_from(persona.fecha_nacimiento)
    seniority = seniority_of(member, today)
    locality = getattr(persona.domicilio, "localidad", None)
    health_insurance = player.obra_social.strip() if player is not None else ""
    profiles = [
        name for name, profile in ((MEMBER_PROFILE, member), (PLAYER_PROFILE, player), (TEACHER_PROFILE, teacher))
        if profile is not None
    ]
    return {
        "persona_id": persona.persona_id,
        "first_name": persona.nombre,
        "last_name": persona.apellido,
        "dni": persona.dni,
        "role": role,
        "profiles": profiles,
        "active": active,
        "age": age,
        "age_range": age_range_of(age),
        "seniority": seniority,
        "seniority_range": None if seniority is None else range_of(seniority, SENIORITY_RANGES),
        "gender_id": persona.genero_id,
        "gender": persona.genero.nombre if persona.genero else None,
        "locality_id": locality.localidad_id if locality else None,
        "locality": locality.nombre if locality else None,
        "vaccination": vaccination_of(player),
        "coverage": None if player is None else (WITH_COVERAGE if health_insurance else WITHOUT_COVERAGE),
        "health_insurance": health_insurance or None,
        "education": None if player is None else (player.nivel_educacion or NO_DATA),
        "categories": categories_of(player, teacher),
        "documentation": documentation.get(persona.persona_id) if active else None,
        "join_date": join_date_of(member, teacher),
        "leave_date": None if active else leave_date_of(member, teacher),
        "profile_url": url,
    }


def report_people():
    return (
        Persona.objects.filter(Q(socio__isnull=False) | Q(docente__isnull=False))
        .select_related(
            "genero",
            "domicilio__localidad",
            "socio__estado_administrativo",
            "socio__jugador__estado",
            "socio__jugador__categoria",
            "socio__jugador__categoria_secundaria",
            "docente__estado",
        )
        .prefetch_related("docente__categorias_docente__categoria")
        .order_by("apellido", "nombre", "pk")
    )


def report_rows(today):
    documentation = documentation_by_person()
    return [build_row(persona, documentation, today) for persona in report_people()]


def _choices(params, name, allowed):
    values = {value for value in params.get(name, "").split(",") if value}
    invalid = values - set(allowed)
    if invalid:
        raise ReportFilterError(f"Valor inválido para {name}: {', '.join(sorted(invalid))}.")
    return values


def _ids(params, name):
    values = [value for value in params.get(name, "").split(",") if value]
    if not all(value.isdigit() for value in values):
        raise ReportFilterError(f"{name} debe ser una lista de números.")
    return {int(value) for value in values}


def _valid_category(value):
    gender = value.removeprefix(CATEGORY_GENDER_PREFIX) if value.startswith(CATEGORY_GENDER_PREFIX) else None
    return value == NO_CATEGORY or gender in CATEGORY_GENDERS or value.isdigit()


def _categories(params):
    values = {value for value in params.get("category", "").split(",") if value and value != ALL_CATEGORIES}
    if not all(_valid_category(value) for value in values):
        raise ReportFilterError("Cada categoría debe ser un número, none o gender:M/F.")
    return values


def _age(params, name):
    value = params.get(name, "")
    if not value:
        return None
    if not value.isdigit():
        raise ReportFilterError(f"{name} debe ser un número entero.")
    return int(value)


def parse_report_filters(params):
    entity = params.get("entity") or None
    if entity and entity not in ENTITY_PROFILES:
        raise ReportFilterError(f"La entidad debe ser una de: {', '.join(ENTITY_PROFILES)}.")
    status = params.get("status") or ACTIVE
    if status not in STATUSES:
        raise ReportFilterError(f"El estado debe ser uno de: {', '.join(STATUSES)}.")
    filters = {
        "entity": entity,
        "status": status,
        "age_range": _choices(params, "age_range", AGE_RANGE_LABELS),
        "age_min": _age(params, "age_min"),
        "age_max": _age(params, "age_max"),
        "seniority": _choices(params, "seniority", SENIORITY_LABELS),
        "gender": _ids(params, "gender"),
        "locality": _ids(params, "locality"),
        "category": _categories(params),
        "education": _choices(params, "education", EDUCATION_LABELS),
        "coverage": _choices(params, "coverage", COVERAGE_LABELS),
        "health_insurance": {value.strip().lower() for value in params.get("health_insurance", "").split(",") if value.strip()},
        "vaccination": _choices(params, "vaccination", VACCINATION_LABELS),
        "documentation": _choices(params, "documentation", DOCUMENTATION_LABELS),
    }
    if filters["age_min"] is not None and filters["age_max"] is not None and filters["age_min"] > filters["age_max"]:
        raise ReportFilterError("La edad mínima no puede ser mayor que la edad máxima.")
    return filters


def _selected(value, selected):
    return not selected or value in selected


def _within_ages(age, low, high):
    if low is None and high is None:
        return True
    return age is not None and (low is None or age >= low) and (high is None or age <= high)


def _insured(row, coverage, names):
    if not coverage and not names:
        return True
    return row["coverage"] in coverage or (row["health_insurance"] or "").lower() in names


def category_matches(categories, values):
    return not values or any(_matches_category(categories, value) for value in values)


def _matches_category(categories, value):
    if value == NO_CATEGORY:
        return not categories
    if value.startswith(CATEGORY_GENDER_PREFIX):
        return any(item["gender"] == value.removeprefix(CATEGORY_GENDER_PREFIX) for item in categories)
    return any(item["id"] == int(value) for item in categories)


def matches(row, filters):
    status = filters["status"]
    return (
        (status == ALL or row["active"] == (status == ACTIVE))
        and (not filters["entity"] or ENTITY_PROFILES[filters["entity"]] in row["profiles"])
        and _selected(row["age_range"], filters["age_range"])
        and _within_ages(row["age"], filters["age_min"], filters["age_max"])
        and _selected(row["seniority_range"], filters["seniority"])
        and _selected(row["gender_id"], filters["gender"])
        and _selected(row["locality_id"], filters["locality"])
        and category_matches(row["categories"], filters["category"])
        and _selected(row["education"], filters["education"])
        and _insured(row, filters["coverage"], filters["health_insurance"])
        and _selected(row["vaccination"], filters["vaccination"])
        and _selected(row["documentation"], filters["documentation"])
    )


def filter_rows(rows, filters):
    return [row for row in rows if matches(row, filters)]


def percentage(part, total):
    return round(part * 100 / total, 1) if total else None


def summary_kpis(rows):
    ages = [row["age"] for row in rows if row["age"] is not None]
    players = [row for row in rows if row["vaccination"] is not None]
    return {
        "total": len(rows),
        "average_age": round(mean(ages), 1) if ages else None,
        "players": len(players),
        "vaccination_up_to_date": percentage(sum(row["vaccination"] == UP_TO_DATE for row in players), len(players)),
        "with_health_insurance": percentage(sum(row["coverage"] == WITH_COVERAGE for row in players), len(players)),
    }


def fixed_distribution(rows, field, labels):
    counts = Counter(row[field] for row in rows if row[field] is not None)
    return [{"key": key, "label": label, "count": counts[key]} for key, label in labels.items()]


def ranked_distribution(values, empty_label=NO_DATA_LABEL):
    counts = Counter(value or empty_label for value in values)
    return [
        {"key": label, "label": label, "count": count}
        for label, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def gender_distribution(rows):
    counts = Counter(row["gender_id"] for row in rows)
    genders = [{"key": gender.genero_id, "label": gender.nombre, "count": counts[gender.genero_id]} for gender in Genero.objects.order_by("pk")]
    return genders + [{"key": NO_DATA, "label": NO_DATA_LABEL, "count": counts[None]}]


def category_distribution(rows):
    counts = Counter()
    labels = {}
    for row in rows:
        for item in row["categories"]:
            counts[item["id"]] += 1
            labels[item["id"]] = item["name"]
    return [
        {"key": category_id, "label": labels[category_id], "count": count}
        for category_id, count in sorted(counts.items(), key=lambda item: (-item[1], labels[item[0]]))
    ]


def summary_charts(rows):
    players = [row for row in rows if row["coverage"] is not None]
    return {
        "roles": fixed_distribution(rows, "role", ROLE_LABELS),
        "vaccination": fixed_distribution(rows, "vaccination", VACCINATION_LABELS),
        "gender": gender_distribution(rows),
        "education": fixed_distribution(rows, "education", EDUCATION_LABELS),
        "documentation": fixed_distribution(rows, "documentation", DOCUMENTATION_LABELS),
        "age_ranges": fixed_distribution(rows, "age_range", AGE_RANGE_LABELS),
        "seniority": fixed_distribution(rows, "seniority_range", SENIORITY_LABELS),
        "localities": ranked_distribution(row["locality"] for row in rows),
        "health_insurance": ranked_distribution((row["health_insurance"] for row in players), NO_COVERAGE_LABEL),
        "categories": category_distribution(rows),
    }


def recent_months(today, count):
    months = []
    year, month = today.year, today.month
    for _ in range(count):
        months.append((year, month))
        year, month = (year, month - 1) if month > 1 else (year - 1, 12)
    return list(reversed(months))


def evolution(rows, today):
    joins = Counter((row["join_date"].year, row["join_date"].month) for row in rows if row["join_date"])
    leaves = Counter((row["leave_date"].year, row["leave_date"].month) for row in rows if row["leave_date"])
    years = range(today.year - EVOLUTION_YEARS + 1, today.year + 1)
    return {
        "monthly": [
            {"period": f"{year}-{month:02d}", "joins": joins[(year, month)], "leaves": leaves[(year, month)]}
            for year, month in recent_months(today, EVOLUTION_MONTHS)
        ],
        "yearly": [
            {
                "year": year,
                "joins": sum(count for (join_year, _), count in joins.items() if join_year == year),
                "leaves": sum(count for (leave_year, _), count in leaves.items() if leave_year == year),
            }
            for year in years
        ],
    }


def build_report(filters, today=None):
    today = today or timezone.localdate()
    rows = report_rows(today)
    selected = filter_rows(rows, filters)
    history = filter_rows(rows, {**filters, "status": ALL})
    return {
        "kpis": summary_kpis(selected),
        "charts": summary_charts(selected),
        "evolution": evolution(history, today),
        "people": selected,
    }
