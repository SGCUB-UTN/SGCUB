from django.urls import path

from .views import (
    LoginView,
    LogoutView,
    RefreshView,
    authorizer_list,
    change_password,
    current_user,
    role_list,
    usuario_activate,
    usuario_detail,
    usuario_list_create,
    usuario_reset_password,
)

# Montadas en api/auth/
auth_urlpatterns = [
    path("login/", LoginView.as_view(), name="auth-login"),
    path("refresh/", RefreshView.as_view(), name="auth-refresh"),
    path("logout/", LogoutView.as_view(), name="auth-logout"),
    path("me/", current_user, name="auth-me"),
    path("change-password/", change_password, name="auth-change-password"),
]

# Montadas en api/usuarios/
usuario_urlpatterns = [
    path("", usuario_list_create, name="usuario-list"),
    path("roles/", role_list, name="usuario-roles"),
    path("autorizantes/", authorizer_list, name="usuario-autorizantes"),
    path("<int:pk>/", usuario_detail, name="usuario-detail"),
    path("<int:pk>/activate/", usuario_activate, name="usuario-activate"),
    path("<int:pk>/reset-password/", usuario_reset_password, name="usuario-reset-password"),
]
