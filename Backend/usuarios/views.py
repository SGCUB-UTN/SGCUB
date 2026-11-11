from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.views import TokenBlacklistView, TokenObtainPairView, TokenRefreshView
from rest_framework.views import APIView
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.conf import settings

from .emails import enviar_email_password_reset
from .serializers import PasswordResetConfirmSerializer, PasswordResetRequestSerializer

from .models import set_must_change_password
from .permissions import CanChangeUsuarios, CanManageUsuarios
from .serializers import ROLES, AutorizanteSerializer, CambioPasswordSerializer, LoginSerializer, UsuarioActualSerializer, UsuarioSerializer
from .roles import ADMINISTRADOR

User = get_user_model()


@extend_schema(tags=["Auth"])
class LoginView(TokenObtainPairView):
    serializer_class = LoginSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"


@extend_schema(tags=["Auth"])
class RefreshView(TokenRefreshView):
    pass


@extend_schema(tags=["Auth"])
class LogoutView(TokenBlacklistView):
    pass


@extend_schema(tags=["Auth"], responses=UsuarioActualSerializer)
@api_view(["GET"])
def current_user(request):
    return Response(UsuarioActualSerializer(request.user).data)


@extend_schema(tags=["Auth"], request=CambioPasswordSerializer, responses={204: None})
@api_view(["POST"])
def change_password(request):
    serializer = CambioPasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data["new_password"])
    request.user.save(update_fields=["password"])
    set_must_change_password(request.user, required=False)
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Usuarios"], responses=AutorizanteSerializer(many=True))
@api_view(["GET"])
def authorizer_list(request):
    users = User.objects.filter(is_active=True).order_by("last_name", "first_name", "username")
    return Response(AutorizanteSerializer(users, many=True).data)


def _usuarios_queryset():
    return User.objects.select_related("perfil").prefetch_related("groups").order_by("last_name", "first_name", "username")


@extend_schema(tags=["Usuarios"], methods=["GET"], responses=UsuarioSerializer(many=True))
@extend_schema(tags=["Usuarios"], methods=["POST"], request=UsuarioSerializer, responses=UsuarioSerializer)
@api_view(["GET", "POST"])
@permission_classes([CanManageUsuarios])
def usuario_list_create(request):
    if request.method == "GET":
        return Response(UsuarioSerializer(_usuarios_queryset(), many=True).data)

    serializer = UsuarioSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    return Response(UsuarioSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)


@extend_schema(tags=["Usuarios"], request=UsuarioSerializer, responses=UsuarioSerializer)
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([CanManageUsuarios])
def usuario_detail(request, pk):
    user = get_object_or_404(_usuarios_queryset(), pk=pk)

    if request.method == "GET":
        return Response(UsuarioSerializer(user).data)

    if request.method == "PATCH":
        serializer = UsuarioSerializer(user, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(UsuarioSerializer(serializer.save()).data)

    # Baja lógica: el usuario deja de poder ingresar y sus tokens dejan de ser aceptados
    if user.pk == request.user.pk:
        return Response({"detail": "No podés darte de baja a vos mismo."}, status=status.HTTP_400_BAD_REQUEST)

    if user.is_active and user.groups.filter(name=ADMINISTRADOR).exists():
        otros_admins = User.objects.filter(
            groups__name=ADMINISTRADOR,
            is_active=True,
        ).exclude(pk=user.pk)
        if not otros_admins.exists():
            return Response(
                {"detail": "No podés desactivar al último administrador activo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
    
    user.is_active = False
    user.save(update_fields=["is_active"])
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Usuarios"], request=None, responses=UsuarioSerializer)
@api_view(["POST"])
@permission_classes([CanChangeUsuarios])
def usuario_activate(request, pk):
    user = get_object_or_404(_usuarios_queryset(), pk=pk)
    user.is_active = True
    user.save(update_fields=["is_active"])
    return Response(UsuarioSerializer(user).data)


@extend_schema(tags=["Usuarios"], request=None, responses={204: None})
@api_view(["POST"])
@permission_classes([CanChangeUsuarios])
def usuario_reset_password(request, pk):
    user = get_object_or_404(User, pk=pk)
    user.set_password(user.username)
    user.save(update_fields=["password"])
    set_must_change_password(user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(tags=["Usuarios"], responses={200: {"type": "array", "items": {"type": "string"}}})
@api_view(["GET"])
@permission_classes([CanManageUsuarios])
def role_list(request):
    return Response(ROLES)

class PasswordResetRequestView(APIView):
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(tags=["Auth"], request=PasswordResetRequestSerializer, responses={200: None})
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data["email"]

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
            enviar_email_password_reset(user, reset_url)

        return Response({
            "detail": "Si el correo está registrado, vas a recibir un enlace para restablecer la contraseña."
        })


class PasswordResetConfirmView(APIView):
    permission_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"

    @extend_schema(tags=["Auth"], request=PasswordResetConfirmSerializer, responses={204: None})
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Decodificar el uid
        try:
            uid = force_str(urlsafe_base64_decode(data["uid"]))
            user = User.objects.get(pk=uid, is_active=True)
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            return Response(
                {"detail": "El enlace de restablecimiento no es válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar token
        if not default_token_generator.check_token(user, data["token"]):
            return Response(
                {"detail": "El enlace expiró o ya fue usado. Solicitá uno nuevo."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validar contraseña con los validators de Django
        try:
            validate_password(data["new_password"], user=user)
        except DjangoValidationError as exc:
            return Response(
                {"new_password": exc.messages},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Aplicar
        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        set_must_change_password(user, required=False)

        return Response(status=status.HTTP_204_NO_CONTENT)