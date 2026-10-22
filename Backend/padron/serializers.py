import re

from rest_framework import serializers
from django.db import transaction
from .models import CargoDocente, DocenteCategoria, Persona, Socio, Categoria, Jugador, Docente, EstadoDeportivo, VinculoFamiliar, EstadoAdministrativo, Genero, Localidad, Barrio, Domicilio, EDAD_MAYORIA, ESTADO_ADMINISTRATIVO_INACTIVO, SIZES_CHOICES, age_from
from finanzas.services import create_or_update_player_current_cuota


DNI_REGEX = re.compile(r"\d{7,8}")
MANDATORY_PERSONA_FIELDS = {
    "nombre": ("nombre",),
    "apellido": ("apellido",),
    "dni": ("dni",),
    "telefono": ("telefono",),
    "email": ("email",),
    "fecha_nacimiento": ("fecha_nacimiento",),
    "genero": ("genero",),
    "domicilio_calle": ("domicilio", "calle"),
    "domicilio_numero": ("domicilio", "numero"),
    "domicilio_localidad": ("domicilio", "localidad"),
}

MANDATORY_CONTACT_FIELDS = {
    field: MANDATORY_PERSONA_FIELDS[field] for field in ("nombre", "apellido", "dni", "telefono")
}


def validate_dni(value):
    if not DNI_REGEX.fullmatch(value or ""):
        raise serializers.ValidationError("El DNI debe ser numérico y tener entre 7 y 8 dígitos.")


def validate_obligatory_fields(data, is_creation, fields=MANDATORY_PERSONA_FIELDS):
    errors = {}
    for field, path in fields.items():
        value = data
        present = True
        for key in path:
            if not isinstance(value, dict) or key not in value:
                present = False
                break
            value = value[key]
        if (is_creation and not present) or (present and value in (None, "")):
            errors[field] = ["Este campo es obligatorio."]
    if errors:
        raise serializers.ValidationError(errors)


def validate_barrio_localidad(address_data, current_address=None):
    barrio = (address_data or {}).get("barrio")
    if not barrio:
        return
    localidad = address_data.get("localidad") or getattr(current_address, "localidad", None)
    if localidad and barrio.localidad_id != localidad.pk:
        raise serializers.ValidationError({"domicilio_barrio": ["El barrio no pertenece a la localidad seleccionada."]})


def clean_address_data(address_data):
    return {key: value for key, value in address_data.items() if value not in (None, "") or key == "barrio"}


def get_persona_profiles(person):
    member = getattr(person, "socio", None)
    player = getattr(member, "jugador", None) if member else None
    teacher = getattr(person, "docente", None)
    return {
        "persona_id": person.pk,
        "socio_id": member.pk if member else None,
        "jugador_id": player.pk if player else None,
        "docente_id": teacher.pk if teacher else None,
    }


def duplicated_dni_error(person, message="Ya existe una persona con este DNI."):
    profiles = {key: pk for key, pk in get_persona_profiles(person).items() if pk is not None}
    return serializers.ValidationError({"dni": [message], "persona_existente": profiles})


def player_contacts_error(birth_date, legal_guardian_flags):
    """Un jugador necesita al menos un vínculo familiar y, si es menor, un responsable legal."""
    if not legal_guardian_flags:
        return "Debe registrar al menos un vínculo familiar."
    age = age_from(birth_date)
    if age is not None and age < EDAD_MAYORIA and not any(legal_guardian_flags):
        return "El jugador es menor de edad: al menos un vínculo familiar debe ser responsable legal."
    return None


def validate_dni_uniqueness(dni, current_person=None):
    if not dni:
        return
    people = Persona.objects.all()
    if current_person is not None:
        people = people.exclude(pk=current_person.pk)
    existing = people.filter(dni=dni).first()
    if existing is not None:
        raise duplicated_dni_error(existing)


class GeneroSerializer(serializers.ModelSerializer):
    class Meta:
        model = Genero
        fields = "__all__"


def normalize_name(value):
    value = " ".join(value.split())
    if not value:
        raise serializers.ValidationError("Este campo es obligatorio.")
    return value


class LocalidadSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(max_length=100)

    class Meta:
        model = Localidad
        fields = "__all__"

    def validate_nombre(self, value):
        return normalize_name(value)

    def create(self, validated_data):
        existing = Localidad.objects.filter(nombre__iexact=validated_data["nombre"]).first()
        return existing or super().create(validated_data)


class BarrioSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(max_length=100)

    class Meta:
        model = Barrio
        fields = ["barrio_id", "nombre", "localidad"]
        validators = []

    def validate_nombre(self, value):
        return normalize_name(value)

    def create(self, validated_data):
        existing = Barrio.objects.filter(
            nombre__iexact=validated_data["nombre"], localidad=validated_data["localidad"]
        ).first()
        return existing or super().create(validated_data)


class DomicilioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Domicilio
        fields = "__all__"


class EstadoAdministrativoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoAdministrativo
        fields = "__all__"


class PersonaSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(max_length=50, required=False)
    apellido = serializers.CharField(max_length=50, required=False)
    dni = serializers.CharField(max_length=8, required=False, validators=[validate_dni])
    telefono = serializers.CharField(max_length=20, required=False)
    email = serializers.EmailField(max_length=100, validators=[], required=False, allow_null=True, allow_blank=True)
    edad = serializers.IntegerField(read_only=True)
    perfiles = serializers.SerializerMethodField()
    genero = serializers.PrimaryKeyRelatedField(queryset=Genero.objects.all(), required=False, allow_null=True)
    genero_nombre = serializers.CharField(source="genero.nombre", read_only=True)
    domicilio_calle = serializers.CharField(source="domicilio.calle", required=False, allow_blank=True, allow_null=True)
    domicilio_numero = serializers.CharField(source="domicilio.numero", required=False, allow_blank=True, allow_null=True)
    domicilio_piso = serializers.CharField(source="domicilio.piso", required=False, allow_blank=True, allow_null=True)
    domicilio_departamento = serializers.CharField(source="domicilio.departamento", required=False, allow_blank=True, allow_null=True)
    domicilio_entre_calle_1 = serializers.CharField(source="domicilio.entre_calle_1", required=False, allow_blank=True, allow_null=True)
    domicilio_entre_calle_2 = serializers.CharField(source="domicilio.entre_calle_2", required=False, allow_blank=True, allow_null=True)
    domicilio_barrio = serializers.PrimaryKeyRelatedField(source="domicilio.barrio", queryset=Barrio.objects.all(), required=False, allow_null=True)
    domicilio_barrio_nombre = serializers.CharField(source="domicilio.barrio.nombre", read_only=True)
    domicilio_localidad = serializers.PrimaryKeyRelatedField(source="domicilio.localidad", queryset=Localidad.objects.all(), required=False, allow_null=True)
    domicilio_localidad_nombre = serializers.CharField(source="domicilio.localidad.nombre", read_only=True)

    class Meta:
        model = Persona
        fields = [
            "persona_id", "nombre", "apellido", "dni", "telefono", "email",
            "fecha_nacimiento", "edad", "genero", "genero_nombre", "genero_otro",
            "domicilio_calle", "domicilio_numero", "domicilio_piso",
            "domicilio_departamento", "domicilio_entre_calle_1",
            "domicilio_entre_calle_2", "domicilio_barrio", "domicilio_barrio_nombre",
            "domicilio_localidad", "domicilio_localidad_nombre", "perfiles",
        ]
        read_only_fields = ["persona_id"]

    def get_perfiles(self, person):
        profiles = get_persona_profiles(person)
        profiles.pop("persona_id")
        profiles["vinculos"] = [
            {
                **(
                    {"jugador_id": link.jugador_id, "jugador_nombre": str(link.jugador.socio.persona)}
                    if link.jugador_id
                    else {}
                ),
                **(
                    {"docente_id": link.docente_id, "docente_nombre": str(link.docente.persona)}
                    if link.docente_id
                    else {}
                ),
                "relacion": link.relacion,
            }
            for link in person.vinculos_familiares.all()
        ]
        return profiles

    @transaction.atomic
    def create(self, validated_data):
        address_data = validated_data.pop("domicilio", None)
        if address_data:
            address_data = clean_address_data(address_data)
            if address_data.get("calle") and address_data.get("numero") and address_data.get("localidad"):
                validated_data["domicilio"] = Domicilio.objects.create(**address_data)
        return super().create(validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        address_data = validated_data.pop("domicilio", None)
        if address_data:
            address_data = clean_address_data(address_data)
            if instance.domicilio:
                for attribute, value in address_data.items():
                    setattr(instance.domicilio, attribute, value)
                instance.domicilio.save()
            elif address_data.get("calle") and address_data.get("numero") and address_data.get("localidad"):
                instance.domicilio = Domicilio.objects.create(**address_data)
                instance.save(update_fields=["domicilio"])
        return super().update(instance, validated_data)

    def validate(self, attrs):
        validate_obligatory_fields(attrs, is_creation=self.instance is None)
        validate_dni_uniqueness(attrs.get("dni"), self.instance)
        validate_barrio_localidad(attrs.get("domicilio"), getattr(self.instance, "domicilio", None))
        return attrs


def save_contact_person(person_data, current_person=None):
    person_data = dict(person_data)
    address_data = person_data.pop("domicilio", None)
    dni = person_data.get("dni")
    if "email" in person_data and not person_data["email"]:
        person_data["email"] = None

    person = (Persona.objects.filter(dni=dni).first() if dni else current_person) or current_person or Persona()

    if address_data is not None:
        cleaned_address = clean_address_data(address_data)
        if cleaned_address.get("calle") and cleaned_address.get("numero") and cleaned_address.get("localidad"):
            if person.domicilio:
                for attr, value in cleaned_address.items():
                    setattr(person.domicilio, attr, value)
                for optional_attr in ("piso", "departamento", "entre_calle_1", "entre_calle_2", "barrio"):
                    if optional_attr not in cleaned_address:
                        setattr(person.domicilio, optional_attr, None)
                person.domicilio.save()
            else:
                person.domicilio = Domicilio.objects.create(**cleaned_address)

    for attr, value in person_data.items():
        setattr(person, attr, value)
    person.save()
    return person


class PersonaContactoSerializer(PersonaSerializer):
    def validate(self, attrs):
        is_creation = not getattr(self.root, "partial", False)
        validate_obligatory_fields(attrs, is_creation, MANDATORY_CONTACT_FIELDS)
        address_data = attrs.get("domicilio")
        if address_data:
            cleaned = clean_address_data(address_data)
            has_any_address = any(v not in (None, "") for v in cleaned.values())
            if has_any_address:
                address_errors = {}
                for field, key in (
                    ("domicilio_calle", "calle"),
                    ("domicilio_numero", "numero"),
                    ("domicilio_localidad", "localidad"),
                ):
                    if not cleaned.get(key):
                        address_errors[field] = ["Este campo es obligatorio al indicar un domicilio."]
                if address_errors:
                    raise serializers.ValidationError(address_errors)
                validate_barrio_localidad(cleaned, getattr(self.instance, "domicilio", None))
        return attrs

class SocioSerializer(serializers.ModelSerializer):
    persona = serializers.PrimaryKeyRelatedField(read_only=True)
    nombre = serializers.CharField(source="persona.nombre")
    apellido = serializers.CharField(source="persona.apellido")
    dni = serializers.CharField(source="persona.dni", max_length=8, validators=[validate_dni])
    telefono = serializers.CharField(source="persona.telefono")
    email = serializers.EmailField(source="persona.email", required=False, allow_null=True, allow_blank=True)
    fecha_nacimiento = serializers.DateField(source="persona.fecha_nacimiento", required=False, allow_null=True)
    edad = serializers.IntegerField(source="persona.edad", read_only=True)
    genero = serializers.PrimaryKeyRelatedField(source="persona.genero", queryset=Genero.objects.all(), required=False, allow_null=True)
    genero_nombre = serializers.CharField(source="persona.genero.nombre", read_only=True)
    genero_otro = serializers.CharField(source="persona.genero_otro", required=False, allow_null=True, allow_blank=True)

    domicilio_calle = serializers.CharField(source="persona.domicilio.calle", required=False, allow_null=True, allow_blank=True)
    domicilio_numero = serializers.CharField(source="persona.domicilio.numero", required=False, allow_null=True, allow_blank=True)
    domicilio_piso = serializers.CharField(source="persona.domicilio.piso", required=False, allow_null=True, allow_blank=True)
    domicilio_departamento = serializers.CharField(source="persona.domicilio.departamento", required=False, allow_null=True, allow_blank=True)
    domicilio_entre_calle_1 = serializers.CharField(source="persona.domicilio.entre_calle_1", required=False, allow_null=True, allow_blank=True)
    domicilio_entre_calle_2 = serializers.CharField(source="persona.domicilio.entre_calle_2", required=False, allow_null=True, allow_blank=True)
    domicilio_barrio = serializers.PrimaryKeyRelatedField(source="persona.domicilio.barrio", queryset=Barrio.objects.all(), required=False, allow_null=True)
    domicilio_barrio_nombre = serializers.CharField(source="persona.domicilio.barrio.nombre", read_only=True)
    domicilio_localidad = serializers.PrimaryKeyRelatedField(source="persona.domicilio.localidad", queryset=Localidad.objects.all(), required=False, allow_null=True)

    estado_administrativo = serializers.PrimaryKeyRelatedField(
        queryset=EstadoAdministrativo.objects.all(),
        required=False
    )
    estado_administrativo_nombre = serializers.CharField(source="estado_administrativo.nombre", read_only=True)
    es_jugador = serializers.BooleanField(source="is_player", read_only=True)

    class Meta:
        model = Socio
        fields = [
            "socio_id", "persona", "numero_socio", "nombre", "apellido", "dni", "telefono", "email",
            "fecha_nacimiento", "edad", "genero", "genero_nombre", "genero_otro",
            "domicilio_calle", "domicilio_numero", "domicilio_piso", "domicilio_departamento", "domicilio_entre_calle_1", "domicilio_entre_calle_2", "domicilio_barrio", "domicilio_barrio_nombre", "domicilio_localidad",
            "estado_administrativo", "estado_administrativo_nombre", "fecha_alta", "es_jugador"
        ]
        read_only_fields = ["numero_socio", "fecha_alta"]

    def validate(self, attrs):
        person_data = attrs.get("persona", {})
        dni = person_data.get("dni")
        is_creation = self.instance is None and not getattr(self.root, "partial", False)
        validate_obligatory_fields(person_data, is_creation)

        person = getattr(self.instance, "persona", None)
        if person is None and dni:
            person = Persona.objects.filter(dni=dni).first()
            member = getattr(person, "socio", None)
            if member is not None:
                if hasattr(member, "jugador") and member.jugador != getattr(self.root, "instance", None):
                    raise duplicated_dni_error(person, "La persona con este DNI ya está registrada como jugador.")
                if self.parent is None:
                    raise duplicated_dni_error(person, "Ya existe un socio con este DNI.")

        validate_dni_uniqueness(dni, person)
        validate_barrio_localidad(person_data.get("domicilio"), getattr(person, "domicilio", None))
        return attrs

    def _save_person(self, person, person_data):
        address_data = person_data.pop("domicilio", None)
        if address_data:
            address_data = clean_address_data(address_data)
            if person.domicilio:
                for attr, value in address_data.items():
                    setattr(person.domicilio, attr, value)
                person.domicilio.save()
            elif address_data.get("calle") and address_data.get("numero") and address_data.get("localidad"):
                person.domicilio = Domicilio.objects.create(**address_data)

        for attr, value in person_data.items():
            setattr(person, attr, value)
        person.save()
        return person

    @transaction.atomic
    def create(self, validated_data):
        person_data = validated_data.pop("persona")
        # El alta siempre queda en estado Activo (default del modelo)
        validated_data.pop("estado_administrativo", None)
        if not person_data.get("email"):
            person_data["email"] = None

        # Si la persona ya existe (contacto, docente o socio) se reutiliza en lugar de duplicarla
        person = Persona.objects.filter(dni=person_data.get("dni")).first() or Persona()
        self._save_person(person, person_data)

        existing_member = getattr(person, "socio", None)
        if existing_member is not None:
            return existing_member
        return Socio.objects.create(persona=person, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        person_data = validated_data.pop("persona", None)
        if person_data:
            self._save_person(instance.persona, person_data)
        member = super().update(instance, validated_data)
        if "estado_administrativo" in validated_data and member.is_inactive:
            member.deactivate()
        return member


class CategoriaSerializer(serializers.ModelSerializer):
    nombre = serializers.CharField(max_length=50)
    anio_vigente = serializers.IntegerField()
    edad_maxima = serializers.IntegerField(min_value=0)
    genero = serializers.ChoiceField(choices=Categoria.GENERO_CHOICES)

    class Meta:
        model = Categoria
        fields = [
            "categoria_id",
            "nombre",
            "anio_vigente",
            "edad_maxima",
            "genero",
        ]
        read_only_fields = ["categoria_id"]

    def validate_nombre(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre es obligatorio.")
        return value

    def validate_anio_vigente(self, value):
        if value < 1900:
            raise serializers.ValidationError("El año vigente no es válido.")
        return value

    def validate(self, attrs):
        def current(field):
            if field in attrs:
                return attrs[field]
            return getattr(self.instance, field, None)
        name = current("nombre")
        current_year = current("anio_vigente")
        gender = current("genero")
        if name and current_year and gender:
            categories = Categoria.objects.filter(
                nombre__iexact=name,
                anio_vigente=current_year,
                genero=gender,
            )
            if self.instance is not None:
                categories = categories.exclude(pk=self.instance.pk)
            if categories.exists():
                raise serializers.ValidationError(
                    "Ya existe una categoría con ese nombre, año vigente y género."
                )
        return attrs


class CategoriaListSerializer(CategoriaSerializer):
    cantidad_jugadores = serializers.SerializerMethodField()
    cantidad_docentes = serializers.IntegerField(read_only=True)

    class Meta(CategoriaSerializer.Meta):
        fields = CategoriaSerializer.Meta.fields + ["cantidad_jugadores", "cantidad_docentes"]

    def get_cantidad_jugadores(self, category):
        return category.main_players_count + category.secondary_players_count


class EstadoDeportivoSerializer(serializers.ModelSerializer):
    class Meta:
        model = EstadoDeportivo
        fields = ["estado_id", "nombre"]
        read_only_fields = ["estado_id"]


class VinculoFamiliarSerializer(serializers.ModelSerializer):
    vinculo_familiar_id = serializers.IntegerField(required=False)
    persona = PersonaContactoSerializer()
    jugador = serializers.PrimaryKeyRelatedField(queryset=Jugador.objects.all(), required=False, allow_null=True)
    docente = serializers.PrimaryKeyRelatedField(queryset=Docente.objects.all(), required=False, allow_null=True)
    responsable_legal = serializers.BooleanField(required=False, default=False)

    class Meta:
        model = VinculoFamiliar
        fields = ['vinculo_familiar_id', 'persona', 'jugador', 'docente', 'responsable_legal', 'relacion']
        validators = []

    def validate(self, attrs):
        if 'persona' in attrs and not attrs['persona'].get('telefono'):
            raise serializers.ValidationError({'persona': {'telefono': 'El teléfono es obligatorio para los vinculos familiares.'}})

        if self.parent is None:
            player = attrs.get("jugador", getattr(self.instance, "jugador", None))
            teacher = attrs.get("docente", getattr(self.instance, "docente", None))
            if bool(player) == bool(teacher):
                raise serializers.ValidationError("El vínculo familiar debe pertenecer a un jugador o a un docente.")

            contact_dni = (attrs.get("persona") or {}).get("dni") or getattr(getattr(self.instance, "persona", None), "dni", None)
            if player is not None and contact_dni and contact_dni == player.socio.persona.dni:
                raise serializers.ValidationError({"persona": {"dni": ["No se puede registrar al mismo jugador como su propio contacto."]}})
            if teacher is not None and contact_dni and contact_dni == teacher.persona.dni:
                raise serializers.ValidationError({"persona": {"dni": ["No se puede registrar al mismo docente como su propio contacto."]}})

            # Editado por separado (no dentro del jugador): no puede dejar a un menor sin responsable legal
            if self.instance is not None and player is not None and "responsable_legal" in attrs:
                flags = list(player.vinculos_familiares.exclude(pk=self.instance.pk).values_list("responsable_legal", flat=True))
                error = player_contacts_error(player.socio.persona.fecha_nacimiento, flags + [attrs["responsable_legal"]])
                if error:
                    raise serializers.ValidationError({"responsable_legal": [error]})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        person_data = validated_data.pop("persona")
        person = save_contact_person(person_data)
        validated_data.pop("vinculo_familiar_id", None)
        return VinculoFamiliar.objects.create(persona=person, **validated_data)

    @transaction.atomic
    def update(self, instance, validated_data):
        person_data = validated_data.pop("persona", None)
        validated_data.pop("vinculo_familiar_id", None)
        if person_data:
            instance.persona = save_contact_person(person_data, current_person=instance.persona)
            instance.save()
        return super().update(instance, validated_data)


class JugadorSerializer(serializers.ModelSerializer):
    socio = serializers.PrimaryKeyRelatedField(queryset=Socio.objects.all(), required=False, allow_null=True)
    nuevo_socio = SocioSerializer(required=False, write_only=True, allow_null=True)
    categoria = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all())
    categoria_secundaria = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all(), allow_null=True, required=False)
    obra_social = serializers.CharField(max_length=50)
    tallaIndumentaria = serializers.ChoiceField(choices=SIZES_CHOICES)
    estado = serializers.PrimaryKeyRelatedField(queryset=EstadoDeportivo.objects.all(), required=False)
    vinculos_familiares = VinculoFamiliarSerializer(many=True, required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['vinculos_familiares'].child.fields['jugador'].read_only = True
        self.fields['vinculos_familiares'].child.fields['docente'].read_only = True

    class Meta:
        model = Jugador
        fields = [
            "jugador_id",
            "socio",
            "nuevo_socio",
            "categoria",
            "categoria_secundaria",
            "obra_social",
            "tallaIndumentaria",
            "estado",
            "vinculos_familiares",
        ]

    def _birth_date(self, attrs):
        new_member_person = (attrs.get("nuevo_socio") or {}).get("persona", {})
        if "fecha_nacimiento" in new_member_person:
            return new_member_person["fecha_nacimiento"]
        member = attrs.get("socio") or getattr(self.instance, "socio", None)
        return member.persona.fecha_nacimiento if member else None

    def validate(self, attrs):
        member = attrs.get('socio')
        new_member = attrs.get('nuevo_socio')
        is_creation = self.instance is None

        if is_creation and not member and not new_member:
            raise serializers.ValidationError({"socio": "Debe seleccionar un socio existente o ingresar los datos de un nuevo socio."})

        if member:
            players = Jugador.objects.filter(socio=member)
            if self.instance is not None:
                players = players.exclude(pk=self.instance.pk)
            if players.exists():
                raise serializers.ValidationError({"socio": "Este socio ya tiene un jugador asociado."})

        self._validate_categories_and_contacts(attrs, is_creation)

        owner_dni = (
            (new_member or {}).get("persona", {}).get("dni")
            or (member.persona.dni if member else None)
            or (self.instance.socio.persona.dni if self.instance and getattr(self.instance, "socio", None) else None)
        )

        for contact in attrs.get('vinculos_familiares', []):
            person_data = contact.get('persona', {})
            phone = person_data.get('telefono')
            if not phone:
                raise serializers.ValidationError({'vinculos_familiares': 'El teléfono es obligatorio para los vinculos familiares.'})

            dni = person_data.get('dni')
            if not dni:
                continue

            if owner_dni and dni == owner_dni:
                raise serializers.ValidationError({'vinculos_familiares': 'No se puede registrar al mismo jugador como su propio contacto.'})

            contact_id = contact.get('vinculo_familiar_id')

            if not contact_id and self.instance:
                if self.instance.vinculos_familiares.filter(persona__dni=dni).exists():
                    raise serializers.ValidationError({'Vinculos familiares': 'Esta persona ya esta asociada a este jugador.'})

            people = Persona.objects.filter(dni=dni)
            if contact_id:
                try:
                    people = people.exclude(pk=VinculoFamiliar.objects.get(pk=contact_id).persona_id)
                except VinculoFamiliar.DoesNotExist:
                    raise serializers.ValidationError({'vinculos familiares': 'El contacto indicado no pertenece al jugador.'})
        return attrs

    def _validate_categories_and_contacts(self, attrs, is_creation):
        errors = {}
        birth_date = self._birth_date(attrs)
        birth_date_changed = "fecha_nacimiento" in (attrs.get("nuevo_socio") or {}).get("persona", {})
        if is_creation and birth_date is None:
            errors["fecha_nacimiento"] = ["El socio debe tener fecha de nacimiento para registrarlo como jugador."]

        category = attrs.get("categoria", getattr(self.instance, "categoria", None))
        category_changed = is_creation or category != getattr(self.instance, "categoria", None)
        if birth_date and category and (category_changed or birth_date_changed) and not category.accepts_age(birth_date):
            errors["categoria"] = [
                f"El jugador tiene {category.competition_age(birth_date)} años en la temporada {category.anio_vigente} "
                f"y la categoría {category.nombre} admite hasta {category.edad_maxima}."
            ]

        secondary = attrs.get("categoria_secundaria", getattr(self.instance, "categoria_secundaria", None))
        if secondary is not None and secondary == category:
            errors["categoria_secundaria"] = ["La categoría secundaria debe ser distinta de la principal."]

        if "vinculos_familiares" in attrs:
            flags = [contact.get("responsable_legal", False) for contact in attrs["vinculos_familiares"]]
        elif self.instance is not None:
            flags = list(self.instance.vinculos_familiares.values_list("responsable_legal", flat=True))
        else:
            flags = []
        if is_creation or "vinculos_familiares" in attrs or birth_date_changed:
            contacts_error = player_contacts_error(birth_date, flags)
            if contacts_error:
                errors["vinculos_familiares"] = [contacts_error]

        if errors:
            raise serializers.ValidationError(errors)

    @transaction.atomic
    def create(self, validated_data):
        new_member_data = validated_data.pop("nuevo_socio", None)
        if new_member_data:
            member_serializer = SocioSerializer()
            member = member_serializer.create(new_member_data)
            validated_data["socio"] = member

        # El alta siempre queda en estado deportivo Activo (default del modelo)
        validated_data.pop("estado", None)

        contacts_data = validated_data.pop("vinculos_familiares", [])
        player = Jugador.objects.create(**validated_data)
        player.activate_member_if_inactive()
        for contact_data in contacts_data:
            contact_data["jugador"] = player
            VinculoFamiliarSerializer().create(contact_data)
        
        transaction.on_commit(
            lambda socio_id=player.socio_id: create_or_update_player_current_cuota(socio_id)
        )
        return player

    @transaction.atomic
    def update(self, instance, validated_data):
        new_member_data = validated_data.pop("nuevo_socio", None)
        if new_member_data:
            member_serializer = SocioSerializer()
            if hasattr(instance, 'socio') and instance.socio:
                member = member_serializer.update(instance.socio, new_member_data)
            else:
                member = member_serializer.create(new_member_data)
            validated_data["socio"] = member

        contacts_data = validated_data.pop("vinculos_familiares", None)
        player = super().update(instance, validated_data)
        if "estado" in validated_data:
            player.activate_member_if_inactive()
        if contacts_data is not None:
            contact_ids = set()
            for contact_data in contacts_data:
                contact_id = contact_data.get("vinculo_familiar_id")
                contact_data["jugador"] = player
                if contact_id:
                    contact = instance.vinculos_familiares.get(pk=contact_id)
                    VinculoFamiliarSerializer().update(contact, contact_data)
                    contact_ids.add(contact_id)
                else:
                    new_contact = VinculoFamiliarSerializer().create(contact_data)
                    contact_ids.add(new_contact.pk)
            instance.vinculos_familiares.exclude(pk__in=contact_ids).delete()
        return player


class JugadorListSerializer(serializers.ModelSerializer):
    socio = SocioSerializer(read_only=True)
    categoria = CategoriaSerializer(read_only=True)
    categoria_secundaria = CategoriaSerializer(read_only=True)
    estado = EstadoDeportivoSerializer(read_only=True)
    vinculos_familiares = VinculoFamiliarSerializer(many=True, read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['vinculos_familiares'].child.fields['jugador'].read_only = True
        self.fields['vinculos_familiares'].child.fields['docente'].read_only = True

    class Meta:
        model = Jugador
        fields = ["jugador_id", "socio", "categoria", "categoria_secundaria", "obra_social", "tallaIndumentaria", "estado", "vinculos_familiares"]


class JugadorSerializerDetail(serializers.ModelSerializer):
    socio = SocioSerializer(read_only=True)
    categoria = CategoriaSerializer(read_only=True)
    categoria_secundaria = CategoriaSerializer(read_only=True)
    estado = EstadoDeportivoSerializer(read_only=True)
    vinculos_familiares = serializers.SerializerMethodField()

    def get_vinculos_familiares(self, player):
        return VinculoFamiliarSerializer(
            player.vinculos_familiares.select_related(
                "persona__genero",
                "persona__domicilio__localidad",
                "persona__domicilio__barrio",
            ),
            many=True,
        ).data

    class Meta:
        model = Jugador
        fields = ["jugador_id", "socio", "categoria", "categoria_secundaria", "obra_social", "tallaIndumentaria", "vinculos_familiares", "estado"]
        read_only_fields = ["jugador_id"]


class CargoDocenteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CargoDocente
        fields = ["cargo_id", "nombre"]


class AsignacionDocenteSerializer(serializers.Serializer):
    """Un cargo del docente con las categorías en las que lo ejerce."""
    cargo = serializers.PrimaryKeyRelatedField(queryset=CargoDocente.objects.all())
    categorias = serializers.PrimaryKeyRelatedField(queryset=Categoria.objects.all(), many=True, allow_empty=False)


def group_teacher_assignments(teacher):
    groups = {}
    assignments = sorted(
        teacher.categorias_docente.all(),
        key=lambda a: (a.cargo.nombre if a.cargo else "", a.categoria.nombre),
    )
    for assignment in assignments:
        group = groups.setdefault(assignment.cargo_id, {
            "cargo": assignment.cargo_id,
            "cargo_nombre": assignment.cargo.nombre if assignment.cargo else None,
            "categorias": [],
        })
        group["categorias"].append(CategoriaSerializer(assignment.categoria).data)
    return list(groups.values())


class DocenteSerializer(serializers.ModelSerializer):
    persona = serializers.PrimaryKeyRelatedField(queryset=Persona.objects.all())
    persona_detalle = PersonaSerializer(source="persona", read_only=True)
    estado = serializers.PrimaryKeyRelatedField(queryset=EstadoAdministrativo.objects.all(), required=False)
    estado_nombre = serializers.CharField(source="estado.nombre", read_only=True)
    # Escritura: [{"cargo": id, "categorias": [ids]}]. Lectura: agrupado por cargo con el detalle de cada categoría.
    asignaciones = AsignacionDocenteSerializer(many=True, required=False, write_only=True)
    vinculos_familiares = VinculoFamiliarSerializer(many=True, required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["vinculos_familiares"].child.fields["jugador"].read_only = True
        self.fields["vinculos_familiares"].child.fields["docente"].read_only = True

    class Meta:
        model = Docente
        fields = [
            "docente_id", "persona", "persona_detalle", "legajo", "fecha_ingreso",
            "estado", "estado_nombre", "asignaciones", "vinculos_familiares",
        ]
        read_only_fields = ["docente_id", "legajo", "fecha_ingreso"]

    def to_representation(self, teacher):
        data = super().to_representation(teacher)
        data["asignaciones"] = group_teacher_assignments(teacher)
        return data

    def validate(self, attrs):
        is_creation = self.instance is None
        person = attrs.get("persona")
        if person is not None and person != getattr(self.instance, "persona", None):
            existing = getattr(person, "docente", None)
            if existing is not None:
                raise serializers.ValidationError({
                    "persona": ["Esta persona ya está registrada como docente."],
                    "persona_existente": {"docente_id": existing.pk},
                })

        assignments = attrs.get("asignaciones")
        final_status = attrs.get("estado") or getattr(self.instance, "estado", None)
        ends_inactive = not is_creation and final_status is not None and final_status.nombre == ESTADO_ADMINISTRATIVO_INACTIVO
        keeps_current_assignments = assignments is None and not is_creation and self.instance.has_assignments()
        if not assignments and not keeps_current_assignments and not ends_inactive:
            message = (
                "Para dar de alta al docente primero asignale al menos un cargo con sus categorías."
                if not is_creation and self.instance.is_inactive
                else "Debe asignar al menos un cargo con sus categorías."
            )
            raise serializers.ValidationError({"asignaciones": [message]})
        if assignments:
            self._validate_assignments(assignments)

        owner_person = person or getattr(self.instance, "persona", None)
        owner_dni = owner_person.dni if owner_person else None

        seen_dnis = set()
        for contact in attrs.get("vinculos_familiares", []):
            person_data = contact.get("persona", {})
            phone = person_data.get("telefono")
            if not phone:
                raise serializers.ValidationError({"vinculos_familiares": "El teléfono es obligatorio para los vínculos familiares."})
            dni = person_data.get("dni")
            if not dni:
                continue
            if owner_dni and dni == owner_dni:
                raise serializers.ValidationError({"vinculos_familiares": "No se puede registrar al mismo docente como su propio contacto."})
            if dni in seen_dnis:
                raise serializers.ValidationError({"vinculos_familiares": "No se puede repetir el mismo DNI en los contactos del docente."})
            seen_dnis.add(dni)
            contact_id = contact.get("vinculo_familiar_id")
            if not contact_id and self.instance:
                if self.instance.vinculos_familiares.filter(persona__dni=dni).exists():
                    raise serializers.ValidationError({"vinculos_familiares": "Esta persona ya está asociada a este docente."})
            if contact_id and self.instance:
                if not self.instance.vinculos_familiares.filter(pk=contact_id).exists():
                    raise serializers.ValidationError({"vinculos_familiares": "El contacto indicado no pertenece al docente."})

        return attrs

    def _validate_assignments(self, assignments):
        positions = [assignment["cargo"] for assignment in assignments]
        if len(positions) != len(set(positions)):
            raise serializers.ValidationError({"asignaciones": ["Cada cargo se puede agregar una sola vez."]})
        categories = [category for assignment in assignments for category in assignment["categorias"]]
        if len(categories) != len(set(categories)):
            raise serializers.ValidationError({"asignaciones": ["Una categoría no puede estar asignada a más de un cargo del mismo docente."]})

    def _save_assignments(self, teacher, assignments):
        teacher.categorias_docente.all().delete()
        DocenteCategoria.objects.bulk_create([
            DocenteCategoria(docente=teacher, cargo=assignment["cargo"], categoria=category)
            for assignment in assignments
            for category in assignment["categorias"]
        ])

    def _save_contacts(self, teacher, contacts_data):
        contact_ids = set()
        for contact_data in contacts_data:
            contact_id = contact_data.get("vinculo_familiar_id")
            contact_data["docente"] = teacher
            contact_data.setdefault("responsable_legal", False)
            if contact_id:
                contact = teacher.vinculos_familiares.get(pk=contact_id)
                VinculoFamiliarSerializer().update(contact, contact_data)
                contact_ids.add(contact_id)
            else:
                new_contact = VinculoFamiliarSerializer().create(contact_data)
                contact_ids.add(new_contact.pk)
        teacher.vinculos_familiares.exclude(pk__in=contact_ids).delete()

    @transaction.atomic
    def create(self, validated_data):
        assignments = validated_data.pop("asignaciones")
        contacts_data = validated_data.pop("vinculos_familiares", [])
        # El alta siempre queda en estado Activo; legajo y fecha de ingreso se asignan solos
        validated_data.pop("estado", None)
        teacher = Docente.objects.create(**validated_data)
        self._save_assignments(teacher, assignments)
        if contacts_data:
            self._save_contacts(teacher, contacts_data)
        return teacher

    @transaction.atomic
    def update(self, instance, validated_data):
        assignments = validated_data.pop("asignaciones", None)
        contacts_data = validated_data.pop("vinculos_familiares", None)
        teacher = super().update(instance, validated_data)
        if assignments is not None:
            self._save_assignments(teacher, assignments)
        if contacts_data is not None:
            self._save_contacts(teacher, contacts_data)
        return teacher


class DocenteCategoriaSerializer(serializers.ModelSerializer):
    docente = DocenteSerializer(read_only=True)
    categoria = CategoriaSerializer(read_only=True)
    cargo = CargoDocenteSerializer(read_only=True)
    cargo_id = serializers.PrimaryKeyRelatedField(
        source="cargo",
        queryset=CargoDocente.objects.all(),
        write_only=True,
        required=True,
    )
    docente_id = serializers.PrimaryKeyRelatedField(
        source="docente",
        queryset=Docente.objects.all(),
        write_only=True,
        required=True,
    )
    categoria_id = serializers.PrimaryKeyRelatedField(
        source="categoria",
        queryset=Categoria.objects.all(),
        write_only=True,
        required=True,
    )

    class Meta:
        model = DocenteCategoria
        fields = ["docente_categoria_id", "docente", "categoria", "cargo", "docente_id", "categoria_id", "cargo_id"]
        read_only_fields = ["docente_categoria_id"]
