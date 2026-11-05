import os
import random
import sys
import unicodedata
from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

sys.path.insert(0, "/app")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "SGCUB.settings")

import django

django.setup()

import time_machine
from django.contrib.auth import get_user_model
from django.db import reset_queries
from rest_framework.test import APIClient

from documental.models import TipoDocumento
from finanzas.models import Cuota
from finanzas.services import pending_amounts
from finanzas.tasks import apply_scheduled_surcharges, generate_scheduled_cuotas
from padron.models import Barrio, CargoDocente, Categoria, Docente, Genero, Jugador, Localidad, ObraSocial, Socio
from usuarios.roles import ADMINISTRADOR

TZ = ZoneInfo("America/Argentina/Buenos_Aires")
TODAY = date.today()
SEASON = 2026
PLAYERS_PER_CATEGORY = 28
MEMBERS = 50
TEACHERS = 25
COMPLIANT_SHARE = Decimal("0.8")
RESPONSIBLE = "José María Stefani"

random.seed(20261106)

MALE_NAMES = [
    "Juan", "Santiago", "Mateo", "Benjamín", "Tomás", "Lucas", "Joaquín", "Thiago", "Valentín", "Facundo",
    "Agustín", "Nicolás", "Martín", "Franco", "Lautaro", "Bruno", "Ignacio", "Gonzalo", "Federico", "Matías",
    "Emiliano", "Felipe", "Bautista", "Lorenzo", "Ramiro", "Julián", "Gabriel", "Diego", "Pablo", "Esteban",
    "Marcos", "Alejandro", "Leandro", "Hernán", "Sergio", "Ricardo", "Fernando", "Gustavo", "Ezequiel", "Maximiliano",
    "Rodrigo", "Cristian", "Damián", "Andrés", "Daniel", "Luciano", "Mariano", "Germán", "Javier", "Osvaldo",
]
FEMALE_NAMES = [
    "Sofía", "Valentina", "Martina", "Catalina", "Emma", "Mía", "Delfina", "Julieta", "Lucía", "Camila",
    "Agustina", "Florencia", "Milagros", "Abril", "Victoria", "Paula", "Carolina", "Natalia", "Romina", "Lorena",
    "Daniela", "Gabriela", "Mariana", "Verónica", "Silvina", "Andrea", "Claudia", "Laura", "Marcela", "Patricia",
    "Josefina", "Renata", "Olivia", "Isabella", "Guadalupe", "Antonella", "Micaela", "Rocío", "Belén", "Carla",
    "Luciana", "Celeste", "Bianca", "Juana", "Pilar", "Malena", "Ailén", "Sol", "Brenda", "Melina",
]
SURNAMES = [
    "González", "Rodríguez", "Gómez", "Fernández", "López", "Díaz", "Martínez", "Pérez", "García", "Sánchez",
    "Romero", "Sosa", "Álvarez", "Torres", "Ruiz", "Ramírez", "Flores", "Acosta", "Benítez", "Medina",
    "Suárez", "Herrera", "Aguirre", "Pereyra", "Gutiérrez", "Giménez", "Molina", "Silva", "Castro", "Rojas",
    "Ortiz", "Núñez", "Luna", "Juárez", "Cabrera", "Ríos", "Ferreyra", "Godoy", "Morales", "Domínguez",
    "Moreno", "Peralta", "Vega", "Carrizo", "Quiroga", "Castillo", "Ledesma", "Muñoz", "Ojeda", "Ponce",
    "Vera", "Vázquez", "Villalba", "Cardozo", "Navarro", "Coronel", "Figueroa", "Correa", "Cáceres", "Vargas",
    "Mansilla", "Paz", "Bravo", "Ibarra", "Miranda", "Arias", "Barrios", "Campos", "Méndez", "Bustos",
    "Iglesias", "Ramos", "Rivero", "Ayala", "Bianchi", "Rossi", "Ferrari", "Russo", "Romano", "Colombo",
    "Costa", "Fontana", "Galli", "Conti", "Bruno", "Marino", "Greco", "Lombardi", "Mancini", "Moretti",
    "Ricci", "Caputo", "Esposito", "Gallo", "Leone", "Longo", "Martini", "Pellegrini", "Rinaldi", "Sartori",
]
PARTNER_RELATION = "Pareja"
ADULT_RELATIONS = ["Pareja", "Madre", "Padre", "Hermano/a"]
EDUCATION_BY_AGE = [
    (12, ["primario_en_proceso"]),
    (17, ["secundario_en_proceso"]),
    (22, ["secundario_completo", "universitario_en_proceso", "secundario_en_proceso"]),
    (34, ["universitario_en_proceso", "universitario_completo", "secundario_completo", "universitario_incompleto"]),
    (120, ["secundario_completo", "universitario_completo", "universitario_incompleto", "secundario_incompleto"]),
]
SIZES_BY_AGE = [(10, ["XS", "S"]), (13, ["S", "M"]), (16, ["M", "L"]), (120, ["M", "L", "XL", "XXL"])]

CATEGORIES = [
    ("Senior", 35, 99, "M", "mayor", (35, 52), True),
    ("Senior", 35, 99, "F", "mayor", (35, 48), True),
    ("Primera División", 0, 30, "M", "mayor", (27, 30), True),
    ("Primera División", 0, 99, "F", "mayor", (16, 34), True),
    ("Reserva", 0, 26, "M", "mayor", (20, 26), True),
    ("Cuarta División", 0, 19, "M", "mayor", (18, 19), False),
    ("Quinta División", 0, 17, "M", "juvenil", (17, 17), False),
    ("Sexta División", 0, 16, "M", "juvenil", (16, 16), False),
    ("Séptima División", 0, 15, "M", "juvenil", (15, 15), False),
    ("Octava División", 0, 14, "M", "juvenil", (14, 14), False),
    ("Novena División", 0, 13, "M", "juvenil", (13, 13), False),
    ("Pre-Novena División", 0, 12, "M", "juvenil", (12, 12), False),
    ("Sub-12", 0, 12, "F", "juvenil", (11, 12), False),
    ("2015", 11, 11, "M", "juvenil", (11, 11), False),
    ("2016", 10, 10, "M", "juvenil", (10, 10), False),
    ("Sub-10", 9, 10, "F", "juvenil", (9, 10), False),
    ("2017", 9, 9, "M", "juvenil", (9, 9), False),
    ("2018", 8, 8, "M", "juvenil", (8, 8), False),
]

USERS = [
    ("11111111", "José María", "Stefani", "joseSGCUB@prueba.com", "Directivo"),
    ("22222222", "Sebastián", "De Sandro", "sebastianSGCUB@prueba.com", "Directivo"),
    ("33333333", "Hernán A.", "Dulau Uranga", "hernanSGCUB@prueba.com", "Directivo"),
    ("55555555", "Damián Osvaldo", "Tigo", "damianSGCUB@prueba.com", "Directivo"),
    ("45224372", "Benjamin", "Elizalde", "benjaSGCUB@gmail.com", "Tesorero"),
    ("44256087", "Damián", "Alvite", "damiSGCUB@gmail.com", "Tesorero"),
]

DOCUMENT_TYPES = {
    "Apto Físico": {"obligatorio": True, "requiere_vencimiento": True, "vigencia_meses": 12, "aplica_socio": False},
    "Planilla Inscripción": {"aplica_socio": False},
    "Pase De Transferencia": {"aplica_socio": False},
    "Antecedentes Penales": {"obligatorio": True, "requiere_vencimiento": True, "vigencia_meses": 12},
    "Pautas de Convivencia": {"obligatorio": True},
    "DNI": {"nombre": "Fotocopia del DNI", "obligatorio": True},
}
APTO = "Apto Físico"
PAUTAS = "Pautas de Convivencia"
DNI_COPY = "Fotocopia del DNI"
RECORD = "Antecedentes Penales"
FORM = "Planilla Inscripción"
CV = "CV"
OK, EXPIRING, EXPIRED, MISSING = "ok", "por_vencer", "vencido", "faltante"
PLAYER_ISSUES = [
    {APTO: EXPIRED},
    {APTO: EXPIRING},
    {APTO: MISSING},
    {PAUTAS: MISSING},
    {DNI_COPY: MISSING},
    {APTO: EXPIRED, PAUTAS: MISSING},
    {APTO: EXPIRING, DNI_COPY: MISSING},
    {APTO: MISSING, PAUTAS: MISSING, DNI_COPY: MISSING},
    {APTO: EXPIRED, DNI_COPY: MISSING},
    {PAUTAS: MISSING, DNI_COPY: MISSING},
]
TEACHER_ISSUES = [
    {RECORD: EXPIRED},
    {RECORD: MISSING},
    {DNI_COPY: MISSING},
    {RECORD: EXPIRED, DNI_COPY: MISSING},
]
MAXIMO_ISSUES = {RECORD: EXPIRING, DNI_COPY: MISSING}
PAYMENT_METHODS = [("Efectivo", 50), ("Transferencia", 35), ("BilleteraVirtual", 15)]


def at(day, hour=10, minute=0):
    return datetime.combine(day, time(hour, minute), TZ)


def office_time(day):
    return at(day, random.randint(9, 18), random.randint(0, 59))


def plain(text):
    return unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower().replace(" ", "")


def real_age(birth, on):
    return on.year - birth.year - ((on.month, on.day) < (birth.month, birth.day))


def pick(options):
    return random.choice(options)


def by_age(table, age):
    return pick(next(values for limit, values in table if age <= limit))


class Api:
    def __init__(self):
        self.client = APIClient(SERVER_NAME="localhost")

    def as_user(self, user):
        self.client.force_authenticate(user)
        return self

    def call(self, method, url, data=None, ok=(200, 201, 204)):
        response = getattr(self.client, method)(f"/api/{url}", data, format="json")
        reset_queries()
        if response.status_code not in ok:
            raise RuntimeError(f"{method.upper()} {url} -> {response.status_code}: {response.content[:3000]!r}\n{data}")
        return response.json() if response.content else None


class People:
    def __init__(self):
        self.dnis = {"44256087", "44444444"}
        self.emails = set()
        self.localities = list(Localidad.objects.filter(nombre__in=["La Plata", "Berisso", "Ensenada"]))
        self.barrios = defaultdict(list)
        for barrio in Barrio.objects.filter(localidad__in=self.localities):
            self.barrios[barrio.localidad_id].append(barrio.pk)
        self.genders = {genero.nombre: genero.pk for genero in Genero.objects.all()}

    def dni(self, birth):
        approx = max(4_000_000, 14_000_000 + (birth.year - 1960) * 700_000)
        while True:
            value = str(approx + random.randint(-450_000, 450_000))
            if value not in self.dnis and len(value) in (7, 8):
                self.dnis.add(value)
                return value

    def email(self, name, surname):
        base = f"{plain(name.split()[0])}.{plain(surname.split()[0])}"
        value, number = f"{base}@example.com", 1
        while value in self.emails:
            number += 1
            value = f"{base}{number}@example.com"
        self.emails.add(value)
        return value

    def phone(self):
        if random.random() < 0.7:
            return f"221{random.randint(4_000_000, 6_999_999)}"
        return f"11{random.randint(30_000_000, 69_999_999)}"

    def address(self, complete=True):
        locality = pick(self.localities)
        street = random.randint(1, 31)
        cross = random.randint(32, 79)
        data = {
            "domicilio_calle": f"Calle {street}",
            "domicilio_numero": str(random.randint(100, 2400)),
            "domicilio_localidad": locality.pk,
        }
        if complete or random.random() < 0.6:
            data["domicilio_entre_calle_1"] = f"Calle {cross}"
            data["domicilio_entre_calle_2"] = f"Calle {cross + 1}"
        if complete or random.random() < 0.7:
            data["domicilio_barrio"] = pick(self.barrios[locality.pk])
        if random.random() < 0.25:
            data["domicilio_piso"] = str(random.randint(1, 9))
            data["domicilio_departamento"] = pick(["A", "B", "C", "D"])
        return data

    def birth_for_competition_age(self, age):
        year = SEASON - age
        return date(year, 1, 1) + timedelta(days=random.randint(0, 364))

    def birth_for_age(self, low, high):
        return self.birth_for_competition_age(random.randint(low, high))

    def person(self, gender, birth, surname=None, address=None, complete=True, name=None):
        name = name or pick(MALE_NAMES if gender == "M" else FEMALE_NAMES)
        surname = surname or pick(SURNAMES)
        return {
            "nombre": name,
            "apellido": surname,
            "dni": self.dni(birth),
            "telefono": self.phone(),
            "email": self.email(name, surname),
            "fecha_nacimiento": birth.isoformat(),
            "genero": self.genders["Masculino" if gender == "M" else "Femenino"],
            **(address or self.address(complete)),
        }

    def contact(self, gender, birth, surname=None, address=None):
        name = pick(MALE_NAMES if gender == "M" else FEMALE_NAMES)
        surname = surname or pick(SURNAMES)
        data = {"nombre": name, "apellido": surname, "dni": self.dni(birth), "telefono": self.phone()}
        if random.random() < 0.7:
            data["email"] = self.email(name, surname)
        if address and random.random() < 0.8:
            data.update({key: value for key, value in address.items()})
        return data


class Families:
    def __init__(self, people):
        self.people = people
        self.open = []

    def new(self):
        surname = pick(SURNAMES)
        address = self.people.address(complete=random.random() < 0.7)
        mother = self.people.contact("F", self.people.birth_for_age(32, 50), pick(SURNAMES), address)
        father = self.people.contact("M", self.people.birth_for_age(33, 55), surname, address)
        family = {"surname": surname, "address": address, "mother": mother, "father": father, "kids": 0, "shape": random.random()}
        self.open.append(family)
        return family

    def for_kid(self):
        reusable = [family for family in self.open if family["kids"] < 3]
        family = pick(reusable) if reusable and random.random() < 0.3 else self.new()
        family["kids"] += 1
        return family

    def links(self, family):
        shape = family["shape"]
        if shape < 0.45:
            return [
                {"persona": family["mother"], "relacion": "Madre", "responsable_legal": True},
                {"persona": family["father"], "relacion": "Padre", "responsable_legal": random.random() < 0.6},
            ]
        if shape < 0.7:
            return [{"persona": family["mother"], "relacion": "Madre", "responsable_legal": True}]
        if shape < 0.9:
            return [{"persona": family["father"], "relacion": "Padre", "responsable_legal": True}]
        return [
            {"persona": family["mother"], "relacion": "Abuelo/a", "responsable_legal": True},
            {"persona": family["father"], "relacion": "Tutor", "responsable_legal": False},
        ]


class Generator:
    def __init__(self):
        self.api = Api()
        self.people = People()
        self.families = Families(self.people)
        self.users = {}
        self.categories = {}
        self.obras = [obra for obra in ObraSocial.objects.values_list("nombre", flat=True)]
        self.players = []
        self.members = []
        self.teachers = []
        self.player_docs = {}
        self.damian = None
        self.maximo = None

    def as_user(self, user):
        return self.api.as_user(user)

    def directivo(self):
        return pick([self.users[dni] for dni in ("11111111", "22222222", "33333333", "55555555")])

    def tesorero(self):
        return pick([self.users["45224372"], self.users["44256087"]])

    def setup(self):
        admin = get_user_model().objects.filter(groups__name=ADMINISTRADOR).order_by("pk").first()
        if admin is None:
            raise RuntimeError("No existe el administrador inicial (ADMIN_DNI del .env).")
        self.admin = admin
        with time_machine.travel(at(date(2026, 8, 20), 9), tick=True):
            api = self.as_user(admin)
            for dni, first, last, email, role in USERS:
                api.call("post", "usuarios/", {"dni": dni, "first_name": first, "last_name": last, "email": email, "role": role})
            self.users = {user.username: user for user in get_user_model().objects.all()}
            print("Usuarios creados")

        with time_machine.travel(at(date(2026, 8, 20), 9, 40), tick=True):
            api = self.as_user(admin)
            for category_id in Categoria.objects.exclude(nombre="No asignado").values_list("pk", flat=True):
                api.call("delete", f"padron/categoria/{category_id}/")
            for name, low, high, gender, kind, band, exempt in CATEGORIES:
                created = api.call("post", "padron/categoria/", {
                    "nombre": name, "anio_vigente": SEASON, "edad_minima": low, "edad_maxima": high,
                    "genero": gender, "tipo": kind,
                })
                self.categories[(name, gender)] = {"id": created["categoria_id"], "band": band, "exempt": exempt}
            print("Categorías creadas")

        with time_machine.travel(at(date(2026, 8, 20), 10, 15), tick=True):
            api = self.as_user(admin)
            types = {tipo.nombre: tipo for tipo in TipoDocumento.objects.all()}
            for name, changes in DOCUMENT_TYPES.items():
                api.call("patch", f"documental/tipos/{types[name].pk}/", changes)
            print("Tipos de documento configurados")

        with time_machine.travel(at(date(2026, 8, 20), 11), tick=True):
            api = self.as_user(admin)
            api.call("post", "configuracion/guardar/", {
                "responsable": RESPONSIBLE,
                "financiera": {
                    "periodo_vigencia": "2026-09",
                    "monto_cuota_social": "10000.00",
                    "monto_cuota_deportiva": "15000.00",
                    "monto_inscripcion": "10000.00",
                    "tipo_recargo_1": "MontoFijo",
                    "valor_recargo_1": "3000.00",
                    "tipo_recargo_2": "MontoFijo",
                    "valor_recargo_2": "5000.00",
                    "dia_generacion": 1,
                    "dia_vencimiento_1": 10,
                    "dia_vencimiento_2": 20,
                },
                "categorias_exentas": {str(data["id"]): True for data in self.categories.values() if data["exempt"]},
            })
            print("Configuración financiera guardada")
        self.document_types = {tipo.nombre: tipo.pk for tipo in TipoDocumento.objects.all()}

    def registrations(self):
        moments = iter(sorted(office_time(date(2026, 9, 1)) for _ in range(MEMBERS + len(CATEGORIES) * PLAYERS_PER_CATEGORY + TEACHERS + 3)))
        for index in range(MEMBERS):
            with time_machine.travel(next(moments), tick=True):
                birth = self.people.birth_for_age(24, 74)
                data = self.people.person(pick("MF"), birth, complete=True)
                created = self.as_user(self.directivo()).call("post", "padron/socio/", data)
                self.members.append({"socio_id": created["socio_id"], "persona_id": created["persona"]})
        print(f"Socios creados: {len(self.members)}")

        for (name, gender), category in self.categories.items():
            for _ in range(PLAYERS_PER_CATEGORY):
                with time_machine.travel(next(moments), tick=True):
                    self.create_player(category, gender)
            print(f"  {name} ({gender}): {PLAYERS_PER_CATEGORY} jugadores")

        with time_machine.travel(next(moments), tick=True):
            self.create_damian()
        print(f"Jugadores creados: {len(self.players)}")

        self.create_teachers(moments)
        print(f"Docentes creados: {len(self.teachers)}")

    def player_entry(self, jugador_id, birth, exempt):
        player = Jugador.objects.select_related("socio").get(pk=jugador_id)
        return {"jugador_id": player.pk, "socio_id": player.socio_id, "persona_id": player.socio.persona_id, "birth": birth, "exempt": exempt}

    def player_payload(self, category, gender, birth, person, links, optional_empty):
        age = SEASON - birth.year
        payload = {
            "nuevo_socio": person,
            "categoria": category["id"],
            "obra_social": pick(self.obras),
            "tallaIndumentaria": by_age(SIZES_BY_AGE, age),
            "esquema_vacunacion": None if optional_empty else random.random() < 0.9,
            "nivel_educacion": None if optional_empty else by_age(EDUCATION_BY_AGE, age),
            "vinculos_familiares": links,
        }
        return payload

    def create_player(self, category, gender):
        low, high = category["band"]
        birth = self.people.birth_for_age(low, high)
        optional_empty = random.random() < 0.25
        if real_age(birth, date(2026, 9, 1)) < 18:
            family = self.families.for_kid()
            surname = family["surname"]
            address = family["address"]
            links = self.families.links(family)
        else:
            surname = pick(SURNAMES)
            address = self.people.address(complete=not optional_empty)
            relation = pick(ADULT_RELATIONS)
            contact_gender = pick("MF")
            links = [{
                "persona": self.people.contact(contact_gender, self.people.birth_for_age(20, 70), surname if relation != PARTNER_RELATION else None, address),
                "relacion": relation,
                "responsable_legal": False,
            }]
        person = self.people.person(gender, birth, surname, address)
        created = self.as_user(self.directivo()).call(
            "post", "padron/jugador/", self.player_payload(category, gender, birth, person, links, optional_empty)
        )
        self.players.append(self.player_entry(created["jugador_id"], birth, category["exempt"]))

    def create_damian(self):
        birth = date(2010, 7, 9)
        address = self.people.address(complete=True)
        person = {
            "nombre": "Damián",
            "apellido": "Alvite",
            "dni": "44256087",
            "telefono": "1151108293",
            "email": "damiSGCUB@gmail.com",
            "fecha_nacimiento": birth.isoformat(),
            "genero": self.people.genders["Masculino"],
            **address,
        }
        mother = self.people.contact("F", self.people.birth_for_age(38, 48), pick(SURNAMES), address)
        payload = {
            "nuevo_socio": person,
            "categoria": self.categories[("Sexta División", "M")]["id"],
            "obra_social": "Swiss Medical",
            "tallaIndumentaria": "M",
            "esquema_vacunacion": True,
            "nivel_educacion": "universitario_en_proceso",
            "vinculos_familiares": [{"persona": mother, "relacion": "Madre", "responsable_legal": True}],
        }
        created = self.as_user(self.directivo()).call("post", "padron/jugador/", payload)
        self.damian = self.player_entry(created["jugador_id"], birth, False)
        self.players.append(self.damian)

    def teacher_slots(self):
        cargos = list(CargoDocente.objects.values_list("pk", flat=True))
        slots = [(category["id"], cargo) for category in self.categories.values() for cargo in cargos]
        random.shuffle(slots)
        return slots

    def create_teachers(self, moments):
        people = []
        for _ in range(TEACHERS):
            gender = pick("MF")
            people.append(self.people.person(gender, self.people.birth_for_age(24, 62), complete=True))
        maximo = self.people.person("M", date(2002, 3, 14), name="Máximo", surname="Preneste", complete=True)
        self.people.dnis.discard(maximo["dni"])
        maximo["dni"] = "44444444"
        people.append(maximo)

        assignments = [defaultdict(list) for _ in people]
        loads = [0] * len(people)
        for category_id, cargo in self.teacher_slots():
            candidates = [index for index in range(len(people)) if all(category_id not in cats for cats in assignments[index].values())]
            index = min(candidates, key=lambda i: (loads[i], random.random()))
            assignments[index][cargo].append(category_id)
            loads[index] += 1

        for index, person in enumerate(people):
            with time_machine.travel(next(moments), tick=True):
                api = self.as_user(self.directivo())
                persona = api.call("post", "padron/persona/", person)
                surname = person["apellido"]
                address = {key: value for key, value in person.items() if key.startswith("domicilio_")}
                relation = pick(ADULT_RELATIONS)
                links = [{
                    "persona": self.people.contact(pick("MF"), self.people.birth_for_age(22, 75), surname if relation != PARTNER_RELATION else None, address),
                    "relacion": relation,
                    "responsable_legal": False,
                }]
                if random.random() < 0.35:
                    links.append({
                        "persona": self.people.contact(pick("MF"), self.people.birth_for_age(22, 75), surname, address),
                        "relacion": pick(["Hermano/a", "Madre", "Padre"]),
                        "responsable_legal": False,
                    })
                created = api.call("post", "padron/docente/", {
                    "persona": persona["persona_id"],
                    "asignaciones": [{"cargo": cargo, "categorias": cats} for cargo, cats in assignments[index].items()],
                    "vinculos_familiares": links,
                })
                entry = {"docente_id": created["docente_id"], "persona_id": persona["persona_id"]}
                self.teachers.append(entry)
                if person["dni"] == "44444444":
                    self.maximo = entry

    def socio_cuota(self, socio_id, period):
        return Cuota.objects.filter(periodo=period, movimiento__cuenta_corriente__socio_id=socio_id).select_related("movimiento").first()

    def pending(self, socio_id, period):
        cuota = self.socio_cuota(socio_id, period)
        return (cuota, pending_amounts([cuota])[cuota.pk]) if cuota else (None, Decimal("0.00"))

    def payment_methods(self, total):
        codes = [code for code, _ in PAYMENT_METHODS]
        if random.random() < 0.06 and total > 2000:
            first, second = random.sample(codes, 2)
            part = (total * Decimal(pick(["0.4", "0.5", "0.6"]))).quantize(Decimal("1"))
            return [{"medio_de_pago": first, "monto": str(part)}, {"medio_de_pago": second, "monto": str(total - part)}]
        code = random.choices(codes, weights=[weight for _, weight in PAYMENT_METHODS])[0]
        return [{"medio_de_pago": code, "monto": str(total)}]

    def pay(self, socio_id, period):
        cuota, pending = self.pending(socio_id, period)
        if cuota is None or pending <= 0:
            return
        self.as_user(self.tesorero()).call("post", "finanzas/pago/registrar/", {
            "socio_id": socio_id,
            "cuota_ids": [cuota.pk],
            "monto_total": str(pending),
            "medios": self.payment_methods(pending),
            "observacion": "",
        })
        self.paid[period] += 1

    def payment_day(self, year, month):
        roll = random.random()
        if roll < 0.80:
            return date(year, month, random.randint(2, 10))
        if roll < 0.95:
            return date(year, month, random.randint(12, 20))
        return date(year, month, random.randint(22, 28))

    def period_socios(self, period):
        return sorted(set(
            Cuota.objects.filter(periodo=period, movimiento__isnull=False)
            .values_list("movimiento__cuenta_corriente__socio_id", flat=True)
        ))

    def process(self, events):
        for moment, kind, payload in sorted(events, key=lambda event: event[0]):
            if moment.date() >= TODAY:
                raise RuntimeError(f"El evento {kind} cae el {moment:%d/%m/%Y}, que no es una fecha pasada")
            with time_machine.travel(moment, tick=True):
                if kind == "pay":
                    self.pay(*payload)
                elif kind == "surcharges":
                    apply_scheduled_surcharges(moment.date())
                elif kind == "generation":
                    generate_scheduled_cuotas(moment.date())
                elif kind == "leave":
                    jugador_id, complete = payload
                    url = f"padron/jugador/{jugador_id}/" + ("?completa=true" if complete else "")
                    self.as_user(self.directivo()).call("delete", url)
            reset_queries()

    def billing(self):
        self.paid = defaultdict(int)
        with time_machine.travel(at(date(2026, 9, 1), 19, 30), tick=True):
            self.as_user(self.admin).call("post", "finanzas/cuota/generar-mensual/", {})
        with time_machine.travel(at(date(2026, 9, 1), 19, 45), tick=True):
            self.as_user(self.users["11111111"]).call("post", f"finanzas/socio/{self.damian['socio_id']}/beca/", {
                "modalidad": "Porcentaje",
                "valor": "50",
                "fecha_aplicacion": "2026-09-01",
                "fecha_fin": None,
                "motivo": "Descuento por hermanos",
                "autorizado_por": RESPONSIBLE,
            })
        print("Cuotas de septiembre generadas y beca de Damián otorgada")

        september = [(office_time(self.payment_day(2026, 9)), "pay", (socio, "2026-09")) for socio in self.period_socios("2026-09")]
        self.process(september + [(at(date(2026, 9, 11), 2), "surcharges", None), (at(date(2026, 9, 21), 2), "surcharges", None)])
        print(f"Septiembre: {self.paid['2026-09']} pagos")

        self.process([(at(date(2026, 10, 1), 1), "generation", None)])
        october = self.period_socios("2026-10")
        others = [socio for socio in october if socio != self.damian["socio_id"]]
        payers = random.sample(others, round(len(october) * 0.9))
        october_events = [(office_time(self.payment_day(2026, 10)), "pay", (socio, "2026-10")) for socio in payers]
        early = {payload[0] for moment, _, payload in october_events if moment.day <= 10}
        candidates = [player for player in self.players if not player["exempt"] and player is not self.damian and player["socio_id"] in early]
        self.leaves = random.sample(candidates, 8)
        leave_events = [
            (office_time(date(2026, 10, 15)), "leave", (player["jugador_id"], index >= 5))
            for index, player in enumerate(self.leaves)
        ]
        self.process(october_events + leave_events + [(at(date(2026, 10, 11), 2), "surcharges", None), (at(date(2026, 10, 21), 2), "surcharges", None)])
        print(f"Octubre: {self.paid['2026-10']} pagos de {len(october)} cuotas")

        self.process([(at(date(2026, 11, 1), 1), "generation", None)])
        november = self.period_socios("2026-11")
        complete_leaves = {player["socio_id"] for player in self.leaves[5:]}
        eligible = [
            socio for socio in november
            if socio not in complete_leaves and self.pending(socio, "2026-10")[1] <= 0 and self.pending(socio, "2026-11")[1] > 0
        ]
        last_day = min(4, (TODAY - timedelta(days=1)).day)
        november_payers = random.sample(eligible, round(len(november) * 0.15))
        self.process([(office_time(date(2026, 11, random.randint(2, last_day))), "pay", (socio, "2026-11")) for socio in november_payers])
        print(f"Noviembre: {self.paid['2026-11']} pagos de {len(november)} cuotas")

    def document_dates(self, type_name, status):
        if type_name in (APTO, RECORD):
            if status == OK:
                issued = TODAY - timedelta(days=random.randint(30, 290))
                due = issued.replace(year=issued.year + 1)
            elif status == EXPIRING:
                due = TODAY + timedelta(days=random.randint(3, 27))
                issued = due.replace(year=due.year - 1)
            else:
                due = TODAY - timedelta(days=random.randint(5, 110))
                issued = due.replace(year=due.year - 1)
        else:
            issued, due = TODAY - timedelta(days=random.randint(40, 420)), None
        received = min(issued + timedelta(days=random.randint(0, 7)), TODAY - timedelta(days=1))
        return {
            "fecha_emision": at(issued).isoformat(),
            "fecha_recepcion": at(received, 11).isoformat(),
            "fecha_vencimiento": at(due).isoformat() if due else None,
        }

    def load_documents(self, persona_id, required, issues, optional=()):
        api = self.as_user(self.directivo())
        for type_name in [*required, *optional]:
            status = issues.get(type_name, OK)
            if status == MISSING:
                continue
            api.call("post", "documental/documentos/", {
                "persona": persona_id,
                "tipo_documento": self.document_types[type_name],
                **self.document_dates(type_name, status),
            })

    def issues_for(self, people, combos, forced):
        forced_ids = {id(person) for person, _ in forced}
        pool = [person for person in people if id(person) not in forced_ids]
        bad_count = max(0, round(len(people) * float(1 - COMPLIANT_SHARE)) - sum(1 for _, value in forced if value))
        bad = random.sample(pool, bad_count)
        issues = {id(person): combos[index % len(combos)] for index, person in enumerate(bad)}
        issues.update({id(person): value for person, value in forced})
        return issues

    def documents(self):
        player_issues = self.issues_for(self.players, PLAYER_ISSUES, [(self.damian, {})])
        for player in self.players:
            optional = [FORM] if random.random() < 0.6 else []
            self.load_documents(player["persona_id"], [APTO, PAUTAS, DNI_COPY], player_issues.get(id(player), {}), optional)
        print(f"Documentación de jugadores cargada ({len(self.players)})")

        member_issues = self.issues_for(self.members, [{DNI_COPY: MISSING}], [])
        for member in self.members:
            self.load_documents(member["persona_id"], [DNI_COPY], member_issues.get(id(member), {}))

        teacher_issues = self.issues_for(self.teachers, TEACHER_ISSUES, [(self.maximo, MAXIMO_ISSUES)])
        for teacher in self.teachers:
            optional = [CV] if random.random() < 0.7 else []
            self.load_documents(teacher["persona_id"], [RECORD, DNI_COPY], teacher_issues.get(id(teacher), {}), optional)
        print("Documentación de socios y docentes cargada")

    def random_day(self, start, end):
        if start >= end:
            return end
        return start + timedelta(days=random.randint(0, (end - start).days))

    def backdate(self):
        last = date(2026, 8, 28)
        for member in self.members:
            Socio.objects.filter(pk=member["socio_id"]).update(fecha_alta=self.random_day(date(2012, 3, 1), last))
        for player in self.players:
            start = max(date(2014, 2, 1), player["birth"].replace(year=player["birth"].year + 5))
            Socio.objects.filter(pk=player["socio_id"]).update(fecha_alta=self.random_day(start, last))
        for teacher in self.teachers:
            Docente.objects.filter(pk=teacher["docente_id"]).update(fecha_ingreso=self.random_day(date(2014, 3, 1), last))
        print("Fechas de alta e ingreso distribuidas")

    def report(self):
        players = list(Jugador.objects.select_related("estado", "socio__estado_administrativo"))
        partial = sum(1 for player in players if player.deactivation_type == "parcial")
        complete = sum(1 for player in players if player.deactivation_type == "completa")
        print("")
        print("Resumen")
        print(f"  Usuarios: {get_user_model().objects.count()}")
        print(f"  Socios (sin jugadores): {len(self.members)}")
        print(f"  Jugadores: {len(players)} · bajas parciales: {partial} · bajas completas: {complete}")
        print(f"  Docentes: {Docente.objects.count()}")
        for period in ("2026-09", "2026-10", "2026-11", "2026-12", "2027-01"):
            cuotas = list(Cuota.objects.filter(periodo=period, movimiento__isnull=False).select_related("movimiento"))
            pending = pending_amounts(cuotas)
            paid = sum(1 for cuota in cuotas if pending[cuota.pk] <= 0)
            print(f"  Cuotas {period}: {len(cuotas)} · pagas: {paid}")


def main():
    generator = Generator()
    generator.setup()
    generator.registrations()
    generator.billing()
    generator.documents()
    generator.backdate()
    generator.report()


if __name__ == "__main__":
    main()
