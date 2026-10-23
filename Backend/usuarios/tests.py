import os
from io import StringIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .admin import UsuarioChangeForm, UsuarioCreationForm
from .roles import ADMINISTRADOR, ROLE_PERMISSIONS

User = get_user_model()


class RolesTests(TestCase):
    def test_every_role_exists_after_migrate(self):
        expected = set(ROLE_PERMISSIONS) | {ADMINISTRADOR}
        self.assertTrue(expected.issubset(set(Group.objects.values_list("name", flat=True))))

    def test_administrador_has_every_permission(self):
        administrador = Group.objects.get(name=ADMINISTRADOR)
        self.assertEqual(administrador.permissions.count(), Permission.objects.count())

    def test_other_roles_have_their_configured_permissions(self):
        for name, codes in ROLE_PERMISSIONS.items():
            group = Group.objects.get(name=name)
            self.assertEqual(group.permissions.count(), len(codes))


class StaffFlagTests(TestCase):
    def setUp(self):
        self.administrador = Group.objects.get(name=ADMINISTRADOR)
        self.user = User.objects.create_user(username="usuario", password="Clave-segura-123")

    def test_user_becomes_staff_when_added_to_administrador(self):
        self.user.groups.add(self.administrador)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)

    def test_user_stops_being_staff_when_removed_from_administrador(self):
        self.user.groups.add(self.administrador)
        self.user.groups.remove(self.administrador)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)

    def test_adding_user_from_group_side_also_updates_staff(self):
        self.administrador.user_set.add(self.user)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_staff)

        self.administrador.user_set.clear()
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)

    def test_other_roles_do_not_grant_staff(self):
        self.user.groups.add(Group.objects.get(name="Tesorero"))
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_staff)

    def test_superuser_keeps_staff_without_administrador(self):
        superuser = User.objects.create_superuser(username="admin", password="Clave-segura-123")
        superuser.groups.add(Group.objects.get(name="Directivo"))
        superuser.refresh_from_db()
        self.assertTrue(superuser.is_staff)


class AuthEndpointsTests(APITestCase):
    password = "Clave-segura-123"

    def setUp(self):
        # El throttle guarda los intentos en la caché, que se comparte entre tests
        cache.clear()
        self.user = User.objects.create_user(
            username="30123456",
            password=self.password,
            first_name="Juana",
            last_name="Pérez",
        )
        self.user.groups.add(Group.objects.get(name="Tesorero"))

    def login(self, password=None, dni="30123456"):
        return self.client.post(
            reverse("auth-login"),
            {"username": dni, "password": password or self.password},
            format="json",
        )

    def test_login_returns_tokens(self):
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)

    def test_login_accepts_dni_with_dots(self):
        response = self.login(dni="30.123.456")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_with_wrong_password_returns_401(self):
        response = self.login(password="incorrecta")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_is_throttled_after_too_many_attempts(self):
        for _ in range(10):
            self.login(password="incorrecta")
        response = self.login()
        self.assertEqual(response.status_code, status.HTTP_429_TOO_MANY_REQUESTS)

    def test_api_requires_authentication(self):
        response = self.client.get(reverse("auth-me"))
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_returns_user_roles_and_permissions(self):
        access = self.login().data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")

        response = self.client.get(reverse("auth-me"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["username"], "30123456")
        self.assertEqual(response.data["full_name"], "Juana Pérez")
        self.assertEqual(response.data["roles"], ["Tesorero"])
        self.assertEqual(response.data["permissions"], [])
        self.assertFalse(response.data["is_superuser"])
        self.assertFalse(response.data["must_change_password"])

    def test_me_lists_every_permission_for_administrador(self):
        self.user.groups.set([Group.objects.get(name=ADMINISTRADOR)])
        self.client.force_authenticate(self.user)

        response = self.client.get(reverse("auth-me"))

        self.assertEqual(len(response.data["permissions"]), Permission.objects.count())

    def test_refresh_rotates_and_invalidates_the_previous_token(self):
        refresh = self.login().data["refresh"]

        response = self.client.post(reverse("auth-refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertNotEqual(response.data["refresh"], refresh)

        reused = self.client.post(reverse("auth-refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_logout_invalidates_refresh_token(self):
        refresh = self.login().data["refresh"]

        response = self.client.post(reverse("auth-logout"), {"refresh": refresh}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        reused = self.client.post(reverse("auth-refresh"), {"refresh": refresh}, format="json")
        self.assertEqual(reused.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_change_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("auth-change-password"),
            {"current_password": self.password, "new_password": "Otra-clave-456"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Otra-clave-456"))

    def test_change_password_rejects_wrong_current_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("auth-change-password"),
            {"current_password": "incorrecta", "new_password": "Otra-clave-456"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_change_password_has_no_format_restrictions(self):
        self.client.force_authenticate(self.user)

        for new_password in ("1234", "30123456"):
            with self.subTest(new_password=new_password):
                current = self.password if new_password == "1234" else "1234"
                response = self.client.post(
                    reverse("auth-change-password"),
                    {"current_password": current, "new_password": new_password},
                    format="json",
                )
                self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
                self.user.refresh_from_db()
                self.assertTrue(self.user.check_password(new_password))

    def test_change_password_requires_current_password_when_not_forced(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("auth-change-password"), {"new_password": "Otra-clave-456"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", response.data)

    def test_change_password_rejects_empty_password(self):
        self.client.force_authenticate(self.user)

        response = self.client.post(
            reverse("auth-change-password"),
            {"current_password": self.password, "new_password": ""},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)


class DniUsernameAdminFormTests(TestCase):
    password = "Clave-segura-123"

    def creation_form(self, dni):
        return UsuarioCreationForm(data={"username": dni, "password1": self.password, "password2": self.password})

    def test_creation_form_normalizes_dni(self):
        form = self.creation_form("30.123.456")
        self.assertTrue(form.is_valid(), form.errors)
        self.assertEqual(form.save().username, "30123456")

    def test_creation_form_rejects_invalid_dni(self):
        for dni in ("jperez", "123456", "123456789"):
            with self.subTest(dni=dni):
                form = self.creation_form(dni)
                self.assertFalse(form.is_valid())
                self.assertIn("username", form.errors)

    def test_creation_form_rejects_duplicated_dni(self):
        User.objects.create_user(username="30123456", password=self.password)
        form = self.creation_form("30.123.456")
        self.assertFalse(form.is_valid())
        self.assertIn("username", form.errors)

    def test_change_form_validates_dni(self):
        user = User.objects.create_user(username="30123456", password=self.password)
        form = UsuarioChangeForm(
            instance=user,
            data={"username": "jperez", "date_joined": user.date_joined, "is_active": True},
        )
        self.assertFalse(form.is_valid())
        self.assertIn("username", form.errors)


class AutorizantesTests(APITestCase):
    def test_any_authenticated_user_lists_active_users_by_full_name(self):
        tesorero = User.objects.create_user(username="30111222", first_name="Ana", last_name="Sosa")
        tesorero.groups.add(Group.objects.get(name="Tesorero"))
        User.objects.create_user(username="30111223", first_name="Luis", last_name="Báez")
        User.objects.create_user(username="30111224", first_name="Inés", last_name="Ruiz", is_active=False)
        self.client.force_authenticate(tesorero)

        response = self.client.get(reverse("usuario-autorizantes"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([user["full_name"] for user in response.data], ["Luis Báez", "Ana Sosa"])
        self.assertEqual(set(response.data[0]), {"id", "full_name"})

    def test_requires_authentication(self):
        self.assertEqual(self.client.get(reverse("usuario-autorizantes")).status_code, status.HTTP_401_UNAUTHORIZED)


class UsuarioApiTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(username="44256087", password="Clave-segura-123")
        self.admin.groups.add(Group.objects.get(name=ADMINISTRADOR))
        self.client.force_authenticate(self.admin)
        self.payload = {
            "dni": "30.123.456",
            "first_name": "Juana",
            "last_name": "Pérez",
            "email": "JPerez@Club.org",
            "role": "Tesorero",
        }

    def create_usuario(self, **overrides):
        return self.client.post(reverse("usuario-list"), {**self.payload, **overrides}, format="json")

    def test_only_users_with_permission_can_access(self):
        tesorero = User.objects.create_user(username="30111222", password="Clave-segura-123")
        tesorero.groups.add(Group.objects.get(name="Tesorero"))
        self.client.force_authenticate(tesorero)

        self.assertEqual(self.client.get(reverse("usuario-list")).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.create_usuario().status_code, status.HTTP_403_FORBIDDEN)

    def test_list_includes_role_and_status(self):
        response = self.client.get(reverse("usuario-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["dni"], "44256087")
        self.assertEqual(response.data[0]["role"], ADMINISTRADOR)
        self.assertTrue(response.data[0]["is_active"])
        self.assertNotIn("password", response.data[0])

    def test_create_uses_dni_as_initial_password(self):
        response = self.create_usuario()

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["dni"], "30123456")
        self.assertEqual(response.data["email"], "jperez@club.org")
        self.assertEqual(response.data["role"], "Tesorero")
        user = User.objects.get(username="30123456")
        self.assertTrue(user.check_password("30123456"))
        self.assertFalse(user.is_staff)

    def test_create_administrador_grants_staff(self):
        self.create_usuario(role=ADMINISTRADOR)
        self.assertTrue(User.objects.get(username="30123456").is_staff)

    def test_create_validates_fields(self):
        cases = {
            "dni": {"dni": "abc"},
            "email": {"email": ""},
            "first_name": {"first_name": ""},
            "role": {"role": "Secretaría"},
        }
        for field, override in cases.items():
            with self.subTest(field=field):
                response = self.create_usuario(**override)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
                self.assertIn(field, response.data)

    def test_create_rejects_duplicated_dni_and_email(self):
        self.create_usuario()

        duplicated_dni = self.create_usuario(email="otro@club.org")
        self.assertIn("dni", duplicated_dni.data)

        duplicated_email = self.create_usuario(dni="31222333", email="jperez@CLUB.org")
        self.assertIn("email", duplicated_email.data)

    def test_update_data_and_role(self):
        user_id = self.create_usuario().data["id"]

        response = self.client.patch(
            reverse("usuario-detail", args=[user_id]),
            {"first_name": "Juana María", "role": "Directivo"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Juana María")
        self.assertEqual(response.data["role"], "Directivo")
        self.assertEqual(User.objects.get(pk=user_id).groups.count(), 1)

    def test_cannot_change_own_role(self):
        response = self.client.patch(
            reverse("usuario-detail", args=[self.admin.pk]), {"role": "Tesorero"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)

    def test_deactivate_blocks_login_and_existing_tokens(self):
        self.create_usuario()
        user = User.objects.get(username="30123456")
        self.client.force_authenticate(None)
        access = self.client.post(
            reverse("auth-login"), {"username": "30123456", "password": "30123456"}, format="json"
        ).data["access"]

        self.client.force_authenticate(self.admin)
        response = self.client.delete(reverse("usuario-detail", args=[user.pk]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(self.client.get(reverse("auth-me")).status_code, status.HTTP_401_UNAUTHORIZED)
        self.client.credentials()
        login = self.client.post(reverse("auth-login"), {"username": "30123456", "password": "30123456"}, format="json")
        self.assertEqual(login.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_deactivate_yourself(self):
        response = self.client.delete(reverse("usuario-detail", args=[self.admin.pk]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)

    def test_activate(self):
        user_id = self.create_usuario().data["id"]
        self.client.delete(reverse("usuario-detail", args=[user_id]))

        response = self.client.post(reverse("usuario-activate", args=[user_id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_active"])

    def test_reset_password_restores_dni(self):
        user_id = self.create_usuario().data["id"]
        user = User.objects.get(pk=user_id)
        user.set_password("Otra-clave-456")
        user.save()

        response = self.client.post(reverse("usuario-reset-password", args=[user_id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        user.refresh_from_db()
        self.assertTrue(user.check_password("30123456"))

    def test_roles_endpoint(self):
        response = self.client.get(reverse("usuario-roles"))
        self.assertEqual(sorted(response.data), sorted([*ROLE_PERMISSIONS, ADMINISTRADOR]))


class MustChangePasswordTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.admin = User.objects.create_user(username="44256087", password="Clave-segura-123")
        self.admin.groups.add(Group.objects.get(name=ADMINISTRADOR))
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            reverse("usuario-list"),
            {"dni": "30123456", "first_name": "Juana", "last_name": "Pérez", "email": "jperez@club.org", "role": "Tesorero"},
            format="json",
        )
        self.user = User.objects.get(pk=response.data["id"])

    def me(self, user):
        # Instancia nueva, como en una request real: la anterior puede tener el perfil en caché
        self.client.force_authenticate(User.objects.get(pk=user.pk))
        return self.client.get(reverse("auth-me")).data["must_change_password"]

    def change_password(self, user, **data):
        self.client.force_authenticate(user)
        return self.client.post(reverse("auth-change-password"), data, format="json")

    def test_new_user_must_change_password(self):
        self.assertTrue(self.me(self.user))

    def test_forced_change_does_not_ask_current_password_and_clears_flag(self):
        response = self.change_password(self.user, new_password="Mi-clave-nueva")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Mi-clave-nueva"))
        self.assertFalse(self.me(self.user))

    def test_user_can_keep_dni_as_password(self):
        response = self.change_password(self.user, new_password="30123456")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(self.me(self.user))

    def test_reset_password_forces_change_again(self):
        self.change_password(self.user, new_password="Mi-clave-nueva")

        self.client.force_authenticate(self.admin)
        self.client.post(reverse("usuario-reset-password", args=[self.user.pk]))

        self.assertTrue(self.me(self.user))

    def test_users_without_perfil_are_not_forced(self):
        self.assertFalse(self.me(self.admin))

    def test_list_shows_flag(self):
        self.client.force_authenticate(self.admin)
        rows = {row["dni"]: row for row in self.client.get(reverse("usuario-list")).data}

        self.assertTrue(rows["30123456"]["must_change_password"])
        self.assertFalse(rows["44256087"]["must_change_password"])


class CreateInitialAdminCommandTests(TestCase):
    def run_command(self, **env):
        output = StringIO()
        with patch.dict(os.environ, env, clear=False):
            call_command("create_initial_admin", stdout=output, stderr=output)
        return output.getvalue()

    def test_creates_administrador_that_must_change_password(self):
        self.run_command(ADMIN_DNI="30.123.456", ADMIN_PASSWORD="clave-del-env")

        user = User.objects.get(username="30123456")
        self.assertTrue(user.check_password("clave-del-env"))
        self.assertEqual(list(user.groups.values_list("name", flat=True)), [ADMINISTRADOR])
        self.assertTrue(user.is_staff)
        self.assertTrue(user.perfil.must_change_password)

    def test_does_nothing_if_user_already_exists(self):
        User.objects.create_user(username="30123456", password="mi-clave")

        output = self.run_command(ADMIN_DNI="30123456", ADMIN_PASSWORD="clave-del-env")

        self.assertIn("ya existe", output)
        self.assertTrue(User.objects.get(username="30123456").check_password("mi-clave"))

    def test_skips_without_env_variables(self):
        output = self.run_command(ADMIN_DNI="", ADMIN_PASSWORD="")

        self.assertIn("no se crea", output)
        self.assertFalse(User.objects.exists())

    def test_invalid_dni_warns_without_failing(self):
        output = self.run_command(ADMIN_DNI="admin", ADMIN_PASSWORD="clave-del-env")

        self.assertIn("ADMIN_DNI inválido", output)
        self.assertFalse(User.objects.exists())
