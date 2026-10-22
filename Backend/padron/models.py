from datetime import date

from django.db import IntegrityError, models, transaction
import django.utils.timezone


class Genero(models.Model):
    genero_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        db_table = "genero"

    def __str__(self):
        return self.nombre


class Localidad(models.Model):
    localidad_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    codigo_postal = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        db_table = "localidad"

    def __str__(self):
        return self.nombre


class Barrio(models.Model):
    barrio_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100)
    localidad = models.ForeignKey(Localidad, on_delete=models.PROTECT, related_name="barrios")

    class Meta:
        db_table = "barrio"
        ordering = ["nombre"]
        constraints = [
            models.UniqueConstraint(fields=["nombre", "localidad"], name="unique_barrio_localidad"),
        ]

    def __str__(self):
        return self.nombre


class Domicilio(models.Model):
    domicilio_id = models.AutoField(primary_key=True)
    calle = models.CharField(max_length=100)
    numero = models.CharField(max_length=20)
    piso = models.CharField(max_length=20, blank=True, null=True)
    departamento = models.CharField(max_length=20, blank=True, null=True)
    entre_calle_1 = models.CharField(max_length=100, blank=True, null=True)
    entre_calle_2 = models.CharField(max_length=100, blank=True, null=True)
    barrio = models.ForeignKey(Barrio, on_delete=models.PROTECT, related_name="domicilios", blank=True, null=True)
    localidad = models.ForeignKey(Localidad, on_delete=models.PROTECT, related_name="domicilios")

    class Meta:
        db_table = "domicilio"

    def __str__(self):
        return f"{self.calle} {self.numero}, {self.localidad.nombre}"


def get_anio_actual():
    return date.today().year


def age_from(birth_date):
    if not birth_date:
        return None
    today = date.today()
    had_birthday = (today.month, today.day) >= (birth_date.month, birth_date.day)
    return today.year - birth_date.year - (0 if had_birthday else 1)


class Persona(models.Model):
    persona_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50, default="")
    apellido = models.CharField(max_length=50, default="")
    dni = models.CharField(max_length=20, unique=True, default="")
    telefono = models.CharField(max_length=20, default="")
    email = models.EmailField(max_length=100, blank=True, null=True,)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    genero = models.ForeignKey(Genero, on_delete=models.PROTECT, blank=True, null=True, related_name="personas")
    genero_otro = models.CharField(max_length=100, blank=True, null=True)
    domicilio = models.ForeignKey(Domicilio, on_delete=models.SET_NULL, blank=True, null=True, related_name="personas")

    class Meta:
        db_table = "persona"

    @property
    def edad(self):
        return age_from(self.fecha_nacimiento)

    def __str__(self):
        return f"{self.nombre} {self.apellido}"


class EstadoAdministrativo(models.Model):
    estado_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        db_table = "estado_administrativo"

    def __str__(self):
        return self.nombre


ESTADO_ADMINISTRATIVO_ACTIVO = "Activo"
ESTADO_ADMINISTRATIVO_INACTIVO = "Inactivo"


from django.db import transaction

def get_default_estado_administrativo():
    try:
        with transaction.atomic():
            estado, _ = EstadoAdministrativo.objects.get_or_create(nombre=ESTADO_ADMINISTRATIVO_ACTIVO)
            return estado.pk
    except Exception:
        # Prevent migrations from crashing when the table doesn't exist yet
        return 1


# Alias requerido por migraciones históricas (0011, 0022) que referencian el nombre anterior.
get_default_estado_socio = get_default_estado_administrativo


class SequentialNumberMixin:

    sequential_field = None
    NUMBER_ASSIGNMENT_ATTEMPTS = 5

    def save(self, *args, **kwargs):
        field = self.sequential_field
        if getattr(self, field):
            return super().save(*args, **kwargs)
        manager = type(self).objects
        for attempt in range(self.NUMBER_ASSIGNMENT_ATTEMPTS):
            last_number = manager.aggregate(max_number=models.Max(field))["max_number"]
            setattr(self, field, (last_number or 0) + 1)
            try:
                with transaction.atomic():
                    return super().save(*args, **kwargs)
            except IntegrityError:
                number_taken = manager.filter(**{field: getattr(self, field)}).exists()
                setattr(self, field, None)
                if not number_taken or attempt == self.NUMBER_ASSIGNMENT_ATTEMPTS - 1:
                    raise


class Socio(SequentialNumberMixin, models.Model):
    socio_id = models.AutoField(primary_key=True)
    persona = models.OneToOneField(
        Persona,
        on_delete=models.PROTECT,
        related_name="socio"
    )
    estado_administrativo = models.ForeignKey(
        EstadoAdministrativo,
        on_delete=models.PROTECT,
        related_name="socios",
        null=False,
        blank=False,
        default=get_default_estado_administrativo,
    )
    fecha_alta = models.DateField(default=django.utils.timezone.localdate)
    numero_socio = models.PositiveIntegerField(unique=True, null=True, blank=True)

    sequential_field = "numero_socio"

    class Meta:
        db_table = "socio"

    @property
    def is_inactive(self):
        return self.estado_administrativo.nombre == ESTADO_ADMINISTRATIVO_INACTIVO

    @property
    def is_player(self):
        return hasattr(self, "jugador")

    @transaction.atomic
    def deactivate(self):
        self.estado_administrativo, _ = EstadoAdministrativo.objects.get_or_create(nombre=ESTADO_ADMINISTRATIVO_INACTIVO)
        self.save(update_fields=["estado_administrativo"])
        player = getattr(self, "jugador", None)
        if player is not None:
            player.deactivate()

    def activate(self):
        self.estado_administrativo, _ = EstadoAdministrativo.objects.get_or_create(nombre=ESTADO_ADMINISTRATIVO_ACTIVO)
        self.save(update_fields=["estado_administrativo"])

    def __str__(self):
        return f"{self.persona.nombre} {self.persona.apellido}"


class Categoria(models.Model):
    GENERO_MASCULINO = "M"
    GENERO_FEMENINO = "F"
    GENERO_CHOICES = [
        (GENERO_MASCULINO, "Masculino"),
        (GENERO_FEMENINO, "Femenino"),
    ]

    categoria_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)
    anio_vigente = models.PositiveIntegerField(default=get_anio_actual)
    edad_maxima = models.PositiveSmallIntegerField(default=0)
    genero = models.CharField(
        max_length=1,
        choices=GENERO_CHOICES,
        blank=True,
        default="",
    )

    class Meta:
        db_table = "categoria"
        constraints = [
            models.UniqueConstraint(
                fields=["nombre", "anio_vigente", "genero"],
                name="categoria_nombre_anio_genero_unico",
            )
        ]

    def competition_age(self, birth_date):
        """Edad que el jugador cumple en el año de la temporada (al 31/12 del anio_vigente)."""
        return get_anio_actual() - birth_date.year

    def accepts_age(self, birth_date):
        return self.competition_age(birth_date) <= self.edad_maxima

    def __str__(self):
        return f"{self.nombre} ({self.anio_vigente})"


def get_default_categoria():
    try:
        with transaction.atomic():
            categoria = Categoria.objects.filter(nombre="No asignado").only("pk").first()
            if categoria is None:
                categoria = Categoria.objects.create(nombre="No asignado")
            return categoria.pk
    except Exception:
        return 1



class EstadoDeportivo(models.Model):
    estado_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=50)

    class Meta:
        db_table = "estado_deportivo"

    def __str__(self):
        return self.nombre


ESTADO_DEPORTIVO_ACTIVO = "Activo"
ESTADO_DEPORTIVO_INACTIVO = "Inactivo"
EDAD_MAYORIA = 18


def get_default_estado_deportivo():
    try:
        with transaction.atomic():
            estado, _ = EstadoDeportivo.objects.get_or_create(nombre=ESTADO_DEPORTIVO_ACTIVO)
            return estado.pk
    except Exception:
        return 1

SIZES_CHOICES = [
    ("XS", "Extra chica"),
    ("S", "Chica"),
    ("M", "Mediana"),
    ("L", "Grande"),
    ("XL", "Extra grande"),
    ("XXL", "Doble extra grande"),
]

class Jugador(models.Model):
    jugador_id = models.AutoField(primary_key=True)
    obra_social = models.CharField(max_length=50, default="", blank=True)
    tallaIndumentaria = models.CharField(
        max_length=3, 
        choices=SIZES_CHOICES, 
        default="", 
        blank=True
    )
    socio = models.OneToOneField(
        Socio,
        on_delete=models.PROTECT,
        related_name="jugador"
    )

    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name="jugadores",
        null=False,
        blank=False,
        default=get_default_categoria,
    )

    categoria_secundaria = models.ForeignKey(
        Categoria,
        on_delete=models.PROTECT,
        related_name="jugadores_secundarios",
        null=True,
        blank=True,
    )

    estado = models.ForeignKey(
        EstadoDeportivo,
        on_delete=models.PROTECT,
        related_name="jugadores",
        null=False,
        blank=False,
        default=get_default_estado_deportivo,
    )

    class Meta:
        db_table = "jugador"
        verbose_name = "Jugador"
        verbose_name_plural = "Jugadores"

    @property
    def is_active(self):
        return self.estado.nombre == ESTADO_DEPORTIVO_ACTIVO

    def activate_member_if_inactive(self):
        """Un jugador activo requiere un socio activo: al darlo de alta se reactiva su socio."""
        if self.is_active and self.socio.is_inactive:
            self.socio.activate()

    def deactivate(self):
        self.estado, _ = EstadoDeportivo.objects.get_or_create(nombre=ESTADO_DEPORTIVO_INACTIVO)
        self.save(update_fields=["estado"])

    def __str__(self):
        return f"{self.socio.persona.nombre} {self.socio.persona.apellido} - Socio ID: {self.socio.socio_id}"

class CargoDocente(models.Model):
    cargo_id = models.AutoField(primary_key=True)
    nombre = models.CharField(max_length=100, unique=True)

    class Meta:
        db_table = "cargo_docente"

    def __str__(self):
        return self.nombre


class Docente(SequentialNumberMixin, models.Model):
    docente_id = models.AutoField(primary_key=True)
    persona = models.OneToOneField(
        Persona,
        on_delete=models.PROTECT,
        related_name="docente"
    )
    legajo = models.PositiveIntegerField(unique=True)
    fecha_ingreso = models.DateField(default=django.utils.timezone.localdate)
    estado = models.ForeignKey(
        EstadoAdministrativo,
        on_delete=models.PROTECT,
        related_name="docentes",
        default=get_default_estado_administrativo,
    )

    sequential_field = "legajo"

    class Meta:
        db_table = "docente"

    @property
    def is_inactive(self):
        return self.estado.nombre == ESTADO_ADMINISTRATIVO_INACTIVO

    def has_assignments(self, exclude=None):
        assignments = self.categorias_docente.filter(cargo__isnull=False)
        if exclude:
            assignments = assignments.exclude(**exclude)
        return assignments.exists()

    def deactivate(self):
        self.estado, _ = EstadoAdministrativo.objects.get_or_create(nombre=ESTADO_ADMINISTRATIVO_INACTIVO)
        self.save(update_fields=["estado"])

    def __str__(self):
        return f"Docente {self.legajo}"

class VinculoFamiliar(models.Model):
    vinculo_familiar_id = models.AutoField(primary_key=True)

    persona = models.ForeignKey(
        Persona,
        on_delete=models.PROTECT,
        related_name="vinculos_familiares",
    )

    jugador = models.ForeignKey(
        Jugador,
        on_delete=models.CASCADE,
        related_name="vinculos_familiares",
        null=True,
        blank=True,
    )

    docente = models.ForeignKey(
        Docente,
        on_delete=models.CASCADE,
        related_name="vinculos_familiares",
        null=True,
        blank=True,
    )

    responsable_legal = models.BooleanField(default=False)
    relacion = models.CharField(max_length=50)

    class Meta:
        db_table = "vinculo_familiar"
        constraints = [
            models.UniqueConstraint(
                fields=["persona", "jugador"],
                condition=models.Q(jugador__isnull=False),
                name="persona_jugador_contacto_unico",
            ),
            models.UniqueConstraint(
                fields=["persona", "docente"],
                condition=models.Q(docente__isnull=False),
                name="persona_docente_contacto_unico",
            ),
            models.CheckConstraint(
                condition=(
                    models.Q(jugador__isnull=False, docente__isnull=True)
                    | models.Q(jugador__isnull=True, docente__isnull=False)
                ),
                name="vinculo_familiar_jugador_o_docente",
            ),
        ]

class DocenteCategoria(models.Model):
    docente_categoria_id = models.AutoField(primary_key=True)

    docente = models.ForeignKey(
        Docente,
        on_delete=models.CASCADE,
        related_name="categorias_docente",
    )

    categoria = models.ForeignKey(
        Categoria,
        on_delete=models.CASCADE,
        related_name="docentes_categoria",
    )

    cargo = models.ForeignKey(
        CargoDocente,
        on_delete=models.PROTECT,
        related_name="asignaciones",
        null=True, 
    )

    class Meta:
        db_table = "docente_categoria"
        constraints = [
            models.UniqueConstraint(
                fields=["docente", "categoria"],
                name="docente_categoria_unico",
            )
        ]