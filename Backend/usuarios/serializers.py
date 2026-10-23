from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .dni import normalize_dni
from .dni import validate_dni as check_dni_format
from .models import must_change_password, set_must_change_password
from .roles import ADMINISTRADOR, ROLE_PERMISSIONS

User = get_user_model()


class LoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        attrs[self.username_field] = normalize_dni(attrs.get(self.username_field))
        return super().validate(attrs)


class UsuarioActualSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    full_name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    permissions = serializers.SerializerMethodField()
    is_superuser = serializers.BooleanField()
    must_change_password = serializers.SerializerMethodField()

    def get_full_name(self, user) -> str:
        return user.get_full_name() or user.username

    def get_roles(self, user) -> list[str]:
        return sorted(user.groups.values_list("name", flat=True))

    def get_permissions(self, user) -> list[str]:
        # Formato "<app_label>.<codename>", el mismo que usa ROLE_PERMISSIONS
        return sorted(user.get_all_permissions())

    def get_must_change_password(self, user) -> bool:
        return must_change_password(user)


class CambioPasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        user = self.context["request"].user
        if must_change_password(user):
            return attrs
        current_password = attrs.get("current_password")
        if not current_password:
            raise serializers.ValidationError({"current_password": "Este campo es requerido."})
        if not user.check_password(current_password):
            raise serializers.ValidationError({"current_password": "La contraseña actual es incorrecta."})
        return attrs


ROLES = [*ROLE_PERMISSIONS, ADMINISTRADOR]


def _to_drf_error(validator, value):
    try:
        validator(value)
    except DjangoValidationError as error:
        raise serializers.ValidationError(error.messages)


class AutorizanteSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    full_name = serializers.SerializerMethodField()

    def get_full_name(self, user) -> str:
        return user.get_full_name() or user.username


class UsuarioSerializer(serializers.ModelSerializer):
    dni = serializers.CharField(source="username", max_length=12)
    full_name = serializers.SerializerMethodField()
    must_change_password = serializers.SerializerMethodField()
    # Cada usuario tiene un único rol; en la lectura se agrega en to_representation
    role = serializers.ChoiceField(choices=ROLES, write_only=True)

    class Meta:
        model = User
        fields = [
            "id", "dni", "first_name", "last_name", "full_name", "email", "role",
            "is_active", "must_change_password", "last_login", "date_joined",
        ]
        read_only_fields = ["is_active", "last_login", "date_joined"]
        extra_kwargs = {
            "first_name": {"required": True, "allow_blank": False},
            "last_name": {"required": True, "allow_blank": False},
            "email": {"required": True, "allow_blank": False},
        }

    def get_full_name(self, user) -> str:
        return user.get_full_name() or user.username

    def get_must_change_password(self, user) -> bool:
        return must_change_password(user)

    def to_representation(self, user):
        data = super().to_representation(user)
        group = user.groups.first()
        data["role"] = group.name if group else None
        return data

    def _other_users(self):
        users = User.objects.all()
        return users.exclude(pk=self.instance.pk) if self.instance else users

    def validate_dni(self, value):
        dni = normalize_dni(value)
        _to_drf_error(check_dni_format, dni)
        if self._other_users().filter(username=dni).exists():
            raise serializers.ValidationError("Ya existe un usuario con este DNI.")
        return dni

    def validate_email(self, value):
        email = value.strip().lower()
        if self._other_users().filter(email__iexact=email).exists():
            raise serializers.ValidationError("Ya existe un usuario con este correo.")
        return email

    def validate_role(self, value):
        # Evita que un administrador se quite su propio acceso a esta pantalla
        request_user = self.context["request"].user
        is_self = self.instance is not None and self.instance.pk == request_user.pk
        if is_self and not self.instance.groups.filter(name=value).exists():
            raise serializers.ValidationError("No podés cambiar tu propio rol.")
        return value

    def create(self, validated_data):
        role = validated_data.pop("role")
        user = User(**validated_data)
        # La clave inicial es el DNI; el usuario la cambia después de ingresar
        user.set_password(user.username)
        user.save()
        set_must_change_password(user)
        user.groups.set([Group.objects.get(name=role)])
        return user

    def update(self, user, validated_data):
        role = validated_data.pop("role", None)
        user = super().update(user, validated_data)
        if role:
            user.groups.set([Group.objects.get(name=role)])
        return user
