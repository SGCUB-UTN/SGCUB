import json
from datetime import date, datetime, timedelta, timezone as dt_timezone
from decimal import Decimal
from importlib import import_module

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.db.models import ProtectedError
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase
from django.test.utils import CaptureQueriesContext
from django.urls import reverse
from django.utils import timezone
from django.utils.module_loading import import_string
from django_q.models import Schedule
from django_q.tasks import async_task, fetch
from rest_framework.test import APITestCase

from padron.models import (
	ESTADO_ADMINISTRATIVO_INACTIVO,
	ESTADO_DEPORTIVO_INACTIVO,
	Categoria,
	EstadoAdministrativo,
	EstadoDeportivo,
	Genero,
	Jugador,
	Localidad,
	Persona,
	Socio,
)
from .generators import GeneradorItemsCuota
from .models import (
	AccionAuditoriaChoices,
	Beca,
	Comprobante,
	ConceptoMovimiento,
	ConfiguracionFinanciera,
	CuentaCorriente,
	Cuota,
	DetalleImputacion,
	Devolucion,
	EjecucionTareaCuota,
	EstadoBecaChoices,
	EstadoItemCuotaChoices,
	EstadoPagoChoices,
	EstadoCuotaChoices,
	ExclusionBeca,
	Imputacion,
	ItemCuota,
	ItemPago,
	MedioPago,
	MovimientoCuenta,
	OrigenEjecucionChoices,
	Pago,
	RegistroAuditoria,
	SecuenciaComprobante,
	TipoTareaCuotaChoices,
)
from .pdf_utils import format_amount
from .period_summary import period_summary
from .receipts import render_receipt_pdf
from .serializers import CuentaCorrienteEstadoSerializer, MedioPagoSerializer
from .services import (
	apply_surcharges,
	assign_benefit,
	cancel_scholarship,
	create_manual_refund,
	register_income,
	create_cuota,
	cuota_state,
	finish_expired_scholarships,
	generar_cuotas_mensuales,
	grant_scholarship,
	next_receipt_number,
	pending_amounts,
	register_payment,
	revert_payment,
	sync_cuota_charge,
	update_scholarship,
)
from .tasks import apply_scheduled_surcharges, generate_scheduled_cuotas, run_cuota_generation, run_manual_surcharges


def crear_socio(dni, socio_inactivo=False, con_jugador=False, jugador_inactivo=False):
	persona = Persona.objects.create(nombre="Socio", apellido="Prueba", dni=dni)
	socio = Socio.objects.create(persona=persona)
	if socio_inactivo:
		socio.estado_administrativo = EstadoAdministrativo.objects.get_or_create(
			nombre=ESTADO_ADMINISTRATIVO_INACTIVO,
		)[0]
		socio.save(update_fields=["estado_administrativo"])

	if con_jugador:
		estado_deportivo = EstadoDeportivo.objects.get_or_create(
			nombre=ESTADO_DEPORTIVO_INACTIVO if jugador_inactivo else "Activo",
		)[0]
		Jugador.objects.create(
			socio=socio,
			categoria=Categoria.objects.create(
				nombre=f"Categoria {dni}",
				anio_vigente=2026,
				edad_maxima=18,
			),
			estado=estado_deportivo,
		)
	return Socio.objects.get(pk=socio.pk)


def account_for(socio):
	return CuentaCorriente.objects.get(socio=socio)


def historical_account_id(apps, dni):
	persona = apps.get_model("padron", "Persona").objects.create(nombre="Socio", apellido="Historico", dni=dni)
	socio = apps.get_model("padron", "Socio").objects.create(persona=persona)
	return apps.get_model("finanzas", "CuentaCorriente").objects.create(socio=socio).pk


def crear_cuota_con_cargo(cuenta, periodo, monto, estado=EstadoCuotaChoices.EN_FECHA, venc1=date(2026, 9, 10), venc2=date(2026, 9, 20)):
	cuota = Cuota.objects.create(
		estado_cuota=estado,
		fecha_venc1=venc1,
		fecha_venc2=venc2,
		periodo=periodo,
	)
	ItemCuota.objects.create(
		cuota=cuota,
		concepto="CuotaSocial",
		fecha_aplicacion=date(2026, 9, 1),
		monto=Decimal(monto),
	)
	MovimientoCuenta.objects.create(
		cuenta_corriente=cuenta,
		cuota=cuota,
		tipo_movimiento="Cargo",
		fecha="2026-09-01T12:00:00Z",
		monto=Decimal(monto),
		concepto=f"Cuota {periodo}",
	)
	return cuota


class GeneradorItemsCuotaTests(TestCase):
	def conceptos(self, socio):
		return [item.concepto for item in GeneradorItemsCuota(socio, date(2026, 10, 1)).build_items()]

	def test_socio_activo_solo_genera_item_social(self):
		self.assertEqual(self.conceptos(crear_socio("20000001")), ["CuotaSocial"])

	def test_socio_y_jugador_activos_generan_social_y_deportivo(self):
		socio = crear_socio("20000002", con_jugador=True)

		self.assertEqual(self.conceptos(socio), ["CuotaSocial", "CuotaDeportiva"])

	def test_jugador_dado_de_baja_solo_genera_item_social(self):
		socio = crear_socio("20000003", con_jugador=True, jugador_inactivo=True)

		self.assertEqual(self.conceptos(socio), ["CuotaSocial"])

	def test_socio_dado_de_baja_no_genera_items(self):
		socio = crear_socio("20000004", socio_inactivo=True, con_jugador=True)

		self.assertEqual(self.conceptos(socio), [])


def next_period_start(months=1):
	first_day = timezone.localdate().replace(day=1)
	for _ in range(months):
		first_day = (first_day + timedelta(days=32)).replace(day=1)
	return first_day


def guardar_version(client, periodo, responsable="Ana Tesorera", **datos):
	return client.post(
		reverse("configuracion-guardar"),
		json.dumps({"responsable": responsable, "financiera": {"periodo_vigencia": periodo, **datos}}),
		content_type="application/json",
	)


class ConfiguracionFinancieraTests(APITestCase):
	def setUp(self):
		self.usuario = get_user_model().objects.create_user(username="tesorero", first_name="Ana", last_name="Tesorera")
		self.client.force_authenticate(user=self.usuario)
		self.periodo = next_period_start().strftime("%Y-%m")

	def actualizar(self, periodo=None, **datos):
		return guardar_version(self.client, periodo or self.periodo, **datos)

	def test_valores_iniciales(self):
		response = self.client.get(reverse("configuracion-financiera"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(Decimal(response.data["monto_cuota_social"]), Decimal("1000.00"))
		self.assertEqual(Decimal(response.data["monto_cuota_deportiva"]), Decimal("1500.00"))
		self.assertEqual(response.data["dia_vencimiento_1"], 10)
		self.assertEqual(response.data["dia_vencimiento_2"], 20)
		self.assertEqual(Decimal(response.data["valor_recargo_1"]), Decimal("0.00"))
		self.assertEqual(Decimal(response.data["valor_recargo_2"]), Decimal("0.00"))

	def test_las_cuotas_nuevas_usan_montos_y_vencimientos_configurados(self):
		response = self.actualizar(
			monto_cuota_social="1200.00",
			monto_cuota_deportiva="1800.00",
			dia_vencimiento_1=5,
			dia_vencimiento_2=15,
		)
		self.assertEqual(response.status_code, 200, response.data)
		socio = crear_socio("40000001", con_jugador=True)
		inicio = next_period_start()

		generar_cuotas_mensuales(inicio, today=inicio)

		cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio, periodo=self.periodo)
		self.assertEqual(cuota.fecha_venc1, inicio.replace(day=5))
		self.assertEqual(cuota.fecha_venc2, inicio.replace(day=15))
		self.assertEqual(cuota.movimiento.monto, Decimal("3000.00"))

	def test_la_nueva_version_no_afecta_los_periodos_anteriores(self):
		self.actualizar(monto_cuota_social="1200.00")

		self.assertEqual(ConfiguracionFinanciera.load().monto_cuota_social, Decimal("1000.00"))
		self.assertEqual(ConfiguracionFinanciera.load(self.periodo).monto_cuota_social, Decimal("1200.00"))
		self.assertEqual(ConfiguracionFinanciera.load(next_period_start(5)).monto_cuota_social, Decimal("1200.00"))

	def test_la_ultima_version_creada_para_un_periodo_es_la_vigente(self):
		self.actualizar(monto_cuota_social="1200.00")
		self.actualizar(monto_cuota_deportiva="2000.00")

		configuracion = ConfiguracionFinanciera.load(self.periodo)
		self.assertEqual(configuracion.monto_cuota_social, Decimal("1200.00"))
		self.assertEqual(configuracion.monto_cuota_deportiva, Decimal("2000.00"))

	def test_registra_quien_actualizo_y_desde_que_periodo(self):
		self.actualizar(valor_recargo_1="150.00")

		configuracion = ConfiguracionFinanciera.load(self.periodo)
		self.assertEqual(configuracion.usuario_creacion, self.usuario)
		self.assertEqual(configuracion.periodo_vigencia, self.periodo)
		self.assertEqual(configuracion.valor_recargo_1, Decimal("150.00"))

	def test_historial_de_versiones_con_cambios(self):
		self.actualizar(monto_cuota_social="1200.00", dia_vencimiento_1=5)

		response = self.client.get(reverse("configuracion-financiera-versiones"))

		self.assertEqual(response.status_code, 200)
		ultima = response.data[0]
		self.assertEqual(ultima["periodo_vigencia"], self.periodo)
		self.assertEqual(ultima["usuario_nombre"], "Ana Tesorera")
		self.assertEqual(
			{cambio["campo"]: (cambio["anterior"], cambio["nuevo"]) for cambio in ultima["cambios"]},
			{"monto_cuota_social": ("1000.00", "1200.00"), "dia_vencimiento_1": ("10", "5")},
		)

	def test_registra_el_responsable_y_versiona_la_inscripcion(self):
		response = self.actualizar(monto_inscripcion="5000.00", responsable="Carlos Díaz")

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["financiera"]["responsable"], "Carlos Díaz")
		self.assertEqual(ConfiguracionFinanciera.load(self.periodo).monto_inscripcion, Decimal("5000.00"))
		self.assertEqual(ConfiguracionFinanciera.load().monto_inscripcion, Decimal("0.00"))

	def test_el_endpoint_de_la_configuracion_financiera_es_de_solo_lectura(self):
		response = self.client.post(reverse("configuracion-financiera"), {"periodo_vigencia": self.periodo}, format="json")

		self.assertEqual(response.status_code, 405)

	def test_el_periodo_de_vigencia_debe_ser_posterior_al_actual(self):
		actual = timezone.localdate().strftime("%Y-%m")
		for periodo in (actual, "2020-01", "2026/13", ""):
			with self.subTest(periodo=periodo):
				response = guardar_version(self.client, periodo, monto_cuota_social="1200.00")
				self.assertEqual(response.status_code, 400)
				self.assertIn("periodo_vigencia", response.data["financiera"])

	def test_rechaza_una_version_sin_cambios(self):
		response = self.actualizar(monto_cuota_social="1000.00")

		self.assertEqual(response.status_code, 400)
		self.assertEqual(ConfiguracionFinanciera.objects.count(), 1)

	def test_validaciones(self):
		casos = [
			({"dia_vencimiento_1": 20, "dia_vencimiento_2": 10}, "dia_vencimiento_2"),
			({"dia_vencimiento_1": 0}, "dia_vencimiento_1"),
			({"dia_vencimiento_2": 32}, "dia_vencimiento_2"),
			({"dia_vencimiento_1": 29, "dia_vencimiento_2": 29}, "dia_vencimiento_1"),
			({"monto_cuota_social": "0.00"}, "monto_cuota_social"),
			({"valor_recargo_1": "-1.00"}, "valor_recargo_1"),
			({"tipo_recargo_2": "Porcentaje", "valor_recargo_2": "120.00"}, "valor_recargo_2"),
			({"tipo_recargo_1": "Otro"}, "tipo_recargo_1"),
		]
		for datos, campo in casos:
			with self.subTest(datos=datos):
				response = self.actualizar(**datos)
				self.assertEqual(response.status_code, 400)
				self.assertIn(campo, response.data["financiera"])

	def test_calculo_de_recargos_fijo_y_porcentual(self):
		self.actualizar(
			tipo_recargo_1="MontoFijo",
			valor_recargo_1="200.00",
			tipo_recargo_2="Porcentaje",
			valor_recargo_2="10.00",
		)
		configuracion = ConfiguracionFinanciera.load(self.periodo)

		self.assertEqual(configuracion.surcharge(1, Decimal("2500.00")), Decimal("200.00"))
		self.assertEqual(configuracion.surcharge(2, Decimal("2500.00")), Decimal("250.00"))
		self.assertEqual(configuracion.surcharge(2, Decimal("1333.33")), Decimal("133.33"))


class GeneracionProgramadaTests(TestCase):
	def setUp(self):
		ConfiguracionFinanciera.objects.create(dia_generacion=5)
		self.socio = crear_socio("61000001")

	def test_genera_solo_el_dia_configurado(self):
		antes = generate_scheduled_cuotas(today=date(2026, 10, 4))
		self.assertEqual(antes["cuotas_creadas"], 0)
		self.assertFalse(Cuota.objects.exists())

		resultado = generate_scheduled_cuotas(today=date(2026, 10, 5))

		self.assertEqual(resultado["cuotas_creadas"], 3)
		self.assertEqual(
			list(Cuota.objects.order_by("periodo").values_list("periodo", flat=True)),
			["2026-10", "2026-11", "2026-12"],
		)

	def test_usa_el_dia_de_la_version_vigente_para_el_mes(self):
		ConfiguracionFinanciera.objects.create(periodo_vigencia="2026-11", dia_generacion=3)

		self.assertEqual(generate_scheduled_cuotas(today=date(2026, 11, 5))["cuotas_creadas"], 0)
		self.assertEqual(generate_scheduled_cuotas(today=date(2026, 11, 3))["cuotas_creadas"], 3)

	def test_al_mes_siguiente_solo_genera_la_cuota_del_segundo_mes_proximo(self):
		primero = generate_scheduled_cuotas(today=date(2026, 10, 5))
		self.assertEqual(primero["cuotas_creadas"], 3)

		segundo = generate_scheduled_cuotas(today=date(2026, 11, 5))

		self.assertEqual(segundo["cuotas_creadas"], 1)
		self.assertEqual(segundo["cuotas_existentes"], 2)
		self.assertEqual(
			list(Cuota.objects.order_by("periodo").values_list("periodo", flat=True)),
			["2026-10", "2026-11", "2026-12", "2027-01"],
		)

	def test_valida_el_dia_de_generacion(self):
		self.client.force_login(get_user_model().objects.create_user(username="tesorero"))
		periodo = next_period_start().strftime("%Y-%m")
		for datos in ({"dia_generacion": 0}, {"dia_generacion": 29}, {"dia_generacion": 12, "dia_vencimiento_1": 10}):
			with self.subTest(datos=datos):
				response = guardar_version(self.client, periodo, **datos)
				self.assertEqual(response.status_code, 400)
				self.assertIn("dia_generacion", response.json()["financiera"])


class ActualizacionCuotasPorConfiguracionTests(APITestCase):
	"""A new version updates every unpaid cuota (partially paid included) of the periods it applies to."""

	def setUp(self):
		self.usuario = get_user_model().objects.create_user(username="tesorero", first_name="Ana", last_name="Tesorera")
		self.client.force_authenticate(user=self.usuario)
		self.inicio = next_period_start()
		self.periodo = self.inicio.strftime("%Y-%m")

	def nueva_version(self, periodo=None, **datos):
		return guardar_version(self.client, periodo or self.periodo, **datos)

	def cuota(self, dni, periodo=None, con_jugador=False):
		return create_cuota(crear_socio(dni, con_jugador=con_jugador), periodo or self.periodo)

	def pagar(self, cuota, monto):
		register_payment(
			cuota.movimiento.cuenta_corriente.socio_id,
			[cuota.pk],
			[{"medio_de_pago": "Efectivo", "monto": Decimal(monto)}],
			Decimal(monto),
		)

	def test_actualiza_montos_movimiento_y_saldo_de_cuotas_impagas(self):
		cuota = self.cuota("60000001", con_jugador=True)

		response = self.nueva_version(monto_cuota_social="1200.00", monto_cuota_deportiva="1800.00")

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["financiera"]["cuotas_actualizadas"], 1)
		cuota.refresh_from_db()
		cuota.movimiento.refresh_from_db()
		self.assertEqual(cuota.movimiento.monto, Decimal("3000.00"))
		self.assertEqual(
			sorted(cuota.items.values_list("concepto", "monto")),
			[("CuotaDeportiva", Decimal("1800.00")), ("CuotaSocial", Decimal("1200.00"))],
		)
		anulado = ItemCuota.all_objects.anulados().get(cuota=cuota, concepto="CuotaSocial")
		self.assertEqual(anulado.monto, Decimal("1000.00"))
		self.assertEqual(anulado.usuario_anulacion, self.usuario)
		self.assertIn(self.periodo, anulado.motivo_anulacion)

	def test_actualiza_las_cuotas_parcialmente_pagas(self):
		cuota = self.cuota("60000002")
		self.pagar(cuota, "400.00")

		self.nueva_version(monto_cuota_social="1200.00")

		cuota.refresh_from_db()
		self.assertEqual(cuota.movimiento.monto, Decimal("1200.00"))
		self.assertEqual(pending_amounts([cuota])[cuota.pk], Decimal("800.00"))
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.EN_FECHA)

	def test_no_modifica_las_cuotas_pagas(self):
		cuota = self.cuota("60000003")
		self.pagar(cuota, "1000.00")

		response = self.nueva_version(monto_cuota_social="1200.00")

		self.assertEqual(response.data["financiera"]["cuotas_actualizadas"], 0)
		cuota.refresh_from_db()
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(cuota.movimiento.monto, Decimal("1000.00"))

	def test_actualiza_los_vencimientos(self):
		cuota = self.cuota("60000004")

		self.nueva_version(dia_vencimiento_1=5, dia_vencimiento_2=15)

		cuota.refresh_from_db()
		self.assertEqual((cuota.fecha_venc1, cuota.fecha_venc2), (self.inicio.replace(day=5), self.inicio.replace(day=15)))

	def test_no_modifica_cuotas_de_periodos_anteriores_a_la_vigencia(self):
		cuota = self.cuota("60000005")

		response = self.nueva_version(periodo=next_period_start(2).strftime("%Y-%m"), monto_cuota_social="1200.00")

		self.assertEqual(response.data["financiera"]["cuotas_actualizadas"], 0)
		cuota.refresh_from_db()
		self.assertEqual(cuota.movimiento.monto, Decimal("1000.00"))

	def test_no_modifica_cuotas_de_una_version_programada_posterior(self):
		posterior = next_period_start(2).strftime("%Y-%m")
		self.nueva_version(periodo=posterior, monto_cuota_social="1500.00")
		cuota_posterior = self.cuota("60000006", periodo=posterior)
		cuota = self.cuota("60000007")

		self.nueva_version(monto_cuota_social="1200.00")

		cuota.refresh_from_db()
		cuota_posterior.refresh_from_db()
		self.assertEqual(cuota.movimiento.monto, Decimal("1200.00"))
		self.assertEqual(cuota_posterior.movimiento.monto, Decimal("1500.00"))

	def test_recalcula_las_becas_porcentuales(self):
		socio = crear_socio("60000008")
		grant_scholarship(socio.pk, "Porcentaje", Decimal("50.00"), timezone.localdate(), "Beca deportiva", "Comisión")
		cuota = create_cuota(socio, self.periodo)
		self.assertEqual(cuota.movimiento.monto, Decimal("500.00"))

		self.nueva_version(monto_cuota_social="1200.00")

		cuota.refresh_from_db()
		self.assertEqual(cuota.items.get(concepto="Beca").monto, Decimal("600.00"))
		self.assertEqual(cuota.movimiento.monto, Decimal("600.00"))

	def test_impacto_cuenta_las_cuotas_que_se_actualizarian(self):
		self.cuota("60000009")
		pagada = self.cuota("60000010")
		self.pagar(pagada, "1000.00")

		response = self.client.get(reverse("configuracion-financiera-impacto"), {"periodo": self.periodo})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["cuotas_afectadas"], 1)

	def test_actualiza_cuotas_futuras_generadas_excepto_las_pagas_totalmente(self):
		socio_impago = crear_socio("60000011", con_jugador=True)
		socio_pago_adelantado = crear_socio("60000012", con_jugador=True)
		generar_cuotas_mensuales(timezone.localdate().replace(day=1), today=timezone.localdate())

		periodo_actual = timezone.localdate().strftime("%Y-%m")
		periodo_siguiente = next_period_start(1).strftime("%Y-%m")
		periodo_subsiguiente = next_period_start(2).strftime("%Y-%m")
		cuota_actual_paga = Cuota.objects.get(
			movimiento__cuenta_corriente__socio=socio_pago_adelantado,
			periodo=periodo_actual,
		)
		cuota_futura_paga = Cuota.objects.get(
			movimiento__cuenta_corriente__socio=socio_pago_adelantado,
			periodo=periodo_siguiente,
		)
		self.pagar(cuota_actual_paga, "2500.00")
		self.pagar(cuota_futura_paga, "2500.00")

		response = self.nueva_version(
			periodo=periodo_siguiente,
			monto_cuota_social="1300.00",
			monto_cuota_deportiva="1700.00",
		)

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["financiera"]["cuotas_actualizadas"], 3)
		cuota_futura_paga.refresh_from_db()
		self.assertEqual(cuota_futura_paga.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(cuota_futura_paga.movimiento.monto, Decimal("2500.00"))

		for socio, periodo in (
			(socio_impago, periodo_siguiente),
			(socio_impago, periodo_subsiguiente),
			(socio_pago_adelantado, periodo_subsiguiente),
		):
			cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio, periodo=periodo)
			self.assertEqual(cuota.movimiento.monto, Decimal("3000.00"))

	def test_revertir_version_programada_restaura_montos_anteriores_en_cuotas_impagas(self):
		cuota = self.cuota("60000013")
		self.pagar(cuota, "400.00")
		creada = self.nueva_version(monto_cuota_social="1200.00").data["financiera"]
		cuota.refresh_from_db()
		self.assertEqual(cuota.movimiento.monto, Decimal("1200.00"))

		response = self.client.post(
			reverse("configuracion-financiera-revertir", args=[creada["configuracion_financiera_id"]]),
			format="json",
		)

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["cuotas_actualizadas"], 1)
		cuota.refresh_from_db()
		self.assertEqual(cuota.movimiento.monto, Decimal("1000.00"))
		self.assertEqual(pending_amounts([cuota])[cuota.pk], Decimal("600.00"))


class MediosDePagoTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))

	def crear(self, nombre):
		return self.client.post(reverse("medio-pago-list"), {"nombre": nombre}, format="json")

	def test_lista_los_medios_iniciales(self):
		response = self.client.get(reverse("medio-pago-list"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			{medio["codigo"] for medio in response.data},
			{"Efectivo", "Transferencia", "BilleteraVirtual"},
		)

	def test_alta_genera_el_codigo_y_rechaza_duplicados(self):
		response = self.crear("Tarjeta de débito")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data["codigo"], "TarjetaDeDebito")
		self.assertEqual(self.crear("tarjeta de DÉBITO").status_code, 400)

	def test_un_medio_deshabilitado_no_acepta_pagos_ni_figura_en_los_activos(self):
		medio = MedioPago.objects.get(codigo="Transferencia")
		self.client.patch(reverse("medio-pago-detail", args=[medio.pk]), {"activo": False}, format="json")

		activos = self.client.get(reverse("medio-pago-list"), {"activos": "true"}).data
		serializer = MedioPagoSerializer(data={"medio_de_pago": "Transferencia", "monto": "10.00"})

		self.assertNotIn("Transferencia", [item["codigo"] for item in activos])
		self.assertFalse(serializer.is_valid())
		self.assertIn("medio_de_pago", serializer.errors)

	def test_no_elimina_un_medio_usado_en_pagos(self):
		pago = Pago.objects.create(estado_pago=EstadoPagoChoices.ACREDITADO)
		ItemPago.objects.create(pago=pago, medio_de_pago="Efectivo", monto=Decimal("10.00"))
		medio = MedioPago.objects.get(codigo="Efectivo")

		response = self.client.delete(reverse("medio-pago-detail", args=[medio.pk]))

		self.assertEqual(response.status_code, 400)
		self.assertTrue(MedioPago.objects.filter(pk=medio.pk).exists())

	def test_elimina_un_medio_sin_pagos(self):
		medio_id = self.crear("Cheque").data["medio_pago_id"]

		response = self.client.delete(reverse("medio-pago-detail", args=[medio_id]))

		self.assertEqual(response.status_code, 204)
		self.assertFalse(MedioPago.objects.filter(pk=medio_id).exists())

	def test_debe_quedar_al_menos_un_medio_habilitado(self):
		MedioPago.objects.exclude(codigo="Efectivo").update(activo=False)
		medio = MedioPago.objects.get(codigo="Efectivo")

		response = self.client.patch(reverse("medio-pago-detail", args=[medio.pk]), {"activo": False}, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertTrue(MedioPago.objects.get(pk=medio.pk).activo)


class MediosDePagoEnPagosTests(APITestCase):
	"""The payment method catalog applies to the payment flow and the receipt."""

	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.socio = crear_socio("62000001")
		self.cuota = create_cuota(self.socio, "2026-10", today=date(2026, 10, 1))

	def pagar(self, medio):
		return self.client.post(reverse("registrar-pago"), {
			"socio_id": self.socio.pk,
			"cuota_ids": [self.cuota.pk],
			"monto_total": "1000.00",
			"medios": [{"medio_de_pago": medio, "monto": "1000.00"}],
		}, format="json")

	def test_no_registra_pagos_con_un_medio_deshabilitado(self):
		MedioPago.objects.filter(codigo="Transferencia").update(activo=False)

		response = self.pagar("Transferencia")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(Pago.objects.exists())

	def test_registra_pagos_con_un_medio_nuevo_y_el_recibo_muestra_su_nombre(self):
		codigo = self.client.post(reverse("medio-pago-list"), {"nombre": "Tarjeta de debito"}, format="json").data["codigo"]

		response = self.pagar(codigo)

		self.assertEqual(response.status_code, 201, response.data)
		receipt = Comprobante.objects.get()
		self.assertIn(b"Tarjeta de debito", render_receipt_pdf(receipt))

	def test_el_recibo_usa_el_nombre_actual_del_medio(self):
		self.pagar("Transferencia")
		medio = MedioPago.objects.get(codigo="Transferencia")
		self.client.patch(reverse("medio-pago-detail", args=[medio.pk]), {"nombre": "Transferencia bancaria"}, format="json")

		self.assertIn(b"Transferencia bancaria", render_receipt_pdf(Comprobante.objects.get()))


class ConceptosMovimientoTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="caja"))

	def crear(self, nombre, origen="Ingreso"):
		return self.client.post(reverse("concepto-movimiento-list"), {"nombre": nombre, "origen": origen}, format="json")

	def test_lista_los_conceptos_iniciales_filtrados_por_origen(self):
		response = self.client.get(reverse("concepto-movimiento-list"), {"origen": "Ingreso"})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(
			[concepto["nombre"] for concepto in response.data],
			["Venta de indumentaria", "Donación", "Otro ingreso"],
		)

	def test_alta_de_concepto_nuevo(self):
		response = self.crear("  Rifa anual  ")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data["nombre"], "Rifa anual")
		self.assertTrue(ConceptoMovimiento.objects.filter(nombre="Rifa anual", origen="Ingreso").exists())

	def test_alta_repetida_devuelve_el_concepto_existente(self):
		existente = ConceptoMovimiento.objects.get(nombre="Donación", origen="Ingreso")

		# Sin acento y en mayúsculas debe devolver el mismo existente
		response = self.crear("DONACION")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["concepto_movimiento_id"], existente.pk)
		self.assertEqual(ConceptoMovimiento.objects.filter(origen="Ingreso").count(), 3)

	def test_el_mismo_nombre_puede_existir_en_otro_origen(self):
		response = self.crear("Donación", origen="DevolucionManual")

		self.assertEqual(response.status_code, 201, response.data)

	def test_rechaza_nota_de_credito_y_nombre_vacio(self):
		self.assertEqual(self.crear("Ajuste", origen="NotaCredito").status_code, 400)
		self.assertEqual(self.crear("Ajuste", origen="Egreso").status_code, 400)
		self.assertEqual(self.crear("   ").status_code, 400)

	def test_eliminar_concepto_no_utilizado(self):
		nuevo = self.crear("Rifa fin de año").data["concepto_movimiento_id"]

		response = self.client.delete(reverse("concepto-movimiento-detail", args=[nuevo]))

		self.assertEqual(response.status_code, 204)
		self.assertFalse(ConceptoMovimiento.objects.filter(pk=nuevo).exists())

	def test_no_se_pueden_eliminar_conceptos_protegidos(self):
		otro = ConceptoMovimiento.objects.get(nombre="Otro ingreso")

		response = self.client.delete(reverse("concepto-movimiento-detail", args=[otro.pk]))

		self.assertEqual(response.status_code, 400)
		self.assertTrue(ConceptoMovimiento.objects.filter(pk=otro.pk).exists())

	def test_no_se_puede_eliminar_un_concepto_utilizado(self):
		socio = crear_socio("49000000")
		register_income(socio.pk, "Venta de indumentaria", [{"medio_de_pago": "Efectivo", "monto": Decimal("500.00")}], Decimal("500.00"))
		create_manual_refund(socio.pk, "Devolución por transferencia duplicada", Decimal("100.00"), "Efectivo", "Tesorera")

		for nombre, origen in (("Venta de indumentaria", "Ingreso"), ("Devolución por transferencia duplicada", "DevolucionManual")):
			with self.subTest(nombre=nombre):
				concepto = ConceptoMovimiento.objects.get(nombre=nombre, origen=origen)
				response = self.client.delete(reverse("concepto-movimiento-detail", args=[concepto.pk]))
				self.assertEqual(response.status_code, 400)
				self.assertTrue(ConceptoMovimiento.objects.filter(pk=concepto.pk).exists())


class IngresosTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="caja"))
		self.socio = crear_socio("49000001")
		self.cuota = crear_cuota_con_cargo(account_for(self.socio), "2026-10", "50000.00")

	def registrar(self, monto="10000.00", medios=None, concepto="Venta de indumentaria"):
		return self.client.post(reverse("registrar-ingreso"), {
			"socio_id": self.socio.pk,
			"concepto": concepto,
			"monto_total": monto,
			"medios": medios or [{"medio_de_pago": "Transferencia", "monto": monto}],
		}, format="json")

	def deuda(self):
		return self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data["total_adeudado"]

	def test_registra_un_ingreso_con_recibo_sin_tocar_la_deuda(self):
		response = self.registrar()

		self.assertEqual(response.status_code, 201, response.data)
		self.assertTrue(response.data["es_ingreso"])
		self.assertEqual(response.data["concepto"], "Venta de indumentaria")
		self.assertEqual(response.data["periodos"], [])
		movimiento = MovimientoCuenta.objects.get(pago_id=response.data["pago"])
		self.assertEqual(movimiento.tipo_movimiento, "Ingreso")
		self.assertEqual(movimiento.cuenta_corriente.socio, self.socio)
		self.assertFalse(Imputacion.objects.exists())
		self.assertEqual(self.deuda(), Decimal("50000.00"))
		self.cuota.refresh_from_db()
		self.assertEqual(self.cuota.estado_cuota, EstadoCuotaChoices.EN_FECHA)

	def test_admite_varios_medios_dinamicos(self):
		codigo = self.client.post(reverse("medio-pago-list"), {"nombre": "Cuenta DNI"}, format="json").data["codigo"]

		response = self.registrar("3000.00", [
			{"medio_de_pago": codigo, "monto": "1000.00"},
			{"medio_de_pago": "Efectivo", "monto": "2000.00"},
		])

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(
			sorted((item["medio_de_pago"], item["monto"]) for item in response.data["pago_detalle"]["items_pago"]),
			[(codigo, "1000.00"), ("Efectivo", "2000.00")],
		)

	def test_el_medio_de_pago_es_obligatorio(self):
		response = self.client.post(reverse("registrar-ingreso"), {
			"socio_id": self.socio.pk, "concepto": "Donación", "monto_total": "100.00", "medios": [],
		}, format="json")

		self.assertEqual(response.status_code, 400)
		self.assertIn("medios", response.data)

	def test_los_medios_deben_sumar_el_total(self):
		response = self.registrar("100.00", [{"medio_de_pago": "Efectivo", "monto": "90.00"}])

		self.assertEqual(response.status_code, 400)

	def test_el_recibo_es_el_de_cuotas_con_el_concepto_en_lugar_de_periodos(self):
		comprobante = self.registrar().data

		pdf = self.client.get(reverse("comprobante-pdf", args=[comprobante["comprobante_id"]]))

		self.assertEqual(pdf.status_code, 200)
		self.assertIn(b"RECIBO X", pdf.content)
		self.assertIn(b"Venta de indumentaria", pdf.content)
		self.assertNotIn(b"Per\xc3\xadodos abonados", pdf.content)
		self.assertIn(f"comprobante-X-{comprobante['numero']:08d}.pdf", pdf["Content-Disposition"])

	def test_comparte_la_numeracion_de_los_recibos_de_cuotas(self):
		primero = self.registrar().data["numero"]
		segundo = self.registrar().data["numero"]

		self.assertEqual(segundo, primero + 1)

	def test_anular_un_ingreso_no_toca_la_deuda_y_permite_devolver_el_dinero(self):
		comprobante = self.registrar().data

		response = self.client.post(reverse("revertir-pago", args=[comprobante["pago"]]), {
			"motivo": "Talle equivocado", "responsable": "Tesorera",
		}, format="json")

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["estado"], "Anulado")
		self.assertEqual(response.data["anulacion"]["responsable"], "Tesorera")
		self.assertEqual(self.deuda(), Decimal("50000.00"))
		nota = self.client.post(reverse("emitir-nota-credito", args=[comprobante["comprobante_id"]]), {
			"monto": "10000.00", "medio_de_pago": "Efectivo", "motivo": "Devolución de la compra", "responsable": "Tesorera",
		}, format="json")
		self.assertEqual(nota.status_code, 201, nota.data)


class DevolucionesManualesTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="caja"))
		self.socio = crear_socio("49000003")
		self.cuota = crear_cuota_con_cargo(account_for(self.socio), "2026-10", "20000.00")

	def devolver(self, **extra):
		datos = {
			"socio_id": self.socio.pk,
			"concepto": "Devolución por error en monto transferido",
			"monto": "180000.00",
			"medio_de_pago": "Transferencia",
			"responsable": "Tesorera",
		}
		datos.update(extra)
		return self.client.post(reverse("devolucion-list"), datos, format="json")

	def test_registra_la_devolucion_sin_afectar_deuda_ni_ingresos(self):
		response = self.devolver()

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data["tipo"], "Manual")
		self.assertEqual(response.data["codigo"], "DEV-X 00000001")
		self.assertEqual(response.data["responsable"], "Tesorera")
		self.assertEqual(response.data["usuario_nombre"], "caja")
		self.assertIsNone(response.data["comprobante_anulado"])
		self.assertFalse(Pago.objects.exists())
		self.assertEqual(MovimientoCuenta.objects.count(), 1)
		self.cuota.refresh_from_db()
		self.assertEqual(self.cuota.estado_cuota, EstadoCuotaChoices.EN_FECHA)

	def test_el_responsable_y_el_medio_son_obligatorios(self):
		self.assertEqual(self.devolver(responsable="").status_code, 400)
		self.assertEqual(self.devolver(medio_de_pago="Inexistente").status_code, 400)

	def test_genera_su_comprobante_con_el_mismo_formato(self):
		devolucion = self.devolver().data

		pdf = self.client.get(reverse("devolucion-pdf", args=[devolucion["devolucion_id"]]))

		self.assertEqual(pdf.status_code, 200)
		self.assertIn(b"DEVOLUCI", pdf.content)
		self.assertIn(b"DEV-X 00000001", pdf.content)
		self.assertIn(b"Tesorera", pdf.content)
		self.assertIn("devolucion-00000001.pdf", pdf["Content-Disposition"])

	def test_lista_filtrando_por_socio_y_tipo(self):
		self.devolver()
		otro = crear_socio("49000004")
		create_manual_refund(otro.pk, "Otra devolución", Decimal("10.00"), "Efectivo", "Tesorera")

		response = self.client.get(reverse("devolucion-list"), {"socio_id": self.socio.pk, "tipo": "Manual"})

		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["socio"]["socio_id"], self.socio.pk)


class BecaModeloTests(TestCase):
	def setUp(self):
		self.socio = crear_socio("50000001")

	def beca(self, **datos):
		valores = {
			"socio": self.socio,
			"fecha_aplicacion": date(2026, 10, 1),
			"fecha_fin": date(2026, 12, 31),
			"motivo": "Situación económica",
		}
		valores.update(datos)
		return Beca(**valores)

	def test_descuento_porcentual_sobre_la_base(self):
		self.assertEqual(self.beca(porcentaje=Decimal("25")).discount_for(Decimal("2500.00")), Decimal("625.00"))
		self.assertEqual(self.beca(porcentaje=Decimal("33.33")).discount_for(Decimal("1000.00")), Decimal("333.30"))

	def test_monto_fijo_se_topea_a_la_base(self):
		self.assertEqual(self.beca(monto=Decimal("800.00")).discount_for(Decimal("2500.00")), Decimal("800.00"))
		self.assertEqual(self.beca(monto=Decimal("1500.00")).discount_for(Decimal("1000.00")), Decimal("1000.00"))

	def test_cubre_los_periodos_que_se_superponen_con_la_vigencia(self):
		beca = self.beca(monto=Decimal("100.00"), fecha_aplicacion=date(2026, 10, 15), fecha_fin=date(2026, 12, 10))

		self.assertFalse(beca.covers_period(date(2026, 9, 1)))
		self.assertTrue(beca.covers_period(date(2026, 10, 1)))
		self.assertTrue(beca.covers_period(date(2026, 11, 1)))
		self.assertTrue(beca.covers_period(date(2026, 12, 1)))
		self.assertFalse(beca.covers_period(date(2027, 1, 1)))

	def test_la_base_exige_monto_o_porcentaje_pero_no_ambos(self):
		for datos in ({}, {"monto": Decimal("100.00"), "porcentaje": Decimal("10")}):
			with self.subTest(datos=datos):
				with self.assertRaises(IntegrityError), transaction.atomic():
					self.beca(**datos).save()

	def test_sin_fecha_de_fin_cubre_todos_los_periodos_desde_el_alta(self):
		beca = self.beca(monto=Decimal("100.00"), fecha_aplicacion=date(2026, 7, 15), fecha_fin=None)

		self.assertFalse(beca.covers_period(date(2026, 6, 1)))
		self.assertTrue(beca.covers_period(date(2026, 7, 1)))
		self.assertTrue(beca.covers_period(date(2030, 1, 1)))

	def test_la_base_exige_fin_no_anterior_al_alta(self):
		with self.assertRaises(IntegrityError), transaction.atomic():
			self.beca(monto=Decimal("100.00"), fecha_fin=date(2026, 9, 1)).save()


class GeneracionCuotasMensualesTests(TestCase):
	def test_generacion_respeta_estado_de_socio_y_jugador(self):
		socio_activo = crear_socio("10000001")
		jugador_de_baja = crear_socio("10000002", con_jugador=True, jugador_inactivo=True)
		jugador_activo = crear_socio("10000003", con_jugador=True)
		socio_de_baja = crear_socio("10000004", socio_inactivo=True, con_jugador=True)

		resultado = generar_cuotas_mensuales(date(2026, 10, 5), today=date(2026, 10, 5))

		self.assertEqual(resultado["periodos"], ["2026-10", "2026-11", "2026-12"])
		self.assertEqual(resultado["cuotas_creadas"], 9)
		self.assertEqual(resultado["items_sociales"], 9)
		self.assertEqual(resultado["items_deportivos"], 3)
		esperados = {
			socio_activo: ["CuotaSocial"],
			jugador_de_baja: ["CuotaSocial"],
			jugador_activo: ["CuotaSocial", "CuotaDeportiva"],
		}
		for socio, conceptos in esperados.items():
			for periodo in ("2026-10", "2026-11", "2026-12"):
				cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio, periodo=periodo)
				self.assertEqual(sorted(cuota.items.values_list("concepto", flat=True)), sorted(conceptos))
		self.assertFalse(Cuota.objects.filter(movimiento__cuenta_corriente__socio=socio_de_baja).exists())

	def test_jugador_activo_generacion_repetida_no_duplica(self):
		socio = crear_socio("10000011", con_jugador=True)

		primer_resultado = generar_cuotas_mensuales(date(2026, 10, 1), today=date(2026, 10, 1))
		segundo_resultado = generar_cuotas_mensuales(date(2026, 10, 31), today=date(2026, 10, 31))

		cuenta = CuentaCorriente.objects.get(socio=socio)
		cuota = Cuota.objects.get(movimiento__cuenta_corriente=cuenta, periodo="2026-10")
		self.assertEqual(primer_resultado["cuotas_creadas"], 3)
		self.assertEqual(primer_resultado["items_deportivos"], 3)
		self.assertEqual(segundo_resultado["cuotas_creadas"], 0)
		self.assertEqual(segundo_resultado["cuotas_existentes"], 3)
		self.assertEqual(cuenta.cuotas.count(), 3)
		self.assertEqual(cuota.items.count(), 2)
		self.assertEqual(cuota.movimiento.tipo_movimiento, "Cargo")
		self.assertEqual(cuota.movimiento.monto, Decimal("2500.00"))

	def test_generar_periodo_pasado_crea_cuotas_vencidas_con_recargo(self):
		configuracion = ConfiguracionFinanciera.load()
		configuracion.valor_recargo_1 = Decimal("200.00")
		configuracion.save()
		socio = crear_socio("10000013")

		generar_cuotas_mensuales(date(2026, 9, 1), today=date(2026, 10, 5))

		cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio, periodo="2026-09")
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.VENCIDA_2)
		self.assertEqual(cuota.recargos_aplicados, 2)
		self.assertTrue(cuota.items.filter(concepto="Mora", monto=Decimal("200.00")).exists())

	def test_generar_con_solo_primer_vencimiento_pasado_queda_vencida_en_primera_fecha(self):
		socio = crear_socio("10000015")

		generar_cuotas_mensuales(date(2026, 10, 1), today=date(2026, 10, 15))

		cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio, periodo="2026-10")
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.VENCIDA_1)
		self.assertEqual(cuota.recargos_aplicados, 1)

	def test_generar_periodo_actual_deja_cuotas_en_fecha(self):
		socio = crear_socio("10000014")

		generar_cuotas_mensuales(date(2026, 10, 1), today=date(2026, 10, 1))

		cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio, periodo="2026-10")
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.EN_FECHA)
		self.assertEqual(cuota.recargos_aplicados, 0)

	def test_endpoint_manual_ejecuta_generacion(self):
		crear_socio("10000012")
		self.client.force_login(get_user_model().objects.create_user(username="tesorero"))

		response = self.client.post(reverse("generar-cuotas-mensuales"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["cuotas_creadas"], 3)
		self.assertEqual(response.data["items_sociales"], 3)


class CuotaEndpointTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.socio = crear_socio("30000001", con_jugador=True)

	def crear(self, periodo="2026-10", socio=None):
		return self.client.post(
			reverse("cuota-list"),
			{"socio_id": (socio or self.socio).pk, "periodo": periodo},
			format="json",
		)

	def test_alta_arma_items_con_el_generador_y_registra_cargo(self):
		response = self.crear()

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data["socio"]["socio_id"], self.socio.pk)
		self.assertEqual(response.data["fecha_venc1"], "2026-10-10")
		self.assertEqual(response.data["fecha_venc2"], "2026-10-20")
		self.assertEqual(Decimal(str(response.data["monto_total"])), Decimal("2500.00"))
		cuota = Cuota.objects.get(pk=response.data["cuota_id"])
		self.assertEqual(cuota.movimiento.monto, Decimal("2500.00"))

	def test_no_permite_dos_cuotas_del_mismo_periodo(self):
		self.crear()

		response = self.crear()

		self.assertEqual(response.status_code, 400)
		self.assertEqual(Cuota.objects.filter(periodo="2026-10").count(), 1)

	def test_no_genera_cuota_para_socio_dado_de_baja(self):
		socio = crear_socio("30000002", socio_inactivo=True)

		response = self.crear(socio=socio)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(Cuota.objects.exists())

	def test_periodo_con_formato_invalido(self):
		response = self.crear(periodo="octubre")

		self.assertEqual(response.status_code, 400)
		self.assertIn("periodo", response.data)

	def test_edicion_solo_modifica_vencimientos(self):
		cuota_id = self.crear().data["cuota_id"]

		response = self.client.patch(
			reverse("cuota-detail", args=[cuota_id]),
			{"fecha_venc1": "2026-10-12", "fecha_venc2": "2026-10-25", "periodo": "2027-01"},
			format="json",
		)

		self.assertEqual(response.status_code, 200, response.data)
		cuota = Cuota.objects.get(pk=cuota_id)
		self.assertEqual(cuota.fecha_venc1, date(2026, 10, 12))
		self.assertEqual(cuota.periodo, "2026-10")

	def test_segundo_vencimiento_no_puede_ser_anterior(self):
		cuota_id = self.crear().data["cuota_id"]

		response = self.client.patch(
			reverse("cuota-detail", args=[cuota_id]),
			{"fecha_venc2": "2026-10-01"},
			format="json",
		)

		self.assertEqual(response.status_code, 400)

	def test_eliminar_cuota_revierte_saldo_y_movimiento(self):
		cuota_id = self.crear().data["cuota_id"]

		response = self.client.delete(reverse("cuota-detail", args=[cuota_id]))

		self.assertEqual(response.status_code, 204)
		self.assertFalse(MovimientoCuenta.objects.filter(cuota_id=cuota_id).exists())

	def test_agregar_descuento_actualiza_cargo_y_saldo(self):
		cuota_id = self.crear().data["cuota_id"]

		cuota = Cuota.objects.get(pk=cuota_id)
		item = ItemCuota.objects.create(
			cuota=cuota,
			concepto="DescuentoUnico",
			es_descuento=True,
			fecha_aplicacion=date(2026, 10, 1),
			monto=Decimal("500.00"),
			motivo="Hermanos",
		)
		sync_cuota_charge(cuota)

		self.assertEqual(MovimientoCuenta.objects.get(cuota_id=cuota_id).monto, Decimal("2000.00"))

		item.delete()
		sync_cuota_charge(cuota)

		self.assertEqual(MovimientoCuenta.objects.get(cuota_id=cuota_id).monto, Decimal("2500.00"))

	def test_estado_de_cuenta_lista_cuotas_por_movimientos(self):
		self.crear()

		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["cuotas_generadas"], 1)
		self.assertEqual(response.data["cuotas"][0]["periodo"], "2026-10")


class RegistrosFinancierosNoBorrablesTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		socio = crear_socio("12345678")
		cuota = crear_cuota_con_cargo(account_for(socio), "2026-09", "100.00")
		self.pago, self.comprobante = register_payment(
			socio.pk, [cuota.pk], [{"medio_de_pago": "Efectivo", "monto": Decimal("100.00")}], Decimal("100.00"),
		)

	def test_no_permite_borrar_pago_ni_comprobante(self):
		pago_response = self.client.delete(reverse("pago-detail", args=[self.pago.pk]))
		comprobante_response = self.client.delete(reverse("comprobante-detail", args=[self.comprobante.pk]))

		self.assertEqual(pago_response.status_code, 405)
		self.assertEqual(comprobante_response.status_code, 405)
		self.assertTrue(Pago.objects.filter(pk=self.pago.pk).exists())
		self.assertTrue(Comprobante.objects.filter(pk=self.comprobante.pk).exists())


class PagoTestBase(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		persona = Persona.objects.create(nombre="Juan", apellido="Paz", dni="56789012")
		self.socio = Socio.objects.create(persona=persona)
		self.cuenta = account_for(self.socio)
		self.septiembre = crear_cuota_con_cargo(self.cuenta, "2026-09", "1000.00")
		self.agosto = crear_cuota_con_cargo(self.cuenta, "2026-08", "1000.00")

	def pagar(self, cuotas, monto, **extra):
		datos = {
			"socio_id": self.socio.pk,
			"cuota_ids": [cuota.pk for cuota in cuotas],
			"monto_total": monto,
			"medios": [{"medio_de_pago": "Efectivo", "monto": monto}],
		}
		datos.update(extra)
		return self.client.post(reverse("registrar-pago"), datos, format="json")

	def aplicado(self, cuota):
		return sum(
			Imputacion.objects.filter(movimiento_destino__cuota=cuota).values_list("monto_aplicado", flat=True),
			Decimal("0.00"),
		)


class RegistroPagoTests(PagoTestBase):
	def test_pago_parcial_imputa_y_deja_la_cuota_pendiente(self):
		response = self.pagar([self.agosto], "400.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.assertNotEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(self.aplicado(self.agosto), Decimal("400.00"))
		self.cuenta.refresh_from_db()

	def test_segundo_pago_no_puede_superar_el_saldo_pendiente(self):
		self.pagar([self.agosto], "400.00")

		excedido = self.pagar([self.agosto], "700.00")
		completo = self.pagar([self.agosto], "600.00")

		self.assertEqual(excedido.status_code, 400)
		self.assertEqual(completo.status_code, 201, completo.data)
		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(self.aplicado(self.agosto), Decimal("1000.00"))

	def test_imputa_primero_la_cuota_mas_antigua(self):
		response = self.pagar([self.septiembre, self.agosto], "1500.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.septiembre.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(self.aplicado(self.agosto), Decimal("1000.00"))
		self.assertEqual(self.aplicado(self.septiembre), Decimal("500.00"))
		self.assertNotEqual(self.septiembre.estado_cuota, EstadoCuotaChoices.PAGA)

	def test_no_permite_pagar_una_cuota_saldada(self):
		self.pagar([self.agosto], "1000.00")

		response = self.pagar([self.agosto], "100.00")

		self.assertEqual(response.status_code, 400)
		self.assertEqual(Pago.objects.count(), 1)

	def test_no_permite_pagar_cuotas_de_otro_socio(self):
		otra_cuenta = account_for(
			Socio.objects.create(persona=Persona.objects.create(nombre="Otro", apellido="Socio", dni="67890123")),
		)
		ajena = crear_cuota_con_cargo(otra_cuenta, "2026-08", "1000.00")

		response = self.pagar([ajena], "100.00")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(Pago.objects.exists())

	def test_campos_obligatorios_devuelven_errores_por_campo(self):
		response = self.client.post(reverse("registrar-pago"), {}, format="json")

		self.assertEqual(response.status_code, 400)
		for campo in ("socio_id", "cuota_ids", "monto_total", "medios"):
			self.assertIn(campo, response.data)

	def test_suma_de_medios_debe_coincidir_con_el_total(self):
		response = self.pagar(
			[self.agosto],
			"500.00",
			medios=[{"medio_de_pago": "Efectivo", "monto": "300.00"}],
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("medios", response.data)
		self.assertFalse(Pago.objects.exists())

	def test_volver_a_cobrar_tras_revertir_ignora_el_pago_anulado(self):
		original = self.pagar([self.agosto], "1000.00")
		self.client.post(reverse("revertir-pago", args=[original.data["pago"]["pago_id"]]), {
			"motivo": "Monto mal cargado", "responsable": "Tesorera",
		}, format="json")

		response = self.pagar([self.agosto], "800.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.assertNotEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		activo = Imputacion.objects.filter(
			movimiento_destino__cuota=self.agosto,
			movimiento_origen__pago__estado_pago="Acreditado",
		)
		self.assertEqual(sum(activo.values_list("monto_aplicado", flat=True)), Decimal("800.00"))


class CobroSecuencialTests(PagoTestBase):
	def test_no_permite_saltear_la_cuota_mas_antigua(self):
		response = self.pagar([self.septiembre], "500.00")

		self.assertEqual(response.status_code, 400)
		self.assertIn("orden", response.data["detail"])
		self.assertFalse(Pago.objects.exists())

	def test_saldada_la_mas_antigua_se_puede_pagar_la_siguiente(self):
		self.pagar([self.agosto], "1000.00")

		response = self.pagar([self.septiembre], "500.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(self.aplicado(self.septiembre), Decimal("500.00"))

	def test_el_monto_debe_alcanzar_a_todas_las_cuotas_seleccionadas(self):
		response = self.pagar([self.agosto, self.septiembre], "1000.00")

		self.assertEqual(response.status_code, 400)
		self.assertFalse(Pago.objects.exists())


class CondonacionMoraTests(PagoTestBase):
	def setUp(self):
		super().setUp()
		ItemCuota.objects.create(
			cuota=self.agosto,
			concepto="Mora",
			fecha_aplicacion=date(2026, 9, 11),
			monto=Decimal("200.00"),
		)
		sync_cuota_charge(self.agosto)

	def condonacion(self, cuotas, **extra):
		datos = {"cuota_ids": [cuota.pk for cuota in cuotas], "autorizado_por": "Presidente", "motivo": "Socio vitalicio"}
		datos.update(extra)
		return datos

	def condonaciones(self):
		return ItemCuota.objects.filter(concepto="CondonacionMora")

	def test_condona_el_recargo_y_cobra_solo_el_valor_base(self):
		response = self.pagar([self.agosto], "1000.00", condonacion_mora=self.condonacion([self.agosto]))

		self.assertEqual(response.status_code, 201, response.data)
		condonacion = self.condonaciones().get()
		self.assertEqual(condonacion.cuota, self.agosto)
		self.assertTrue(condonacion.es_descuento)
		self.assertEqual(condonacion.monto, Decimal("200.00"))
		self.assertEqual(condonacion.autorizado_por, "Presidente")
		self.assertEqual(condonacion.motivo, "Socio vitalicio")
		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		self.cuenta.refresh_from_db()
		detalle = dict(DetalleImputacion.objects.values_list("concepto", "monto"))
		self.assertEqual(detalle["Mora"], Decimal("200.00"))
		self.assertEqual(detalle["CondonacionMora"], Decimal("-200.00"))

	def test_el_estado_de_cuenta_no_cuenta_la_mora_condonada(self):
		self.pagar([self.agosto], "1000.00", condonacion_mora=self.condonacion([self.agosto]))

		self.assertEqual(CuentaCorrienteEstadoSerializer(self.cuenta).data["total_mora"], Decimal("0.00"))

	def test_sin_condonacion_el_valor_base_deja_el_recargo_pendiente(self):
		response = self.pagar([self.agosto], "1000.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.assertNotEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertFalse(self.condonaciones().exists())

	def test_solo_condona_cuotas_que_se_estan_pagando(self):
		response = self.pagar([self.agosto], "1000.00", condonacion_mora=self.condonacion([self.septiembre]))

		self.assertEqual(response.status_code, 400)
		self.assertIn("condonacion_mora", response.data)
		self.assertFalse(Pago.objects.exists())

	def test_cuota_sin_recargo_no_se_condona_y_no_registra_nada(self):
		response = self.pagar(
			[self.agosto, self.septiembre],
			"2200.00",
			condonacion_mora=self.condonacion([self.agosto, self.septiembre]),
		)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(self.condonaciones().exists())
		self.assertFalse(Pago.objects.exists())
		self.cuenta.refresh_from_db()

	def test_requiere_autorizante_y_motivo(self):
		response = self.pagar(
			[self.agosto],
			"1000.00",
			condonacion_mora={"cuota_ids": [self.agosto.pk]},
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("autorizado_por", response.data["condonacion_mora"])
		self.assertIn("motivo", response.data["condonacion_mora"])


class EstadoCuentaPendienteTests(PagoTestBase):
	def test_estado_de_cuenta_refleja_pagos_parciales(self):
		self.pagar([self.agosto], "400.00")

		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))

		self.assertEqual(response.status_code, 200)
		cuotas = {cuota["periodo"]: cuota for cuota in response.data["cuotas"]}
		self.assertEqual(Decimal(str(cuotas["2026-08"]["monto_pagado"])), Decimal("400.00"))
		self.assertEqual(Decimal(str(cuotas["2026-08"]["saldo_pendiente"])), Decimal("600.00"))
		self.assertEqual(Decimal(str(cuotas["2026-09"]["saldo_pendiente"])), Decimal("1000.00"))
		self.assertEqual(Decimal(str(response.data["total_pagado"])), Decimal("400.00"))
		self.assertEqual(Decimal(str(response.data["total_adeudado"])), Decimal("1600.00"))

	def test_estado_de_cuenta_incluye_datos_del_socio(self):
		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))

		self.assertEqual(response.data["socio"]["socio_id"], self.socio.pk)
		self.assertEqual(response.data["socio"]["dni"], "56789012")
		self.assertEqual(response.data["socio"]["apellido"], "Paz")

	def test_listado_de_cuotas_informa_saldo_pendiente(self):
		self.pagar([self.agosto], "250.00")

		response = self.client.get(reverse("cuota-list"))

		cuotas = {cuota["cuota_id"]: cuota for cuota in response.data}
		self.assertEqual(Decimal(str(cuotas[self.agosto.pk]["saldo_pendiente"])), Decimal("750.00"))
		self.assertEqual(Decimal(str(cuotas[self.agosto.pk]["monto_pagado"])), Decimal("250.00"))


class ReversionPagoTests(PagoTestBase):
	def revertir(self, pago_id, motivo="Se omitió un descuento", responsable="Tesorera", **extra):
		return self.client.post(
			reverse("revertir-pago", args=[pago_id]), {"motivo": motivo, "responsable": responsable, **extra}, format="json",
		)

	def pendiente(self, cuota):
		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))
		fila = next(item for item in response.data["cuotas"] if item["cuota_id"] == cuota.pk)
		return Decimal(str(fila["saldo_pendiente"]))

	def test_revierte_el_pago_restaura_la_deuda_y_anula_el_comprobante(self):
		pago = self.pagar([self.agosto], "1000.00").data["pago"]

		response = self.revertir(pago["pago_id"])

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["estado"], "Anulado")
		self.assertEqual(response.data["anulacion"]["motivo"], "Se omitió un descuento")
		self.assertEqual(response.data["anulacion"]["responsable"], "Tesorera")
		self.assertEqual(response.data["anulacion"]["usuario"], "tesorero")
		self.agosto.refresh_from_db()
		self.assertNotEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(self.pendiente(self.agosto), Decimal("1000.00"))
		pago_anulado = Pago.objects.get(pk=pago["pago_id"])
		self.assertEqual(pago_anulado.estado_pago, "Anulado")
		self.assertIsNotNone(pago_anulado.fecha_anulacion)
		self.assertEqual(
			RegistroAuditoria.objects.get(accion=AccionAuditoriaChoices.PAGO_REVERTIDO).responsable, "Tesorera",
		)

	def test_solo_se_puede_revertir_el_ultimo_pago_de_cuotas(self):
		primero = self.pagar([self.agosto], "1000.00").data["pago"]
		segundo = self.pagar([self.septiembre], "500.00").data["pago"]

		self.assertEqual(self.revertir(primero["pago_id"]).status_code, 400)
		self.assertEqual(self.revertir(segundo["pago_id"]).status_code, 200)
		self.assertEqual(self.revertir(primero["pago_id"]).status_code, 200)
		self.assertEqual(self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data["comprobante_revertible_id"], None)

	def test_indica_que_comprobante_se_puede_revertir(self):
		primero = self.pagar([self.agosto], "1000.00").data["comprobante"]
		segundo = self.pagar([self.septiembre], "500.00").data["comprobante"]
		_, ingreso = register_income(self.socio.pk, "Donación", [{"medio_de_pago": "Efectivo", "monto": Decimal("10.00")}], Decimal("10.00"))

		estado = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data
		revertible = {
			comprobante_id: self.client.get(reverse("comprobante-detail", args=[comprobante_id])).data["revertible"]
			for comprobante_id in (primero["comprobante_id"], segundo["comprobante_id"], ingreso.pk)
		}

		self.assertEqual(estado["comprobante_revertible_id"], segundo["comprobante_id"])
		self.assertEqual(revertible, {primero["comprobante_id"]: False, segundo["comprobante_id"]: True, ingreso.pk: True})

	def test_lista_los_comprobantes_del_socio(self):
		self.pagar([self.agosto], "1000.00")
		otro = crear_socio("56789099")
		register_income(otro.pk, "Donación", [{"medio_de_pago": "Efectivo", "monto": Decimal("10.00")}], Decimal("10.00"))

		response = self.client.get(reverse("comprobante-list"), {"socio_id": self.socio.pk})

		self.assertEqual([item["socio"]["socio_id"] for item in response.data], [self.socio.pk])

	def test_un_ingreso_posterior_no_impide_revertir_el_pago(self):
		pago = self.pagar([self.agosto], "1000.00").data["pago"]
		register_income(self.socio.pk, "Donación", [{"medio_de_pago": "Efectivo", "monto": Decimal("10.00")}], Decimal("10.00"))

		self.assertEqual(self.revertir(pago["pago_id"]).status_code, 200)

	def test_no_permite_revertir_dos_veces(self):
		pago = self.pagar([self.agosto], "1000.00").data["pago"]
		self.revertir(pago["pago_id"])

		self.assertEqual(self.revertir(pago["pago_id"]).status_code, 400)

	def test_motivo_y_responsable_son_obligatorios(self):
		pago = self.pagar([self.agosto], "1000.00").data["pago"]

		self.assertEqual(self.revertir(pago["pago_id"], motivo="").status_code, 400)
		self.assertEqual(self.revertir(pago["pago_id"], responsable="").status_code, 400)

	def test_aplica_los_recargos_de_los_vencimientos_ya_pasados(self):
		ConfiguracionFinanciera.load().__class__.objects.update(valor_recargo_1=Decimal("100.00"))
		pago = self.pagar([self.agosto], "1000.00").data["pago"]

		self.assertEqual(self.revertir(pago["pago_id"]).status_code, 200)

		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.recargos_aplicados, 2)
		self.assertTrue(ItemCuota.objects.filter(cuota=self.agosto, concepto="Mora").exists())
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.VENCIDA_2)

	def test_pago_inexistente_devuelve_404(self):
		self.assertEqual(self.revertir(999999).status_code, 404)

	def test_informa_las_cuotas_del_ultimo_pago(self):
		self.pagar([self.agosto], "1000.00")
		self.pagar([self.septiembre], "1000.00")

		estado = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data

		self.assertEqual(estado["cuotas_revertibles"], [self.septiembre.pk])

	def test_registra_en_la_auditoria_que_se_hara_con_el_dinero(self):
		pago = self.pagar([self.agosto], "1000.00").data["pago"]

		self.assertEqual(self.revertir(pago["pago_id"], desenlace="NuncaIngreso").status_code, 200)

		registro = RegistroAuditoria.objects.get(accion=AccionAuditoriaChoices.PAGO_REVERTIDO)
		self.assertEqual(registro.detalle["desenlace"], "NuncaIngreso")
		self.assertFalse(Devolucion.objects.exists())

	def test_nota_de_credito_por_el_total_en_la_misma_operacion(self):
		datos = self.pagar([self.agosto], "1000.00").data

		response = self.revertir(datos["pago"]["pago_id"], desenlace="NotaCreditoTotal", medio_de_pago="Transferencia")

		self.assertEqual(response.status_code, 200, response.data)
		nota = Devolucion.objects.get()
		self.assertEqual(nota.tipo, "NotaCredito")
		self.assertEqual(nota.comprobante_anulado_id, datos["comprobante"]["comprobante_id"])
		self.assertEqual(nota.monto, Decimal("1000.00"))
		self.assertEqual(nota.medio_de_pago, "Transferencia")
		self.assertEqual(nota.responsable, "Tesorera")
		self.assertEqual(len(response.data["notas_credito"]), 1)

	def test_el_medio_de_devolucion_solo_va_con_la_nota_de_credito_por_el_total(self):
		pago = self.pagar([self.agosto], "1000.00").data["pago"]

		sin_medio = self.revertir(pago["pago_id"], desenlace="NotaCreditoTotal")
		medio_de_mas = self.revertir(pago["pago_id"], desenlace="CobrarNuevamente", medio_de_pago="Efectivo")

		self.assertEqual(sin_medio.status_code, 400)
		self.assertEqual(medio_de_mas.status_code, 400)
		self.assertEqual(Pago.objects.get(pk=pago["pago_id"]).estado_pago, "Acreditado")


class ReversionSaldoPorBeneficioTests(PagoTestBase):
	def descontar(self, cuota, valor):
		response = self.client.post(reverse("cuota-beneficio", args=[cuota.pk]), {
			"tipo": "Descuento",
			"modalidad": "MontoFijo",
			"valor": valor,
			"fecha_aplicacion": "2026-09-01",
			"motivo": "Perdón del saldo",
			"autorizado_por": "Tesorería",
		}, format="json")
		self.assertEqual(response.status_code, 201, response.data)
		return ItemCuota.objects.get(pk=response.data["item"]["item_cuota_id"])

	def revertir_saldo(self, cuota, **extra):
		datos = {"motivo": "El descuento era de otro monto", "responsable": "Tesorera", **extra}
		return self.client.post(reverse("cuota-revertir-saldo", args=[cuota.pk]), datos, format="json")

	def revertible(self):
		return self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data["saldo_beneficio_revertible"]

	def test_un_descuento_que_salda_la_cuota_se_puede_revertir(self):
		self.pagar([self.agosto], "1000.00")
		descuento = self.descontar(self.septiembre, "1000.00")
		self.assertEqual(self.revertible(), {"cuota_id": self.septiembre.pk, "item_cuota_id": descuento.pk})

		response = self.revertir_saldo(self.septiembre)

		self.assertEqual(response.status_code, 200, response.data)
		self.septiembre.refresh_from_db()
		descuento.refresh_from_db()
		self.assertNotEqual(self.septiembre.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(descuento.estado, EstadoItemCuotaChoices.ANULADO)
		self.assertIsNone(self.revertible())
		registro = RegistroAuditoria.objects.get(accion=AccionAuditoriaChoices.PAGO_REVERTIDO)
		self.assertEqual(registro.responsable, "Tesorera")
		self.assertEqual(registro.detalle["desenlace"], "NuncaIngreso")

	def test_revertir_un_saldo_completado_con_descuento_conserva_el_pago_parcial(self):
		self.pagar([self.agosto], "1000.00")
		pago = self.pagar([self.septiembre], "600.00").data["pago"]
		self.descontar(self.septiembre, "400.00")

		self.assertEqual(self.revertir_saldo(self.septiembre).status_code, 200)

		self.septiembre.refresh_from_db()
		self.assertNotEqual(self.septiembre.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(Pago.objects.get(pk=pago["pago_id"]).estado_pago, EstadoPagoChoices.ACREDITADO)
		self.assertEqual(self.aplicado(self.septiembre), Decimal("600.00"))

	def test_una_cuota_saldada_por_un_pago_posterior_al_descuento_no_se_revierte_asi(self):
		self.pagar([self.agosto], "1000.00")
		self.descontar(self.septiembre, "400.00")
		self.pagar([self.septiembre], "600.00")

		self.assertIsNone(self.revertible())
		self.assertEqual(self.revertir_saldo(self.septiembre).status_code, 400)

	def test_solo_se_puede_revertir_la_ultima_cuota_saldada(self):
		self.descontar(self.agosto, "1000.00")
		self.descontar(self.septiembre, "1000.00")

		self.assertEqual(self.revertir_saldo(self.agosto).status_code, 400)
		self.assertEqual(self.revertir_saldo(self.septiembre).status_code, 200)
		self.assertEqual(self.revertible()["cuota_id"], self.agosto.pk)

	def test_solo_admite_que_el_pago_nunca_ingreso(self):
		self.descontar(self.agosto, "1000.00")

		response = self.revertir_saldo(self.agosto, desenlace="NotaCreditoTotal")

		self.assertEqual(response.status_code, 400)
		self.assertIn("desenlace", response.data)
		self.assertEqual(self.revertir_saldo(self.agosto, desenlace="NuncaIngreso").status_code, 200)

	def test_un_descuento_de_una_cuota_paga_no_se_puede_quitar(self):
		descuento = self.descontar(self.agosto, "1000.00")

		response = self.client.post(reverse("item-cuota-anular", args=[descuento.pk]), {
			"motivo": "Error", "autorizado_por": "Tesorería",
		}, format="json")

		self.assertEqual(response.status_code, 400)
		descuento.refresh_from_db()
		self.assertEqual(descuento.estado, EstadoItemCuotaChoices.VIGENTE)


class NotaCreditoTests(PagoTestBase):
	def setUp(self):
		super().setUp()
		pago = self.pagar([self.agosto], "1000.00").data
		self.comprobante_id = pago["comprobante"]["comprobante_id"]
		self.pago_id = pago["pago"]["pago_id"]

	def emitir(self, monto, comprobante_id=None):
		return self.client.post(reverse("emitir-nota-credito", args=[comprobante_id or self.comprobante_id]), {
			"monto": monto, "medio_de_pago": "Efectivo", "motivo": "Devolución del excedente", "responsable": "Tesorera",
		}, format="json")

	def revertir(self):
		return self.client.post(
			reverse("revertir-pago", args=[self.pago_id]), {"motivo": "Cobro mal hecho", "responsable": "Tesorera"}, format="json",
		)

	def test_solo_sobre_comprobantes_anulados(self):
		self.assertEqual(self.emitir("100.00").status_code, 400)

	def test_parciales_hasta_el_total_del_comprobante(self):
		self.revertir()

		primera = self.emitir("600.00")
		excedida = self.emitir("450.00")
		segunda = self.emitir("400.00")

		self.assertEqual(primera.status_code, 201, primera.data)
		self.assertEqual(primera.data["codigo"], "NC-X 00000001")
		self.assertEqual(excedida.status_code, 400)
		self.assertEqual(segunda.status_code, 201, segunda.data)
		detalle = self.client.get(reverse("comprobante-detail", args=[self.comprobante_id])).data
		self.assertEqual(Decimal(str(detalle["monto_devuelto"])), Decimal("1000.00"))
		self.assertEqual(len(detalle["notas_credito"]), 2)

	def test_volver_a_cobrar_con_descuento_y_devolver_el_excedente_en_la_misma_operacion(self):
		self.revertir()
		assign_benefit(self.agosto.pk, "Descuento", "MontoFijo", Decimal("200.00"), date(2026, 8, 1), "Hermanos", authorized_by="Presidente")

		response = self.pagar([self.agosto], "800.00", nota_credito={
			"comprobante_id": self.comprobante_id, "monto": "200.00", "medio_de_pago": "Efectivo",
			"motivo": "Excedente por descuento omitido", "responsable": "Tesorera",
		})

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		nota = Devolucion.objects.get()
		self.assertEqual(nota.comprobante_anulado_id, self.comprobante_id)
		self.assertEqual(nota.monto, Decimal("200.00"))

	def test_el_excedente_puede_quedar_como_pago_parcial_de_la_siguiente_cuota(self):
		self.revertir()
		assign_benefit(self.agosto.pk, "Descuento", "MontoFijo", Decimal("200.00"), date(2026, 8, 1), "Hermanos", authorized_by="Presidente")

		response = self.pagar([self.agosto, self.septiembre], "1000.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(self.aplicado(self.septiembre), Decimal("200.00"))
		self.assertFalse(Devolucion.objects.exists())

	def test_el_pago_registrado_en_otro_socio_puede_devolver_el_excedente(self):
		self.revertir()
		otro = crear_socio("56789098")
		cuota_otro = crear_cuota_con_cargo(account_for(otro), "2026-08", "700.00")

		response = self.client.post(reverse("registrar-pago"), {
			"socio_id": otro.pk,
			"cuota_ids": [cuota_otro.pk],
			"monto_total": "700.00",
			"medios": [{"medio_de_pago": "Efectivo", "monto": "700.00"}],
			"nota_credito": {
				"comprobante_id": self.comprobante_id, "monto": "300.00", "medio_de_pago": "Efectivo",
				"motivo": "Excedente del pago cargado a otro socio", "responsable": "Tesorera",
			},
		}, format="json")

		self.assertEqual(response.status_code, 201, response.data)
		nota = Devolucion.objects.get()
		self.assertEqual(nota.cuenta_corriente.socio_id, self.socio.pk)
		self.assertEqual(nota.monto, Decimal("300.00"))

	def test_una_nota_de_credito_invalida_cancela_tambien_el_nuevo_pago(self):
		self.revertir()

		response = self.pagar([self.agosto], "800.00", nota_credito={
			"comprobante_id": self.comprobante_id, "monto": "5000.00", "medio_de_pago": "Efectivo",
			"motivo": "Excedente", "responsable": "Tesorera",
		})

		self.assertEqual(response.status_code, 400)
		self.assertEqual(Pago.objects.filter(estado_pago="Acreditado").count(), 0)

	def test_la_nota_de_credito_tiene_su_comprobante_y_el_recibo_anulado_la_menciona(self):
		self.revertir()
		nota = self.emitir("300.00").data

		pdf = self.client.get(reverse("devolucion-pdf", args=[nota["devolucion_id"]]))
		recibo = self.client.get(reverse("comprobante-pdf", args=[self.comprobante_id]))

		self.assertIn(b"NOTA DE CR", pdf.content)
		self.assertIn(b"NC-X 00000001", pdf.content)
		self.assertIn(b"ANULADO", recibo.content)
		self.assertIn(b"NC-X 00000001", recibo.content)


class BeneficioCuotaTests(APITestCase):
	def setUp(self):
		self.usuario = get_user_model().objects.create_user(username="tesorero")
		self.client.force_authenticate(user=self.usuario)
		self.socio = crear_socio("60000001", con_jugador=True)
		respuesta = self.client.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": "2026-10"}, format="json")
		self.cuota = Cuota.objects.get(pk=respuesta.data["cuota_id"])

	def asignar(self, **datos):
		valores = {
			"tipo": "Descuento",
			"modalidad": "MontoFijo",
			"valor": "500.00",
			"fecha_aplicacion": "2026-10-01",
			"motivo": "Hermanos en el club",
			"autorizado_por": "Tesorería",
		}
		valores.update(datos)
		return self.client.post(reverse("cuota-beneficio", args=[self.cuota.pk]), valores, format="json")

	def cargo(self):
		return MovimientoCuenta.objects.get(cuota=self.cuota).monto

	def test_descuento_fijo_reduce_la_cuota(self):
		response = self.asignar()

		self.assertEqual(response.status_code, 201, response.data)
		self.assertIsNone(response.data["beca"])
		self.assertEqual(response.data["item"]["concepto"], "DescuentoUnico")
		self.assertEqual(response.data["item"]["motivo"], "Hermanos en el club")
		self.assertEqual(self.cargo(), Decimal("2000.00"))

	def test_descuento_porcentual_sobre_el_total(self):
		response = self.asignar(modalidad="Porcentaje", valor="10")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(Decimal(response.data["item"]["monto"]), Decimal("250.00"))

	def test_validaciones_del_formulario(self):
		casos = [
			({"valor": "2500.01"}, None),
			({"modalidad": "Porcentaje", "valor": "0.50"}, "valor"),
			({"modalidad": "Porcentaje", "valor": "101"}, "valor"),
			({"motivo": ""}, "motivo"),
			({"autorizado_por": ""}, "autorizado_por"),
			({"tipo": "Beca", "fecha_fin": "2026-09-30"}, "fecha_fin"),
			({"tipo": "Otro"}, "tipo"),
		]
		for datos, campo in casos:
			with self.subTest(datos=datos):
				response = self.asignar(**datos)
				self.assertEqual(response.status_code, 400)
				if campo:
					self.assertIn(campo, response.data)
		self.assertEqual(self.cargo(), Decimal("2500.00"))
		self.assertFalse(Beca.objects.exists())

	def test_los_descuentos_no_pueden_superar_el_total_de_la_cuota(self):
		self.asignar(valor="2000.00")

		response = self.asignar(valor="1000.00")

		self.assertEqual(response.status_code, 400)
		self.assertEqual(self.cargo(), Decimal("500.00"))

	def test_beca_se_registra_y_se_aplica_a_la_cuota_seleccionada(self):
		response = self.asignar(tipo="Beca", modalidad="Porcentaje", valor="50", fecha_aplicacion="2026-10-15", fecha_fin="2026-12-31")

		self.assertEqual(response.status_code, 201, response.data)
		beca = Beca.objects.get()
		self.assertEqual(beca.socio, self.socio)
		self.assertEqual(beca.porcentaje, Decimal("50.00"))
		self.assertIsNone(beca.monto)
		self.assertIsNone(beca.concepto)
		self.assertEqual(beca.usuario, self.usuario)
		self.assertTrue(response.data["aplicado_a_cuota"])
		item = self.cuota.items.get(concepto="Beca")
		self.assertTrue(item.es_descuento)
		self.assertEqual(item.monto, Decimal("1250.00"))
		self.assertEqual(item.motivo, "Hermanos en el club")
		self.assertEqual(self.cargo(), Decimal("1250.00"))

	def test_beca_fuera_de_la_vigencia_no_modifica_la_cuota(self):
		response = self.asignar(tipo="Beca", fecha_aplicacion="2026-11-01", fecha_fin="2026-12-31")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertFalse(response.data["aplicado_a_cuota"])
		self.assertTrue(Beca.objects.exists())
		self.assertEqual(self.cargo(), Decimal("2500.00"))

	def pay(self, amount):
		response = self.client.post(
			reverse("registrar-pago"),
			{
				"socio_id": self.socio.pk,
				"cuota_ids": [self.cuota.pk],
				"monto_total": amount,
				"medios": [{"medio_de_pago": "Efectivo", "monto": amount}],
			},
			format="json",
		)
		self.assertEqual(response.status_code, 201, response.data)

	def add_late_fee(self, amount):
		ItemCuota.objects.create(cuota=self.cuota, concepto="Mora", fecha_aplicacion=date(2026, 10, 11), monto=Decimal(amount))
		sync_cuota_charge(self.cuota)

	def state(self):
		self.cuota.refresh_from_db()
		return self.cuota.estado_cuota

	def pending_without_fees(self):
		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))
		return Decimal(str(response.data["cuotas"][0]["saldo_sin_recargo"]))

	def test_partially_paid_cuota_accepts_a_discount(self):
		self.pay("100.00")

		response = self.asignar(valor="500.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(self.cargo(), Decimal("2000.00"))
		self.assertEqual(self.pending_without_fees(), Decimal("1900.00"))
		self.assertNotEqual(self.state(), EstadoCuotaChoices.PAGA)

	def test_discount_can_cover_the_whole_remaining_amount(self):
		self.pay("1000.00")

		too_much = self.asignar(valor="1500.01")
		exact = self.asignar(valor="1500.00")

		self.assertEqual(too_much.status_code, 400)
		self.assertEqual(exact.status_code, 201, exact.data)
		self.assertEqual(self.state(), EstadoCuotaChoices.PAGA)
		self.assertEqual(self.pending_without_fees(), Decimal("0.00"))

	def test_scholarship_larger_than_the_remaining_amount_covers_only_what_is_left(self):
		self.pay("2000.00")

		response = self.asignar(tipo="Beca", modalidad="Porcentaje", valor="100", fecha_fin="2026-12-31")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertTrue(response.data["aplicado_a_cuota"])
		self.assertEqual(Decimal(response.data["item"]["monto"]), Decimal("500.00"))
		self.assertEqual(Beca.objects.get().porcentaje, Decimal("100.00"))
		self.assertEqual(self.state(), EstadoCuotaChoices.PAGA)

	def test_unpaid_late_fees_are_left_out_of_the_discountable_amount(self):
		self.add_late_fee("300.00")

		too_much = self.asignar(valor="2500.01")
		response = self.asignar(valor="2500.00")

		self.assertEqual(too_much.status_code, 400)
		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(self.pending_without_fees(), Decimal("0.00"))
		self.assertNotEqual(self.state(), EstadoCuotaChoices.PAGA)
		self.assertEqual(self.cargo(), Decimal("300.00"))

	def test_late_fees_already_paid_do_not_reduce_the_discountable_amount(self):
		self.add_late_fee("300.00")
		self.pay("1000.00")

		self.assertEqual(self.pending_without_fees(), Decimal("1800.00"))
		response = self.asignar(valor="1800.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(self.state(), EstadoCuotaChoices.PAGA)

	def test_paid_cuota_only_accepts_a_scholarship_for_next_periods(self):
		self.pay("2500.00")

		descuento = self.asignar(valor="100.00")
		beca = self.asignar(tipo="Beca", fecha_fin="2026-12-31")

		self.assertEqual(descuento.status_code, 400)
		self.assertEqual(beca.status_code, 201, beca.data)
		self.assertFalse(beca.data["aplicado_a_cuota"])
		self.assertEqual(self.cargo(), Decimal("2500.00"))

	def test_listado_de_becas_por_socio(self):
		self.asignar(tipo="Beca", fecha_fin="2026-12-31")
		otro = crear_socio("60000002")
		Beca.objects.create(socio=otro, monto=Decimal("100.00"), fecha_aplicacion=date(2026, 10, 1), fecha_fin=date(2026, 10, 31), motivo="Otro")

		response = self.client.get(reverse("beca-list"), {"socio_id": self.socio.pk})

		self.assertEqual(response.status_code, 200)
		self.assertEqual([beca["socio"] for beca in response.data], [self.socio.pk])


class OtorgarBecaTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.socio = crear_socio("60000010", con_jugador=True)
		self.julio, self.agosto, self.septiembre = (self.generar(periodo) for periodo in ("2026-07", "2026-08", "2026-09"))

	def generar(self, periodo):
		response = self.client.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": periodo}, format="json")
		return Cuota.objects.get(pk=response.data["cuota_id"])

	def otorgar(self, socio=None, **datos):
		valores = {
			"modalidad": "Porcentaje",
			"valor": "10",
			"fecha_aplicacion": "2026-07-01",
			"motivo": "Situación económica",
			"autorizado_por": "Comisión directiva",
		}
		valores.update(datos)
		return self.client.post(reverse("socio-beca", args=[(socio or self.socio).pk]), valores, format="json")

	def becas_de(self, cuota):
		return list(cuota.items.filter(concepto="Beca").values_list("monto", flat=True))

	def test_aplica_a_las_cuotas_impagas_desde_el_periodo_de_alta(self):
		response = self.otorgar()

		self.assertEqual(response.status_code, 201, response.data)
		self.assertIsNone(response.data["beca"]["fecha_fin"])
		self.assertEqual(response.data["beca"]["autorizado_por"], "Comisión directiva")
		self.assertEqual(len(response.data["items"]), 3)
		for cuota in (self.julio, self.agosto, self.septiembre):
			self.assertEqual(self.becas_de(cuota), [Decimal("250.00")])
		item = self.agosto.items.get(concepto="Beca")
		self.assertEqual(item.autorizado_por, "Comisión directiva")
		self.assertEqual(item.motivo, "Situación económica")

	def test_no_alcanza_periodos_anteriores_al_alta(self):
		self.otorgar(fecha_aplicacion="2026-08-20")

		self.assertEqual(self.becas_de(self.julio), [])
		self.assertEqual(self.becas_de(self.agosto), [Decimal("250.00")])

	def test_respeta_la_vigencia_hasta(self):
		self.otorgar(fecha_fin="2026-08-31")

		self.assertEqual(self.becas_de(self.agosto), [Decimal("250.00")])
		self.assertEqual(self.becas_de(self.septiembre), [])

	def test_las_cuotas_pagas_no_se_modifican(self):
		monto = MovimientoCuenta.objects.get(cuota=self.julio).monto
		self.client.post(reverse("registrar-pago"), {
			"socio_id": self.socio.pk,
			"cuota_ids": [self.julio.pk],
			"monto_total": str(monto),
			"medios": [{"medio_de_pago": "Efectivo", "monto": str(monto)}],
		}, format="json")

		response = self.otorgar()

		self.assertEqual(len(response.data["items"]), 2)
		self.assertEqual(self.becas_de(self.julio), [])
		self.assertEqual(MovimientoCuenta.objects.get(cuota=self.julio).monto, monto)

	def test_las_cuotas_generadas_despues_reciben_la_beca(self):
		self.otorgar()

		octubre = self.generar("2026-10")

		item = octubre.items.get(concepto="Beca")
		self.assertEqual(item.monto, Decimal("250.00"))
		self.assertEqual(item.autorizado_por, "Comisión directiva")

	def test_socio_de_baja_no_recibe_beca(self):
		inactivo = crear_socio("60000011", socio_inactivo=True)

		response = self.otorgar(socio=inactivo)

		self.assertEqual(response.status_code, 400)
		self.assertFalse(Beca.objects.exists())

	def test_validaciones_del_formulario(self):
		casos = [
			({"autorizado_por": ""}, "autorizado_por"),
			({"motivo": ""}, "motivo"),
			({"valor": "101"}, "valor"),
			({"fecha_fin": "2026-06-30"}, "fecha_fin"),
		]
		for datos, campo in casos:
			with self.subTest(datos=datos):
				response = self.otorgar(**datos)
				self.assertEqual(response.status_code, 400)
				self.assertIn(campo, response.data)
		self.assertFalse(Beca.objects.exists())


class CuotaSettledStateTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.socio = crear_socio("60000002", con_jugador=True)
		response = self.client.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": "2026-10"}, format="json")
		self.cuota = Cuota.objects.get(pk=response.data["cuota_id"])

	def assign(self, **data):
		values = {
			"tipo": "Descuento",
			"modalidad": "Porcentaje",
			"valor": "100",
			"fecha_aplicacion": "2026-10-01",
			"motivo": "Beneficio total",
			"autorizado_por": "Tesorería",
		}
		values.update(data)
		return self.client.post(reverse("cuota-beneficio", args=[self.cuota.pk]), values, format="json")

	def add_discount_item(self, amount):
		ItemCuota.objects.create(
			cuota=self.cuota,
			concepto="DescuentoUnico",
			es_descuento=True,
			fecha_aplicacion=date(2026, 10, 1),
			monto=Decimal(amount),
			motivo="Ajuste",
		)
		sync_cuota_charge(self.cuota)

	def state(self):
		self.cuota.refresh_from_db()
		return self.cuota.estado_cuota

	def account_status(self):
		return self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data

	def test_full_discount_marks_cuota_as_paid(self):
		response = self.assign()

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(self.state(), EstadoCuotaChoices.PAGA)
		status_data = self.account_status()
		self.assertEqual(status_data["cuotas_impagas"], 0)
		self.assertEqual(status_data["cuotas_pagas"], 1)
		self.assertEqual(status_data["total_adeudado"], Decimal("0.00"))

	def test_full_scholarship_marks_cuota_as_paid(self):
		response = self.assign(tipo="Beca", fecha_fin="2026-12-31")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertTrue(response.data["aplicado_a_cuota"])
		self.assertEqual(self.state(), EstadoCuotaChoices.PAGA)
		self.assertEqual(self.account_status()["cuotas_impagas"], 0)

	def test_item_changes_refresh_state(self):
		self.add_discount_item("1000.00")

		self.assertNotEqual(self.state(), EstadoCuotaChoices.PAGA)

		self.add_discount_item("1500.00")

		self.assertEqual(self.state(), EstadoCuotaChoices.PAGA)

	def test_paid_cuota_cannot_be_modified(self):
		self.assign()

		responses = {
			"edit cuota": self.client.patch(reverse("cuota-detail", args=[self.cuota.pk]), {"fecha_venc2": "2026-10-25"}, format="json"),
			"delete cuota": self.client.delete(reverse("cuota-detail", args=[self.cuota.pk])),
			"discount": self.assign(modalidad="MontoFijo", valor="10.00"),
		}

		for action, response in responses.items():
			with self.subTest(action=action):
				self.assertEqual(response.status_code, 400)
				self.assertIn("paga", response.data["detail"])
		self.assertTrue(Cuota.objects.filter(pk=self.cuota.pk).exists())
		self.assertEqual(self.cuota.items.count(), 3)


class ItemCuotaLabelTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.socio = crear_socio("60000003", con_jugador=True)
		response = self.client.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": "2026-10"}, format="json")
		self.cuota_id = response.data["cuota_id"]
		self.client.post(reverse("cuota-beneficio", args=[self.cuota_id]), {
			"tipo": "Descuento",
			"modalidad": "MontoFijo",
			"valor": "100.00",
			"fecha_aplicacion": "2026-10-01",
			"motivo": "Hermanos en el club",
			"autorizado_por": "Tesorería",
		}, format="json")

	def test_account_status_items_include_concept_labels(self):
		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))

		self.assertEqual(response.status_code, 200)
		labels = {item["concepto"]: item["concepto_nombre"] for item in response.data["cuotas"][0]["items"]}
		self.assertEqual(labels, {
			"CuotaSocial": "Cuota Social",
			"CuotaDeportiva": "Cuota Deportiva",
			"DescuentoUnico": "Descuento único",
		})

	def test_item_endpoint_includes_concept_label(self):
		item = ItemCuota.objects.get(cuota_id=self.cuota_id, concepto="DescuentoUnico")

		response = self.client.get(reverse("item-cuota-detail", args=[item.pk]))

		self.assertEqual(response.data["concepto_nombre"], "Descuento único")


class BecasEnGeneracionDeCuotasTests(TestCase):
	def setUp(self):
		self.socio = crear_socio("70000001", con_jugador=True)

	def beca(self, alta, fin, **valores):
		valores.setdefault("motivo", "Rendimiento deportivo")
		return Beca.objects.create(socio=self.socio, fecha_aplicacion=alta, fecha_fin=fin, **valores)

	def cuota(self, periodo):
		return Cuota.objects.get(movimiento__cuenta_corriente__socio=self.socio, periodo=periodo)

	def descuentos(self, cuota):
		return list(cuota.items.filter(es_descuento=True).values_list("monto", flat=True))

	def test_beca_vigente_descuenta_en_la_cuota_generada(self):
		self.beca(date(2026, 10, 1), date(2026, 12, 31), porcentaje=Decimal("50"))

		generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))

		cuota = self.cuota("2026-11")
		item = cuota.items.get(concepto="Beca")
		self.assertTrue(item.es_descuento)
		self.assertEqual(item.monto, Decimal("1250.00"))
		self.assertEqual(item.motivo, "Rendimiento deportivo")
		self.assertEqual(cuota.movimiento.monto, Decimal("1250.00"))
		self.assertEqual(self.cuota("2026-12").movimiento.monto, Decimal("1250.00"))
		self.assertEqual(self.cuota("2027-01").movimiento.monto, Decimal("2500.00"))

	def test_beca_finalizada_deja_de_aplicarse_y_conserva_el_historial(self):
		self.beca(date(2026, 10, 1), date(2026, 11, 30), monto=Decimal("500.00"))

		generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))
		generar_cuotas_mensuales(date(2026, 12, 1), today=date(2026, 12, 1))

		self.assertEqual(self.descuentos(self.cuota("2026-11")), [Decimal("500.00")])
		self.assertEqual(self.descuentos(self.cuota("2026-12")), [])
		self.assertEqual(self.cuota("2026-12").movimiento.monto, Decimal("2500.00"))

	def test_beca_que_empieza_a_mitad_de_mes_cubre_ese_periodo(self):
		self.beca(date(2026, 11, 20), date(2027, 3, 31), monto=Decimal("300.00"))

		generar_cuotas_mensuales(date(2026, 10, 1), today=date(2026, 10, 1))
		generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))

		self.assertEqual(self.descuentos(self.cuota("2026-10")), [])
		self.assertEqual(self.descuentos(self.cuota("2026-11")), [Decimal("300.00")])

	def test_monto_fijo_mayor_a_la_cuota_se_topea_y_la_cuota_queda_paga(self):
		jugador = self.socio.jugador
		jugador.deactivate()
		self.socio = Socio.objects.get(pk=self.socio.pk)
		self.beca(date(2026, 10, 1), date(2026, 12, 31), monto=Decimal("1200.00"))

		generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))

		cuota = self.cuota("2026-11")
		self.assertEqual(self.descuentos(cuota), [Decimal("1000.00")])
		self.assertEqual(cuota.movimiento.monto, Decimal("0.00"))
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.PAGA)

	def test_varias_becas_nunca_dejan_la_cuota_en_negativo(self):
		self.beca(date(2026, 10, 1), date(2026, 12, 31), porcentaje=Decimal("80"))
		self.beca(date(2026, 10, 1), date(2026, 12, 31), monto=Decimal("1000.00"))

		generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))

		cuota = self.cuota("2026-11")
		self.assertEqual(self.descuentos(cuota), [Decimal("2000.00"), Decimal("500.00")])
		self.assertEqual(cuota.movimiento.monto, Decimal("0.00"))

	def test_becas_de_otro_socio_no_se_aplican(self):
		otro = crear_socio("70000002")
		Beca.objects.create(socio=otro, monto=Decimal("400.00"), fecha_aplicacion=date(2026, 10, 1), fecha_fin=date(2026, 12, 31), motivo="Otro")

		generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))

		self.assertEqual(self.descuentos(self.cuota("2026-11")), [])
		otra_cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=otro, periodo="2026-11")
		self.assertEqual(self.descuentos(otra_cuota), [Decimal("400.00")])

	def test_alta_manual_de_cuota_tambien_aplica_la_beca(self):
		self.beca(date(2026, 10, 1), date(2026, 12, 31), monto=Decimal("700.00"))
		cliente = self.client_class()
		cliente.force_login(get_user_model().objects.create_user(username="tesorero"))

		response = cliente.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": "2026-12"}, content_type="application/json")

		self.assertEqual(response.status_code, 201)
		self.assertEqual(self.descuentos(self.cuota("2026-12")), [Decimal("700.00")])

	def test_la_generacion_mensual_consulta_las_becas_una_sola_vez(self):
		for dni in ("70000003", "70000004", "70000005"):
			crear_socio(dni)
		Beca.objects.create(socio=self.socio, monto=Decimal("100.00"), fecha_aplicacion=date(2026, 10, 1), fecha_fin=date(2026, 12, 31), motivo="Uno")

		with CaptureQueriesContext(connection) as consultas:
			generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))

		consultas_becas = [q["sql"] for q in consultas.captured_queries if '"beca"' in q["sql"] and q["sql"].lstrip().upper().startswith("SELECT")]
		self.assertEqual(len(consultas_becas), 1)


class ComprobanteTestBase(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.socio = crear_socio("80000001", con_jugador=True)
		self.cuota = self.generar("2026-10")

	def generar(self, periodo):
		response = self.client.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": periodo}, format="json")
		return Cuota.objects.get(pk=response.data["cuota_id"])

	def agregar_mora(self, cuota, monto):
		ItemCuota.objects.create(cuota=cuota, concepto="Mora", fecha_aplicacion=date(2026, 10, 11), monto=Decimal(monto))
		sync_cuota_charge(cuota)

	def asignar_beca(self, monto):
		return self.client.post(
			reverse("cuota-beneficio", args=[self.cuota.pk]),
			{
				"tipo": "Beca", "modalidad": "MontoFijo", "valor": monto,
				"fecha_aplicacion": "2026-10-01", "fecha_fin": "2026-12-31", "motivo": "Beca deportiva", "autorizado_por": "Tesorería",
			},
			format="json",
		)

	def pagar(self, monto, cuotas=None):
		response = self.client.post(
			reverse("registrar-pago"),
			{
				"socio_id": self.socio.pk,
				"cuota_ids": [cuota.pk for cuota in (cuotas or [self.cuota])],
				"monto_total": monto,
				"medios": [{"medio_de_pago": "Efectivo", "monto": monto}],
			},
			format="json",
		)
		self.assertEqual(response.status_code, 201, response.data)
		return self.client.get(reverse("comprobante-detail", args=[response.data["comprobante"]["comprobante_id"]])).data

	def desglose(self, detalle):
		return [(linea["concepto"], Decimal(str(linea["monto"]))) for linea in detalle["desglose"]]


class DesgloseComprobanteTests(ComprobanteTestBase):
	def test_pago_completo_con_beca_como_linea_negativa(self):
		self.asignar_beca("500.00")

		detalle = self.pagar("2000.00")

		self.assertEqual(detalle["tipo"], "X")
		self.assertEqual(self.desglose(detalle), [
			("CuotaSocial", Decimal("1000.00")),
			("CuotaDeportiva", Decimal("1500.00")),
			("Beca", Decimal("-500.00")),
		])
		self.assertEqual([periodo["periodo"] for periodo in detalle["periodos"]], ["2026-10"])
		self.assertEqual(detalle["desglose"][0]["concepto_nombre"], "Cuota Social")

	def test_pagos_parciales_cancelan_primero_mora_luego_social_y_deportiva(self):
		self.agregar_mora(self.cuota, "200.00")

		primero = self.pagar("400.00")
		segundo = self.pagar("1000.00")
		tercero = self.pagar("1300.00")

		self.assertEqual(self.desglose(primero), [("Mora", Decimal("200.00")), ("CuotaSocial", Decimal("200.00"))])
		self.assertEqual(self.desglose(segundo), [("CuotaSocial", Decimal("800.00")), ("CuotaDeportiva", Decimal("200.00"))])
		self.assertEqual(self.desglose(tercero), [("CuotaDeportiva", Decimal("1300.00"))])

	def test_la_beca_figura_en_el_primer_pago_parcial(self):
		self.asignar_beca("500.00")

		primero = self.pagar("400.00")
		segundo = self.pagar("1600.00")

		self.assertEqual(self.desglose(primero), [("CuotaSocial", Decimal("900.00")), ("Beca", Decimal("-500.00"))])
		self.assertEqual(self.desglose(segundo), [("CuotaSocial", Decimal("100.00")), ("CuotaDeportiva", Decimal("1500.00"))])

	def test_un_recargo_posterior_no_altera_comprobantes_ya_emitidos(self):
		primero = self.pagar("400.00")
		self.agregar_mora(self.cuota, "200.00")

		segundo = self.pagar("600.00")
		primero_releido = self.client.get(reverse("comprobante-detail", args=[Comprobante.objects.get(numero=primero["numero"]).pk])).data

		self.assertEqual(self.desglose(primero_releido), [("CuotaSocial", Decimal("400.00"))])
		self.assertEqual(self.desglose(segundo), [("Mora", Decimal("200.00")), ("CuotaSocial", Decimal("400.00"))])

	def test_pago_de_varias_cuotas_lista_los_periodos_y_suma_el_desglose(self):
		noviembre = self.generar("2026-11")

		detalle = self.pagar("3000.00", [noviembre, self.cuota])

		self.assertEqual(
			[(periodo["periodo"], Decimal(str(periodo["monto_aplicado"]))) for periodo in detalle["periodos"]],
			[("2026-10", Decimal("2500.00")), ("2026-11", Decimal("500.00"))],
		)
		self.assertEqual(self.desglose(detalle), [("CuotaSocial", Decimal("1500.00")), ("CuotaDeportiva", Decimal("1500.00"))])

	def test_volver_a_cobrar_recalcula_el_desglose_sin_el_pago_anulado(self):
		original = self.pagar("1000.00")
		pago_id = Comprobante.objects.get(numero=original["numero"]).pago_id
		self.client.post(reverse("revertir-pago", args=[pago_id]), {"motivo": "Monto mal cargado", "responsable": "Tesorera"}, format="json")

		detalle = self.pagar("1200.00")

		self.assertEqual(self.desglose(detalle), [("CuotaSocial", Decimal("1000.00")), ("CuotaDeportiva", Decimal("200.00"))])

	def test_comprobante_incompleto_bloquea_y_revierte_el_pago(self):
		Socio.objects.filter(pk=self.socio.pk).update(numero_socio=None)

		response = self.client.post(
			reverse("registrar-pago"),
			{
				"socio_id": self.socio.pk,
				"cuota_ids": [self.cuota.pk],
				"monto_total": "100.00",
				"medios": [{"medio_de_pago": "Efectivo", "monto": "100.00"}],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("número de socio", response.data["detail"])
		self.assertFalse(Pago.objects.exists())
		self.assertFalse(Imputacion.objects.exists())


class ComprobanteListTests(ComprobanteTestBase):
	def list_comprobantes(self):
		with CaptureQueriesContext(connection) as queries:
			response = self.client.get(reverse("comprobante-list"))
		self.assertEqual(response.status_code, 200)
		return response.data, len(queries)

	def test_lista_incluye_el_socio_sin_consultas_por_comprobante(self):
		self.pagar("2500.00")
		_, queries_with_one = self.list_comprobantes()
		self.pagar("2500.00", cuotas=[self.generar("2026-11")])

		comprobantes, queries_with_two = self.list_comprobantes()

		self.assertEqual(len(comprobantes), 2)
		self.assertEqual(queries_with_two, queries_with_one)
		socio = comprobantes[0]["socio"]
		self.assertEqual(socio["socio_id"], self.socio.pk)
		self.assertEqual(socio["dni"], "80000001")
		self.assertEqual(socio["apellido"], "Prueba")

	def list_by_cuota(self, cuota_id):
		return self.client.get(reverse("comprobante-list"), {"cuota_id": cuota_id})

	def test_filters_receipts_by_cuota(self):
		first = self.pagar("2500.00")
		self.pagar("2500.00", cuotas=[self.generar("2026-11")])

		response = self.list_by_cuota(self.cuota.pk)

		self.assertEqual(response.status_code, 200)
		self.assertEqual([item["comprobante_id"] for item in response.data], [first["comprobante_id"]])

	def test_receipt_covering_several_cuotas_is_listed_once_per_cuota(self):
		november = self.generar("2026-11")
		receipt = self.pagar("5000.00", cuotas=[self.cuota, november])

		for cuota in (self.cuota, november):
			response = self.list_by_cuota(cuota.pk)
			self.assertEqual([item["comprobante_id"] for item in response.data], [receipt["comprobante_id"]])

	def test_includes_partial_payments_of_the_cuota(self):
		first = self.pagar("1000.00")
		second = self.pagar("1500.00")

		response = self.list_by_cuota(self.cuota.pk)

		self.assertEqual(
			[item["comprobante_id"] for item in response.data],
			[first["comprobante_id"], second["comprobante_id"]],
		)

	def test_cuota_without_payments_has_no_receipts(self):
		november = self.generar("2026-11")
		self.pagar("2500.00")

		response = self.list_by_cuota(november.pk)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data, [])

	def test_rejects_invalid_cuota_id(self):
		response = self.list_by_cuota("abc")

		self.assertEqual(response.status_code, 400)


class ComprobantePdfTests(ComprobanteTestBase):
	def descargar(self, numero):
		comprobante = Comprobante.objects.get(numero=numero)
		return self.client.get(reverse("comprobante-pdf", args=[comprobante.pk]))

	def test_descarga_el_recibo_x_con_los_datos_obligatorios(self):
		self.asignar_beca("500.00")
		detalle = self.pagar("2000.00")

		response = self.descargar(detalle["numero"])

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "application/pdf")
		self.assertEqual(
			response["Content-Disposition"],
			f'attachment; filename="comprobante-X-{detalle["numero"]:08d}.pdf"',
		)
		contenido = response.content
		self.assertTrue(contenido.startswith(b"%PDF"))
		for texto in (
			b"RECIBO X",
			f"X {detalle['numero']:08d}".encode(),
			self.socio.persona.dni.encode(),
			b"Prueba, Socio",
			b"2026-10",
			b"$ 1.000,00",
			b"$ 1.500,00",
			b"-$ 500,00",
			b"$ 2.000,00",
			b"Efectivo",
		):
			with self.subTest(texto=texto):
				self.assertIn(texto, contenido)
		self.assertNotIn(b"ANULADO", contenido)

	def test_recibo_anulado_indica_sus_notas_de_credito(self):
		original = self.pagar("1000.00")
		comprobante = Comprobante.objects.get(numero=original["numero"])
		self.client.post(reverse("revertir-pago", args=[comprobante.pago_id]), {"motivo": "Monto mal cargado", "responsable": "Tesorera"}, format="json")
		self.client.post(reverse("emitir-nota-credito", args=[comprobante.pk]), {
			"monto": "1000.00", "medio_de_pago": "Efectivo", "motivo": "Devolución", "responsable": "Tesorera",
		}, format="json")

		contenido = self.descargar(original["numero"]).content

		self.assertIn(b"ANULADO", contenido)
		self.assertIn(b"NC-X 00000001", contenido)

	def test_el_frontend_puede_leer_el_nombre_del_archivo(self):
		detalle = self.pagar("100.00")
		comprobante = Comprobante.objects.get(numero=detalle["numero"])

		response = self.client.get(reverse("comprobante-pdf", args=[comprobante.pk]), HTTP_ORIGIN="http://localhost:5173")

		self.assertIn("Content-Disposition", response["Access-Control-Expose-Headers"])

	def test_comprobante_inexistente_devuelve_404(self):
		response = self.client.get(reverse("comprobante-pdf", args=[999999]))

		self.assertEqual(response.status_code, 404)

	def test_formato_de_importes(self):
		self.assertEqual(format_amount(Decimal("1234567.5")), "$ 1.234.567,50")
		self.assertEqual(format_amount(Decimal("0")), "$ 0,00")
		self.assertEqual(format_amount(Decimal("-500")), "-$ 500,00")


class ProteccionRegistrosFinancierosTests(PagoTestBase):
	def setUp(self):
		super().setUp()
		respuesta = self.pagar([self.agosto], "400.00")
		self.pago = Pago.objects.get(pk=respuesta.data["pago"]["pago_id"])
		self.movimiento = self.pago.movimiento
		self.imputacion = Imputacion.objects.get(movimiento_origen=self.movimiento)
		self.item_pago = self.pago.items_pago.get()

	def test_pagos_comprobantes_movimientos_e_imputaciones_son_de_solo_lectura(self):
		escrituras = [
			("post", reverse("pago-list")),
			("post", reverse("item-pago-list")),
			("patch", reverse("item-pago-detail", args=[self.item_pago.pk])),
			("delete", reverse("item-pago-detail", args=[self.item_pago.pk])),
			("post", reverse("comprobante-list")),
			("post", reverse("movimiento-cuenta-list")),
			("patch", reverse("movimiento-cuenta-detail", args=[self.movimiento.pk])),
			("delete", reverse("movimiento-cuenta-detail", args=[self.movimiento.pk])),
			("post", reverse("imputacion-list")),
			("delete", reverse("imputacion-detail", args=[self.imputacion.pk])),
			("delete", reverse("cuenta-corriente-detail", args=[self.cuenta.pk])),
		]
		for metodo, url in escrituras:
			with self.subTest(metodo=metodo, url=url):
				self.assertEqual(getattr(self.client, metodo)(url, {}, format="json").status_code, 405)

		self.assertEqual(self.client.get(reverse("pago-list")).status_code, 200)
		self.assertEqual(self.client.get(reverse("imputacion-list")).status_code, 200)
		self.assertTrue(MovimientoCuenta.objects.filter(pk=self.movimiento.pk).exists())

	def test_current_account_is_read_only(self):
		url = reverse("cuenta-corriente-detail", args=[self.cuenta.pk])
		data = {"saldo": "999999.00", "estado_cuenta_corriente": "Inactivo"}

		for method in ("put", "patch"):
			with self.subTest(method=method):
				self.assertEqual(getattr(self.client, method)(url, data, format="json").status_code, 405)
		self.cuenta.refresh_from_db()
		self.assertEqual(self.cuenta.estado_cuenta_corriente, "Activo")
		self.assertEqual(self.client.get(url).status_code, 200)

	def test_cuota_con_pagos_no_se_edita_ni_se_elimina(self):
		edicion = self.client.patch(
			reverse("cuota-detail", args=[self.agosto.pk]),
			{"fecha_venc1": "2026-08-15"},
			format="json",
		)
		baja = self.client.delete(reverse("cuota-detail", args=[self.agosto.pk]))

		for response in (edicion, baja):
			self.assertEqual(response.status_code, 400)
		self.assertTrue(Cuota.objects.filter(pk=self.agosto.pk).exists())
		self.assertEqual(self.agosto.items.count(), 1)
		self.assertEqual(MovimientoCuenta.objects.get(cuota=self.agosto).monto, Decimal("1000.00"))

	def test_cuota_items_are_read_only(self):
		item = self.septiembre.items.get()
		writes = [
			("post", reverse("item-cuota-list"), {"cuota": self.septiembre.pk, "concepto": "Otro", "fecha_aplicacion": "2026-09-01", "monto": "10.00"}),
			("put", reverse("item-cuota-detail", args=[item.pk]), {"cuota": self.agosto.pk}),
			("patch", reverse("item-cuota-detail", args=[item.pk]), {"cuota": self.agosto.pk, "monto": "1.00"}),
			("delete", reverse("item-cuota-detail", args=[item.pk]), {}),
		]

		for method, url, data in writes:
			with self.subTest(method=method, url=url):
				self.assertEqual(getattr(self.client, method)(url, data, format="json").status_code, 405)
		item.refresh_from_db()
		self.assertEqual(item.cuota_id, self.septiembre.pk)
		self.assertEqual(item.monto, Decimal("1000.00"))
		self.assertEqual(self.septiembre.items.count(), 1)
		self.assertEqual(self.client.get(reverse("item-cuota-detail", args=[item.pk])).status_code, 200)

	def test_cuota_sin_pagos_sigue_pudiendo_eliminarse(self):
		response = self.client.delete(reverse("cuota-detail", args=[self.septiembre.pk]))

		self.assertEqual(response.status_code, 204)
		self.assertFalse(Cuota.objects.filter(pk=self.septiembre.pk).exists())

	def test_la_base_impide_borrar_pagos_y_movimientos(self):
		with self.assertRaises(ProtectedError):
			self.pago.delete()
		with self.assertRaises(ProtectedError):
			self.movimiento.delete()
		with self.assertRaises(ProtectedError):
			self.cuenta.delete()


class ReporteMorosidadTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.hoy = timezone.localdate()
		persona = Persona.objects.create(nombre="Rosa", apellido="Mora", dni="78901234")
		self.socio = Socio.objects.create(persona=persona)
		self.cuenta = account_for(self.socio)
		self.vencida = crear_cuota_con_cargo(
			self.cuenta, "2026-08", "1000.00", EstadoCuotaChoices.VENCIDA_1,
			venc1=self.hoy - timedelta(days=5), venc2=self.hoy + timedelta(days=5),
		)
		crear_cuota_con_cargo(
			self.cuenta, "2026-09", "1000.00",
			venc1=self.hoy + timedelta(days=3), venc2=self.hoy + timedelta(days=13),
		)

	def reporte(self, **params):
		response = self.client.get(reverse("reporte-morosidad"), params)
		self.assertEqual(response.status_code, 200, response.data)
		return response.data

	def fila(self, data):
		return next(fila for fila in data["filas"] if fila["socio_id"] == self.socio.pk)

	def test_cuota_vencida_desde_el_primer_vencimiento(self):
		fila = self.fila(self.reporte())

		self.assertEqual(fila["monto_adeudado"], Decimal("1000.00"))
		self.assertEqual(fila["cuotas_vencidas"], 1)
		self.assertEqual(fila["cuotas_vencidas_1"], 1)
		self.assertEqual(fila["cuotas_vencidas_2"], 0)
		self.assertEqual(fila["dias_mora"], 5)

	def test_distingue_cuotas_vencidas_en_segundo_vencimiento(self):
		crear_cuota_con_cargo(
			self.cuenta, "2026-07", "500.00", EstadoCuotaChoices.VENCIDA_2,
			venc1=self.hoy - timedelta(days=20), venc2=self.hoy - timedelta(days=10),
		)

		fila = self.fila(self.reporte())

		self.assertEqual(fila["monto_adeudado"], Decimal("1500.00"))
		self.assertEqual(fila["cuotas_vencidas"], 2)
		self.assertEqual(fila["cuotas_vencidas_1"], 1)
		self.assertEqual(fila["cuotas_vencidas_2"], 1)
		self.assertEqual(fila["dias_mora"], 20)

	def test_monto_adeudado_descuenta_pagos_parciales(self):
		self.client.post(
			reverse("registrar-pago"),
			{
				"socio_id": self.socio.pk,
				"cuota_ids": [self.vencida.pk],
				"monto_total": "300.00",
				"medios": [{"medio_de_pago": "Efectivo", "monto": "300.00"}],
			},
			format="json",
		)

		fila = self.fila(self.reporte())

		self.assertEqual(fila["monto_adeudado"], Decimal("700.00"))

	def test_socio_sin_deuda_vencida_no_figura(self):
		crear_socio("78901235")
		CuentaCorriente.objects.get(socio=crear_socio("78901236")).delete()

		data = self.reporte()

		self.assertEqual(len(data["filas"]), 1)
		self.assertEqual(data["sin_cuenta"], 1)
		self.assertNotIn("erroresConsulta", data)

	def test_kpis_del_padron_filtrado(self):
		crear_socio("78901235")
		crear_socio("78901236")
		crear_socio("78901237")

		data = self.reporte()

		self.assertEqual(data["padron"], 4)
		self.assertEqual(data["monto_total"], Decimal("1000.00"))
		self.assertEqual(data["porcentaje_morosidad"], Decimal("25.0"))

	def test_separa_capital_y_recargos_por_mora(self):
		ItemCuota.objects.create(cuota=self.vencida, concepto="Mora", fecha_aplicacion=self.hoy, monto=Decimal("150.00"))
		sync_cuota_charge(self.vencida)

		fila = self.fila(self.reporte())

		self.assertEqual(fila["monto_adeudado"], Decimal("1150.00"))
		self.assertEqual(fila["capital"], Decimal("1000.00"))
		self.assertEqual(fila["recargos"], Decimal("150.00"))

	def deudor_jugador(self, dni):
		jugador = crear_socio(dni, con_jugador=True)
		crear_cuota_con_cargo(
			account_for(jugador), "2026-08", "3000.00", EstadoCuotaChoices.VENCIDA_1,
			venc1=self.hoy - timedelta(days=5), venc2=self.hoy + timedelta(days=5),
		)
		return jugador

	def test_filtra_por_tipo_de_afiliacion(self):
		jugador = self.deudor_jugador("78901238")

		solo_jugadores = [fila["socio_id"] for fila in self.reporte(tipo="jugadores")["filas"]]
		solo_socios = [fila["socio_id"] for fila in self.reporte(tipo="socios")["filas"]]

		self.assertEqual(solo_jugadores, [jugador.pk])
		self.assertEqual(solo_socios, [self.socio.pk])
		self.assertEqual(self.reporte(tipo="jugadores")["filas"][0]["tipo"], "Jugador")
		self.assertEqual(self.reporte(tipo="jugadores")["filas"][0]["jugador_id"], jugador.jugador.jugador_id)

	def test_filtra_por_categoria_y_lista_las_afectadas(self):
		jugador = self.deudor_jugador("78901239")
		categoria = jugador.jugador.categoria
		self.deudor_jugador("78901240")

		data = self.reporte(alcance="categoria", categoria_id=categoria.pk)

		self.assertEqual([fila["socio_id"] for fila in data["filas"]], [jugador.pk])
		self.assertEqual(data["alcance"], f"Categoría {categoria.nombre}")
		self.assertEqual(data["categorias_afectadas"], [])

	def test_categorias_afectadas_agrupan_morosos_y_ordenan_por_monto(self):
		mayor = self.deudor_jugador("78901241").jugador.categoria
		companero = self.deudor_jugador("78901242").jugador
		companero.categoria = mayor
		companero.save(update_fields=["categoria"])
		menor = self.deudor_jugador("78901243").jugador.categoria

		categorias = self.reporte()["categorias_afectadas"]

		self.assertEqual(categorias, [
			{"nombre": mayor.nombre, "morosos": 2, "monto": Decimal("6000.00")},
			{"nombre": menor.nombre, "morosos": 1, "monto": Decimal("3000.00")},
		])

	def test_filtra_las_cuotas_por_periodo(self):
		crear_cuota_con_cargo(
			self.cuenta, "2026-02", "500.00", EstadoCuotaChoices.VENCIDA_2,
			venc1=self.hoy - timedelta(days=200), venc2=self.hoy - timedelta(days=190),
		)

		mensual = self.fila(self.reporte(periodo="mensual", referencia="2026-02"))
		trimestral = self.fila(self.reporte(periodo="trimestral", referencia="2026-T3"))
		anual = self.reporte(periodo="anual", referencia="2026")

		self.assertEqual(mensual["monto_adeudado"], Decimal("500.00"))
		self.assertEqual(trimestral["monto_adeudado"], Decimal("1000.00"))
		self.assertEqual(self.fila(anual)["monto_adeudado"], Decimal("1500.00"))
		self.assertEqual(anual["periodo"], "Anual · 2026")
		self.assertEqual(self.reporte(periodo="anual", referencia="2025")["filas"], [])

	def test_rechaza_filtros_invalidos(self):
		for params in (
			{"tipo": "otros"},
			{"alcance": "socio"},
			{"alcance": "categoria"},
			{"periodo": "semanal", "referencia": "2026"},
			{"periodo": "mensual", "referencia": "2026-13"},
			{"periodo": "trimestral", "referencia": "2026-T5"},
		):
			with self.subTest(params=params):
				response = self.client.get(reverse("reporte-morosidad"), params)

				self.assertEqual(response.status_code, 400)


class ResumenFinancieroTests(APITestCase):
	"""Income, methods and refunds follow the money of the month; cuota indicators follow the period."""

	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.periodo = timezone.localdate().strftime("%Y-%m")
		self.socio = crear_socio("78901237")
		self.cuota = crear_cuota_con_cargo(account_for(self.socio), self.periodo, "1000.00")
		register_payment(self.socio.pk, [self.cuota.pk], [
			{"medio_de_pago": "Efectivo", "monto": Decimal("400.00")},
			{"medio_de_pago": "Transferencia", "monto": Decimal("200.00")},
		], Decimal("600.00"))
		for concepto, medio, monto in (
			("Venta de indumentaria", "Transferencia", "300.00"),
			("Donación", "Efectivo", "50.00"),
			("Rifa", "Efectivo", "20.00"),
			("Bufet", "Efectivo", "10.00"),
		):
			register_income(self.socio.pk, concepto, [{"medio_de_pago": medio, "monto": Decimal(monto)}], Decimal(monto))
		anulado, _ = register_income(self.socio.pk, "Error", [{"medio_de_pago": "Efectivo", "monto": Decimal("999.00")}], Decimal("999.00"))
		revert_payment(anulado.pk, "Carga duplicada", "Tesorera")
		create_manual_refund(self.socio.pk, "Transferencia de más", Decimal("180.00"), "Transferencia", "Tesorera")

	def resumen(self, **params):
		return self.client.get(reverse("resumen-financiero"), {"periodo": self.periodo, **params})

	def test_origen_de_los_ingresos_agrupa_los_conceptos_menores(self):
		ingresos = self.resumen().data["ingresos"]

		self.assertEqual(ingresos["total"], Decimal("980.00"))
		self.assertEqual(ingresos["cuotas"], Decimal("600.00"))
		self.assertEqual(
			[(row["nombre"], row["monto"]) for row in ingresos["origen"]],
			[("Cuotas", Decimal("600.00")), ("Venta de indumentaria", Decimal("300.00")), ("Donación", Decimal("50.00")), ("Otros", Decimal("30.00"))],
		)
		self.assertEqual(ingresos["origen"][0]["porcentaje"], Decimal("61.2"))

	def test_origen_de_los_ingresos_se_ordena_de_mayor_a_menor(self):
		register_income(self.socio.pk, "Sponsoreo", [{"medio_de_pago": "Transferencia", "monto": Decimal("2000.00")}], Decimal("2000.00"))

		origen = self.resumen().data["ingresos"]["origen"]

		self.assertEqual(
			[(row["nombre"], row["monto"]) for row in origen],
			[("Sponsoreo", Decimal("2000.00")), ("Cuotas", Decimal("600.00")), ("Venta de indumentaria", Decimal("300.00")), ("Otros", Decimal("80.00"))],
		)

	def test_kpis_de_las_cuotas_del_periodo(self):
		self.assertEqual(self.resumen().data["cuotas"], {
			"esperado": Decimal("1000.00"),
			"cobrado": Decimal("600.00"),
			"en_deuda": Decimal("400.00"),
			"efectividad": Decimal("60.0"),
			"generadas": 1,
			"pagas": 0,
			"recargos": Decimal("0.00"),
		})

	def test_medios_de_pago_dinamicos_sin_comprobantes_anulados(self):
		medios = self.resumen().data["medios_de_pago"]

		self.assertEqual(medios["total"], Decimal("980.00"))
		montos = {row["codigo"]: row["monto"] for row in medios["medios"]}
		self.assertEqual(montos["Transferencia"], Decimal("500.00"))
		self.assertEqual(montos["Efectivo"], Decimal("480.00"))
		self.assertEqual(montos["BilleteraVirtual"], Decimal("0.00"))

	def test_ingresos_extra_y_devoluciones_se_detallan_sin_restar(self):
		data = self.resumen().data

		self.assertEqual(data["ingresos_extra"]["total"], Decimal("380.00"))
		self.assertEqual(len(data["ingresos_extra"]["movimientos"]), 4)
		self.assertEqual(data["devoluciones"]["total"], Decimal("180.00"))
		self.assertEqual(data["devoluciones"]["movimientos"][0]["codigo"], "DEV-X 00000001")

	def test_evolucion_de_los_ultimos_doce_periodos(self):
		evolucion = self.resumen().data["evolucion"]

		self.assertEqual(len(evolucion), 12)
		self.assertEqual(evolucion[-1], {
			"periodo": self.periodo, "facturado": Decimal("1000.00"), "cobrado": Decimal("600.00"), "efectividad": Decimal("60.0"),
		})
		self.assertIsNone(evolucion[0]["efectividad"])

	def test_conserva_la_deuda_que_usa_el_dashboard(self):
		data = self.client.get(reverse("resumen-financiero")).data

		for campo in ("socios_en_mora", "monto_adeudado_total", "cuotas_vencidas", "cuotas_vencidas_1", "cuotas_vencidas_2"):
			self.assertIn(campo, data)

	def test_periodo_invalido(self):
		self.assertEqual(self.resumen(periodo="2026-13").status_code, 400)

	def test_descarga_pdf_con_la_misma_estructura(self):
		response = self.client.get(reverse("resumen-financiero-pdf"), {"periodo": self.periodo})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "application/pdf")
		self.assertIn(f"informe-financiero-{self.periodo}.pdf", response["Content-Disposition"])
		for texto in (b"Resumen financiero", b"Venta de indumentaria", b"DEV-X 00000001", b"Evoluci"):
			with self.subTest(texto=texto):
				self.assertIn(texto, response.content)


class ReporteMorosidadPdfTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		today = timezone.localdate()
		self.debtor = Socio.objects.create(persona=Persona.objects.create(nombre="Rosa", apellido="Mora", dni="78901240"))
		crear_cuota_con_cargo(
			account_for(self.debtor), "2026-08", "1000.00", EstadoCuotaChoices.VENCIDA_1,
			venc1=today - timedelta(days=5), venc2=today + timedelta(days=5),
		)
		self.up_to_date = Socio.objects.create(persona=Persona.objects.create(nombre="Luis", apellido="Paz", dni="78901241"))
		crear_cuota_con_cargo(
			account_for(self.up_to_date), "2026-08", "1000.00",
			venc1=today + timedelta(days=5), venc2=today + timedelta(days=15),
		)

	def download(self, **params):
		return self.client.get(reverse("reporte-morosidad-pdf"), params)

	def test_returns_pdf_attachment_with_debtors(self):
		response = self.download()

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "application/pdf")
		self.assertRegex(response["Content-Disposition"], r'^attachment; filename="reporte-morosidad-\d{8}-\d{4}\.pdf"$')
		self.assertTrue(response.content.startswith(b"%PDF"))
		self.assertIn(b"Mora, Rosa", response.content)
		self.assertIn(b"78901240", response.content)
		self.assertIn(b"$ 1.000,00", response.content)
		self.assertNotIn(b"Paz, Luis", response.content)

	def test_respects_selected_scope(self):
		otra_categoria = Categoria.objects.create(nombre="Otras", anio_vigente=2026, edad_maxima=18, genero="M")
		response = self.download(alcance="categoria", categoria_id=otra_categoria.pk)

		self.assertEqual(response.status_code, 200)
		self.assertNotIn(b"Mora, Rosa", response.content)
		self.assertIn(b"No hay socios con deuda vencida", response.content)

		categoria = Categoria.objects.create(nombre="Primera", anio_vigente=2026, edad_maxima=30, genero="M")
		Jugador.objects.create(socio=self.debtor, categoria=categoria)

		response = self.download(alcance="categoria", categoria_id=categoria.pk, tipo="jugadores", periodo="anual", referencia="2026")

		self.assertIn(b"Mora, Rosa", response.content)
		self.assertIn(b"Primera", response.content)
		self.assertIn(b"Tipo: Solo jugadores", response.content)
		self.assertIn(b"Anual", response.content)

	def test_rejects_invalid_parameters(self):
		for params in ({"alcance": "todos"}, {"alcance": "manual"}, {"alcance": "socio"}, {"alcance": "categoria", "categoria_id": "x"}):
			with self.subTest(params=params):
				response = self.download(**params)

				self.assertEqual(response.status_code, 400)
				self.assertIn("detail", response.data)


class RecargosPorMoraTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.hoy = timezone.localdate()
		persona = Persona.objects.create(nombre="Tomas", apellido="Rey", dni="89012345")
		self.socio = Socio.objects.create(persona=persona)
		self.cuenta = account_for(self.socio)
		self.configurar(valor_recargo_1="200.00", tipo_recargo_2="Porcentaje", valor_recargo_2="10.00")

	def configurar(self, **valores):
		ConfiguracionFinanciera.objects.update_or_create(pk=1, defaults=valores)

	def cuota(self, dias_venc1, dias_venc2, periodo="2026-08"):
		return crear_cuota_con_cargo(
			self.cuenta, periodo, "1000.00",
			venc1=self.hoy + timedelta(days=dias_venc1),
			venc2=self.hoy + timedelta(days=dias_venc2),
		)

	def recargos(self, cuota):
		return list(cuota.items.filter(concepto="Mora").order_by("pk"))

	def test_aplica_ambos_recargos_sobre_el_valor_de_la_cuota(self):
		cuota = self.cuota(-15, -5)

		resultado = apply_surcharges(self.hoy)

		recargos = self.recargos(cuota)
		self.assertEqual([item.monto for item in recargos], [Decimal("200.00"), Decimal("100.00")])
		self.assertIn("Recargo por 1° vencimiento", recargos[0].motivo)
		self.assertIn(cuota.fecha_venc1.strftime("%d/%m/%Y"), recargos[0].motivo)
		self.assertIn("Recargo por 2° vencimiento", recargos[1].motivo)
		cuota.refresh_from_db()
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.VENCIDA_2)
		self.assertEqual(cuota.recargos_aplicados, 2)
		self.assertEqual(MovimientoCuenta.objects.get(cuota=cuota).monto, Decimal("1300.00"))
		self.cuenta.refresh_from_db()
		self.assertEqual(resultado["recargos_primer_vencimiento"], 1)
		self.assertEqual(resultado["recargos_segundo_vencimiento"], 1)
		self.assertEqual(resultado["monto_total"], Decimal("300.00"))

	def test_entre_vencimientos_solo_aplica_el_primero(self):
		cuota = self.cuota(-3, 7)

		apply_surcharges(self.hoy)

		self.assertEqual([item.monto for item in self.recargos(cuota)], [Decimal("200.00")])
		cuota.refresh_from_db()
		self.assertEqual(cuota.recargos_aplicados, 1)

	def test_el_dia_del_vencimiento_todavia_no_hay_recargo(self):
		cuota = self.cuota(0, 10)

		apply_surcharges(self.hoy)

		self.assertEqual(self.recargos(cuota), [])

	def test_ejecutar_dos_veces_no_duplica(self):
		cuota = self.cuota(-15, -5)

		apply_surcharges(self.hoy)
		segundo = apply_surcharges(self.hoy)

		self.assertEqual(len(self.recargos(cuota)), 2)
		self.assertEqual(segundo["cuotas_revisadas"], 0)

	def test_cuota_paga_no_recibe_recargo(self):
		cuota = self.cuota(-15, -5)
		cuota.estado_cuota = EstadoCuotaChoices.PAGA
		cuota.save(update_fields=["estado_cuota"])

		apply_surcharges(self.hoy)

		self.assertEqual(self.recargos(cuota), [])

	def test_cuota_con_pago_parcial_recibe_recargo_y_aumenta_el_pendiente(self):
		cuota = self.cuota(-15, 5)
		self.client.post(
			reverse("registrar-pago"),
			{
				"socio_id": self.socio.pk,
				"cuota_ids": [cuota.pk],
				"monto_total": "400.00",
				"medios": [{"medio_de_pago": "Efectivo", "monto": "400.00"}],
			},
			format="json",
		)

		apply_surcharges(self.hoy)

		estado = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data
		fila = estado["cuotas"][0]
		self.assertEqual(Decimal(str(fila["saldo_pendiente"])), Decimal("800.00"))
		self.assertEqual(Decimal(str(estado["total_mora"])), Decimal("200.00"))

	def test_recargo_en_cero_no_se_aplica_de_forma_retroactiva(self):
		self.configurar(valor_recargo_1="0.00", valor_recargo_2="0.00")
		cuota = self.cuota(-15, -5)
		apply_surcharges(self.hoy)

		self.configurar(valor_recargo_1="200.00", valor_recargo_2="10.00")
		apply_surcharges(self.hoy)

		self.assertEqual(self.recargos(cuota), [])
		cuota.refresh_from_db()
		self.assertEqual(cuota.recargos_aplicados, 2)
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.VENCIDA_2)

	def test_endpoint_manual_aplica_recargos(self):
		self.cuota(-15, -5)

		response = self.client.post(reverse("aplicar-recargos"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["recargos_primer_vencimiento"], 1)
		self.assertEqual(response.data["estados_actualizados"], 1)

	def test_la_tarea_diaria_avanza_el_estado_en_cada_vencimiento(self):
		cuota = self.cuota(5, 15)

		estados = []
		for dias in (0, 6, 16):
			apply_surcharges(self.hoy + timedelta(days=dias))
			cuota.refresh_from_db()
			estados.append((cuota.estado_cuota, cuota.recargos_aplicados))

		self.assertEqual(estados, [
			(EstadoCuotaChoices.EN_FECHA, 0),
			(EstadoCuotaChoices.VENCIDA_1, 1),
			(EstadoCuotaChoices.VENCIDA_2, 2),
		])

	def test_la_tarea_diaria_corrige_estados_desactualizados(self):
		atrasada = self.cuota(-15, -5)
		Cuota.objects.filter(pk=atrasada.pk).update(estado_cuota=EstadoCuotaChoices.EN_FECHA, recargos_aplicados=2)
		adelantada = self.cuota(5, 15, periodo="2026-09")
		Cuota.objects.filter(pk=adelantada.pk).update(estado_cuota=EstadoCuotaChoices.VENCIDA_2)

		resultado = apply_surcharges(self.hoy)

		atrasada.refresh_from_db()
		adelantada.refresh_from_db()
		self.assertEqual(atrasada.estado_cuota, EstadoCuotaChoices.VENCIDA_2)
		self.assertEqual(adelantada.estado_cuota, EstadoCuotaChoices.EN_FECHA)
		self.assertEqual(self.recargos(atrasada), [])
		self.assertEqual(resultado["cuotas_revisadas"], 2)
		self.assertEqual(resultado["estados_actualizados"], 2)


class EstadoCuotaTests(TestCase):
	def cuota(self, venc1=date(2026, 9, 10), venc2=date(2026, 9, 20)):
		return Cuota(fecha_venc1=venc1, fecha_venc2=venc2, periodo="2026-09")

	def test_estado_segun_saldo_y_vencimientos(self):
		casos = [
			(Decimal("0.00"), date(2026, 9, 25), EstadoCuotaChoices.PAGA),
			(Decimal("-10.00"), date(2026, 9, 1), EstadoCuotaChoices.PAGA),
			(Decimal("100.00"), date(2026, 9, 10), EstadoCuotaChoices.EN_FECHA),
			(Decimal("100.00"), date(2026, 9, 11), EstadoCuotaChoices.VENCIDA_1),
			(Decimal("100.00"), date(2026, 9, 20), EstadoCuotaChoices.VENCIDA_1),
			(Decimal("100.00"), date(2026, 9, 21), EstadoCuotaChoices.VENCIDA_2),
		]
		for pendiente, hoy, esperado in casos:
			with self.subTest(pendiente=pendiente, hoy=hoy):
				self.assertEqual(cuota_state(self.cuota(), pendiente, hoy), esperado)


class EstadoCuotaConPagosTests(PagoTestBase):
	def test_pago_parcial_mantiene_vencida_en_segunda_fecha(self):
		response = self.pagar([self.agosto], "400.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.VENCIDA_2)

	def test_revertir_pago_devuelve_la_cuota_a_vencida_en_segunda_fecha(self):
		original = self.pagar([self.agosto], "1000.00")
		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)

		response = self.client.post(
			reverse("revertir-pago", args=[original.data["pago"]["pago_id"]]),
			{"motivo": "Socio equivocado", "responsable": "Tesorera"},
			format="json",
		)

		self.assertEqual(response.status_code, 200, response.data)
		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.VENCIDA_2)


class CuotaVencimientosManualesTests(APITestCase):
	"""Cuotas created or edited with due dates already past get their state and surcharges right away."""

	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.today = timezone.localdate()
		self.socio = crear_socio("30000077", con_jugador=True)
		ConfiguracionFinanciera.objects.update_or_create(pk=1, defaults={
			"valor_recargo_1": "200.00",
			"tipo_recargo_2": "Porcentaje",
			"valor_recargo_2": "10.00",
		})

	def due(self, days):
		return (self.today + timedelta(days=days)).isoformat()

	def create(self, first_days, second_days):
		return self.client.post(
			reverse("cuota-list"),
			{
				"socio_id": self.socio.pk,
				"periodo": self.today.strftime("%Y-%m"),
				"fecha_venc1": self.due(first_days),
				"fecha_venc2": self.due(second_days),
			},
			format="json",
		)

	def edit(self, cuota_id, first_days, second_days):
		return self.client.patch(
			reverse("cuota-detail", args=[cuota_id]),
			{"fecha_venc1": self.due(first_days), "fecha_venc2": self.due(second_days)},
			format="json",
		)

	def assert_cuota(self, response, state, amount):
		self.assertIn(response.status_code, (200, 201), response.data)
		self.assertEqual(response.data["estado_cuota"], state)
		self.assertEqual(Decimal(str(response.data["monto_total"])), Decimal(amount))

	def test_alta_con_primer_vencimiento_pasado_queda_vencida_con_primer_recargo(self):
		response = self.create(-2, 4)

		self.assert_cuota(response, EstadoCuotaChoices.VENCIDA_1, "2700.00")
		self.assertEqual(Cuota.objects.get(pk=response.data["cuota_id"]).recargos_aplicados, 1)

	def test_alta_con_ambos_vencimientos_pasados_aplica_los_dos_recargos(self):
		response = self.create(-10, -3)

		self.assert_cuota(response, EstadoCuotaChoices.VENCIDA_2, "2950.00")
		self.assertEqual(Cuota.objects.get(pk=response.data["cuota_id"]).recargos_aplicados, 2)

	def test_alta_con_vencimientos_futuros_queda_en_fecha_sin_recargos(self):
		response = self.create(3, 10)

		self.assert_cuota(response, EstadoCuotaChoices.EN_FECHA, "2500.00")
		self.assertFalse(ItemCuota.objects.filter(cuota_id=response.data["cuota_id"], concepto="Mora").exists())

	def test_editar_vencimientos_a_fechas_pasadas_la_marca_vencida(self):
		cuota_id = self.create(3, 10).data["cuota_id"]

		response = self.edit(cuota_id, -2, 4)

		self.assert_cuota(response, EstadoCuotaChoices.VENCIDA_1, "2700.00")

	def test_editar_vencimientos_a_fechas_futuras_la_vuelve_en_fecha_y_quita_el_recargo(self):
		cuota_id = self.create(-2, 4).data["cuota_id"]

		response = self.edit(cuota_id, 5, 15)

		self.assert_cuota(response, EstadoCuotaChoices.EN_FECHA, "2500.00")
		self.assertFalse(ItemCuota.objects.filter(cuota_id=cuota_id, concepto="Mora").exists())
		self.assertEqual(Cuota.objects.get(pk=cuota_id).recargos_aplicados, 0)

	def test_editar_segundo_vencimiento_a_fecha_futura_conserva_solo_el_primer_recargo(self):
		cuota_id = self.create(-10, -3).data["cuota_id"]

		response = self.edit(cuota_id, -10, 4)

		self.assert_cuota(response, EstadoCuotaChoices.VENCIDA_1, "2700.00")
		self.assertEqual(ItemCuota.objects.filter(cuota_id=cuota_id, concepto="Mora").count(), 1)
		self.assertEqual(Cuota.objects.get(pk=cuota_id).recargos_aplicados, 1)

	def test_editar_sin_cambiar_fechas_no_duplica_recargos(self):
		cuota_id = self.create(-10, -3).data["cuota_id"]

		response = self.edit(cuota_id, -10, -3)

		self.assert_cuota(response, EstadoCuotaChoices.VENCIDA_2, "2950.00")
		self.assertEqual(ItemCuota.objects.filter(cuota_id=cuota_id, concepto="Mora").count(), 2)


class TareasProgramadasTests(TestCase):
	migracion = import_module("finanzas.migrations.0019_tareas_programadas")

	def local(self, *args):
		return timezone.make_aware(datetime(*args))

	def test_tareas_registradas_en_django_q(self):
		esperadas = {
			self.migracion.MONTHLY_GENERATION: ("finanzas.tasks.generate_scheduled_cuotas", Schedule.DAILY, None, 1),
			self.migracion.DAILY_SURCHARGES: ("finanzas.tasks.apply_scheduled_surcharges", Schedule.DAILY, None, 2),
		}
		for nombre, (funcion, tipo, dia, hora) in esperadas.items():
			with self.subTest(nombre=nombre):
				tarea = Schedule.objects.get(name=nombre)
				self.assertEqual(tarea.func, funcion)
				self.assertEqual(tarea.schedule_type, tipo)
				self.assertEqual(tarea.repeats, -1)
				self.assertTrue(callable(import_string(tarea.func)))
				proxima = timezone.localtime(tarea.next_run)
				self.assertGreater(proxima, timezone.localtime() - timedelta(minutes=1))
				self.assertEqual(proxima.hour, hora)
				if dia is not None:
					self.assertEqual(proxima.day, dia)

	def test_django_q_ejecuta_las_tareas_programadas(self):
		crear_socio("90000001", con_jugador=True)
		ConfiguracionFinanciera.objects.update_or_create(pk=1, defaults={"dia_generacion": timezone.localdate().day})

		for tarea in Schedule.objects.filter(name__in=[self.migracion.MONTHLY_GENERATION, self.migracion.DAILY_SURCHARGES]):
			with self.subTest(tarea=tarea.name):
				id_tarea = async_task(tarea.func, sync=True)
				resultado = fetch(id_tarea)
				self.assertTrue(resultado.success, resultado.result)

		self.assertEqual(Cuota.objects.filter(movimiento__cuenta_corriente__socio__persona__dni="90000001").count(), 3)

	def test_proxima_generacion_mensual(self):
		casos = [
			(self.local(2026, 10, 3, 15, 0), self.local(2026, 11, 1, 1, 0)),
			(self.local(2026, 11, 1, 0, 30), self.local(2026, 11, 1, 1, 0)),
			(self.local(2026, 11, 1, 1, 0), self.local(2026, 12, 1, 1, 0)),
			(self.local(2026, 12, 20, 9, 0), self.local(2027, 1, 1, 1, 0)),
		]
		for ahora, esperado in casos:
			with self.subTest(ahora=ahora):
				self.assertEqual(self.migracion.next_monthly_run(ahora), esperado)

	def test_proxima_aplicacion_diaria_de_recargos(self):
		self.assertEqual(self.migracion.next_daily_run(self.local(2026, 10, 3, 1, 0)), self.local(2026, 10, 3, 2, 0))
		self.assertEqual(self.migracion.next_daily_run(self.local(2026, 10, 3, 2, 0)), self.local(2026, 10, 4, 2, 0))
		self.assertEqual(self.migracion.next_daily_run(self.local(2026, 12, 31, 23, 0)), self.local(2027, 1, 1, 2, 0))


class NumeracionComprobanteTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		persona = Persona.objects.create(nombre="Luis", apellido="Gomez", dni="23456789")
		self.socio = Socio.objects.create(persona=persona)
		self.cuenta = account_for(self.socio)
		self.cuotas = [crear_cuota_con_cargo(self.cuenta, f"2026-0{mes}", "100.00") for mes in (8, 9)]

	def registrar_pago(self, cuota):
		return self.client.post(
			reverse("registrar-pago"),
			{
				"socio_id": self.socio.pk,
				"cuota_ids": [cuota.pk],
				"monto_total": "100.00",
				"medios": [{"medio_de_pago": "Efectivo", "monto": "100.00"}],
			},
			format="json",
		)

	def test_numeracion_continua_desde_ultimo_numero(self):
		SecuenciaComprobante.objects.update_or_create(tipo="Recibo", defaults={"ultimo_numero": 41})

		self.assertEqual(next_receipt_number(), 42)
		self.assertEqual(next_receipt_number(), 43)

	def test_pagos_consecutivos_generan_numeros_correlativos(self):
		primero = self.registrar_pago(self.cuotas[0])
		segundo = self.registrar_pago(self.cuotas[1])

		self.assertEqual(primero.status_code, 201, primero.data)
		self.assertEqual(segundo.status_code, 201, segundo.data)
		self.assertEqual(
			segundo.data["comprobante"]["numero"],
			primero.data["comprobante"]["numero"] + 1,
		)
		self.assertEqual(
			SecuenciaComprobante.objects.get(tipo="Recibo").ultimo_numero,
			segundo.data["comprobante"]["numero"],
		)


class MovimientoCuotaMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0011_movimiento_cuota_schema")]
	migrate_to = [("finanzas", "0013_remove_cuota_cuenta_corriente")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_vincula_cuotas_y_reversiones_a_movimientos(self):
		old_apps = self.migrate(self.migrate_from)
		OldCuota = old_apps.get_model("finanzas", "Cuota")
		OldItemCuota = old_apps.get_model("finanzas", "ItemCuota")
		OldPago = old_apps.get_model("finanzas", "Pago")
		OldMovimiento = old_apps.get_model("finanzas", "MovimientoCuenta")

		persona = Persona.objects.create(nombre="Ana", apellido="Ruiz", dni="45678901")
		socio = Socio(persona=persona)
		socio.save_base(raw=True)
		cuenta = old_apps.get_model("finanzas", "CuentaCorriente").objects.create(socio_id=socio.pk)
		cuota = OldCuota.objects.create(
			cuenta_corriente_id=cuenta.pk,
			fecha_venc1=date(2026, 8, 10),
			fecha_venc2=date(2026, 8, 20),
			periodo="2026-08",
		)
		OldItemCuota.objects.create(cuota=cuota, concepto="CuotaSocial", fecha_aplicacion=date(2026, 8, 1), monto=Decimal("1000.00"))
		OldItemCuota.objects.create(cuota=cuota, concepto="Beca", es_descuento=True, fecha_aplicacion=date(2026, 8, 1), monto=Decimal("200.00"))
		pago = OldPago.objects.create(fecha=date(2026, 8, 5))
		abono = OldMovimiento.objects.create(
			cuenta_corriente_id=cuenta.pk, pago=pago, tipo_movimiento="Abono",
			fecha="2026-08-05T12:00:00Z", monto=Decimal("800.00"),
		)
		reversion = OldMovimiento.objects.create(
			cuenta_corriente_id=cuenta.pk, pago=pago, tipo_movimiento="Cargo",
			fecha="2026-08-06T12:00:00Z", monto=Decimal("800.00"),
		)

		new_apps = self.migrate(self.migrate_to)
		NewCuota = new_apps.get_model("finanzas", "Cuota")
		NewMovimiento = new_apps.get_model("finanzas", "MovimientoCuenta")

		cargo = NewMovimiento.objects.get(cuota_id=cuota.pk)
		self.assertEqual(cargo.tipo_movimiento, "Cargo")
		self.assertEqual(cargo.monto, Decimal("800.00"))
		self.assertEqual(cargo.cuenta_corriente_id, cuenta.pk)
		self.assertEqual(NewCuota.objects.get(pk=cuota.pk).fecha_creacion.date(), date(2026, 8, 1))
		reversion = NewMovimiento.objects.get(pk=reversion.pk)
		self.assertIsNone(reversion.pago_id)
		self.assertEqual(reversion.movimiento_revertido_id, abono.pk)
		self.assertEqual(NewMovimiento.objects.get(pk=abono.pk).pago_id, pago.pk)


class ComprobantesAnuladosMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0015_trazabilidad_correccion_pagos")]
	migrate_to = [("finanzas", "0016_backfill_comprobantes_anulados")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_marca_anulados_y_vincula_el_reemplazo_desde_la_observacion(self):
		old_apps = self.migrate(self.migrate_from)
		Pago = old_apps.get_model("finanzas", "Pago")
		Comprobante = old_apps.get_model("finanzas", "Comprobante")
		nuevo = Pago.objects.create(fecha=date(2026, 9, 2))
		original = Pago.objects.create(
			fecha=date(2026, 9, 1),
			estado_pago="Anulado",
			observacion=f"Anulado. Sustituido por pago #{nuevo.pk}. Motivo: Monto mal cargado",
		)
		comprobante_nuevo = Comprobante.objects.create(pago=nuevo, fecha_emision=date(2026, 9, 2), numero=2, monto_total=Decimal("90.00"))
		comprobante_original = Comprobante.objects.create(pago=original, fecha_emision=date(2026, 9, 1), numero=1, monto_total=Decimal("100.00"))

		new_apps = self.migrate(self.migrate_to)
		NewComprobante = new_apps.get_model("finanzas", "Comprobante")
		NewPago = new_apps.get_model("finanzas", "Pago")

		comprobante_original = NewComprobante.objects.get(pk=comprobante_original.pk)
		comprobante_nuevo = NewComprobante.objects.get(pk=comprobante_nuevo.pk)
		self.assertEqual(comprobante_original.estado, "Anulado")
		self.assertEqual(comprobante_original.reemplazado_por_id, comprobante_nuevo.pk)
		self.assertEqual(comprobante_nuevo.estado, "Vigente")
		self.assertEqual(NewPago.objects.get(pk=original.pk).motivo_anulacion, "Monto mal cargado")


class DetalleImputacionMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0021_detalle_imputacion")]
	migrate_to = [("finanzas", "0022_backfill_detalle_imputacion")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_genera_el_desglose_de_imputaciones_existentes(self):
		old_apps = self.migrate(self.migrate_from)
		OldCuota = old_apps.get_model("finanzas", "Cuota")
		OldItemCuota = old_apps.get_model("finanzas", "ItemCuota")
		OldPago = old_apps.get_model("finanzas", "Pago")
		OldMovimiento = old_apps.get_model("finanzas", "MovimientoCuenta")
		OldImputacion = old_apps.get_model("finanzas", "Imputacion")

		cuenta_id = historical_account_id(old_apps, "91234567")
		cuota = OldCuota.objects.create(fecha_venc1=date(2026, 10, 10), fecha_venc2=date(2026, 10, 20), periodo="2026-10")
		for concepto, monto in (("CuotaSocial", "1000.00"), ("CuotaDeportiva", "1500.00"), ("Mora", "200.00")):
			OldItemCuota.objects.create(cuota=cuota, concepto=concepto, fecha_aplicacion=date(2026, 10, 1), monto=Decimal(monto))
		cargo = OldMovimiento.objects.create(cuenta_corriente_id=cuenta_id, cuota=cuota, tipo_movimiento="Cargo", fecha="2026-10-01T12:00:00Z", monto=Decimal("2700.00"))
		imputaciones = []
		for dia, monto in ((5, "400.00"), (6, "1000.00")):
			pago = OldPago.objects.create(fecha=date(2026, 10, dia))
			abono = OldMovimiento.objects.create(cuenta_corriente_id=cuenta_id, pago=pago, tipo_movimiento="Abono", fecha=f"2026-10-0{dia}T12:00:00Z", monto=Decimal(monto))
			imputaciones.append(OldImputacion.objects.create(movimiento_origen=abono, movimiento_destino=cargo, fecha=f"2026-10-0{dia}T12:00:00Z", monto_aplicado=Decimal(monto)))

		new_apps = self.migrate(self.migrate_to)
		NewDetalle = new_apps.get_model("finanzas", "DetalleImputacion")

		def detalle(imputacion):
			return sorted(NewDetalle.objects.filter(imputacion_id=imputacion.pk).values_list("concepto", "monto"))

		self.assertEqual(detalle(imputaciones[0]), [("CuotaSocial", Decimal("200.00")), ("Mora", Decimal("200.00"))])
		self.assertEqual(detalle(imputaciones[1]), [("CuotaDeportiva", Decimal("200.00")), ("CuotaSocial", Decimal("800.00"))])


class PagoFechaHoraMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0022_backfill_detalle_imputacion")]
	migrate_to = [("finanzas", "0023_pago_fecha_hora")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_conserva_la_fecha_y_toma_la_hora_del_movimiento(self):
		old_apps = self.migrate(self.migrate_from)
		OldPago = old_apps.get_model("finanzas", "Pago")
		OldMovimiento = old_apps.get_model("finanzas", "MovimientoCuenta")

		cuenta_id = historical_account_id(old_apps, "92345678")
		con_movimiento = OldPago.objects.create(fecha=date(2026, 10, 5))
		OldMovimiento.objects.create(cuenta_corriente_id=cuenta_id, pago=con_movimiento, tipo_movimiento="Abono", fecha="2026-10-05T14:30:00Z", monto=Decimal("100.00"))
		sin_movimiento = OldPago.objects.create(fecha=date(2026, 10, 6))

		new_apps = self.migrate(self.migrate_to)
		NewPago = new_apps.get_model("finanzas", "Pago")

		self.assertEqual(
			NewPago.objects.get(pk=con_movimiento.pk).fecha,
			datetime(2026, 10, 5, 14, 30, tzinfo=dt_timezone.utc),
		)
		self.assertEqual(
			NewPago.objects.get(pk=sin_movimiento.pk).fecha,
			timezone.make_aware(datetime(2026, 10, 6)),
		)


class RefreshSettledCuotasMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0024_remove_itemcuota_beca")]
	migrate_to = [("finanzas", "0025_refresh_settled_cuotas")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_marks_only_settled_cuotas_as_paid(self):
		old_apps = self.migrate(self.migrate_from)
		OldCuota = old_apps.get_model("finanzas", "Cuota")
		OldPago = old_apps.get_model("finanzas", "Pago")
		OldMovimiento = old_apps.get_model("finanzas", "MovimientoCuenta")
		OldImputacion = old_apps.get_model("finanzas", "Imputacion")

		account_id = historical_account_id(old_apps, "93456789")

		def cuota_with_charge(period, amount):
			cuota = OldCuota.objects.create(estado_cuota="Vencida", fecha_venc1=date(2026, 9, 10), fecha_venc2=date(2026, 9, 20), periodo=period)
			charge = OldMovimiento.objects.create(cuenta_corriente_id=account_id, cuota=cuota, tipo_movimiento="Cargo", fecha="2026-09-01T12:00:00Z", monto=Decimal(amount))
			return cuota, charge

		def pay(charge, amount):
			payment = OldPago.objects.create(fecha=timezone.now())
			credit = OldMovimiento.objects.create(cuenta_corriente_id=account_id, pago=payment, tipo_movimiento="Abono", fecha="2026-09-05T12:00:00Z", monto=Decimal(amount))
			OldImputacion.objects.create(movimiento_origen=credit, movimiento_destino=charge, fecha="2026-09-05T12:00:00Z", monto_aplicado=Decimal(amount))
			return credit

		zero_net, _ = cuota_with_charge("2026-06", "0.00")
		partially_paid, charge = cuota_with_charge("2026-07", "1000.00")
		pay(charge, "400.00")
		reverted, charge = cuota_with_charge("2026-08", "500.00")
		credit = pay(charge, "500.00")
		OldMovimiento.objects.create(cuenta_corriente_id=account_id, movimiento_revertido=credit, tipo_movimiento="Cargo", fecha="2026-09-06T12:00:00Z", monto=Decimal("500.00"))

		new_apps = self.migrate(self.migrate_to)
		NewCuota = new_apps.get_model("finanzas", "Cuota")

		self.assertEqual(NewCuota.objects.get(pk=zero_net.pk).estado_cuota, "Paga")
		self.assertEqual(NewCuota.objects.get(pk=partially_paid.pk).estado_cuota, "Vencida")
		self.assertEqual(NewCuota.objects.get(pk=reverted.pk).estado_cuota, "Vencida")


class CurrentAccountOpeningTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="administrativo"))
		self.genero = Genero.objects.create(nombre="Masculino")
		self.localidad = Localidad.objects.create(nombre="Berisso")

	def person_payload(self, dni, birth_date="1990-05-10"):
		return {
			"nombre": "Juan",
			"apellido": "Perez",
			"dni": dni,
			"telefono": "221555000",
			"email": f"{dni}@example.com",
			"fecha_nacimiento": birth_date,
			"genero": self.genero.pk,
			"domicilio_calle": "Calle 7",
			"domicilio_numero": "1234",
			"domicilio_localidad": self.localidad.pk,
		}

	def test_new_socio_gets_a_current_account_and_first_monthly_cuota(self):
		with self.captureOnCommitCallbacks(execute=True):
			response = self.client.post("/api/padron/socio/", self.person_payload("40111222"), format="json")

		self.assertEqual(response.status_code, 201, response.data)
		account = CuentaCorriente.objects.get(socio_id=response.data["socio_id"])
		cuotas = list(Cuota.objects.filter(movimiento__cuenta_corriente=account).order_by("periodo"))
		self.assertEqual(
			[cuota.periodo for cuota in cuotas],
			[
				timezone.localdate().strftime("%Y-%m"),
				next_period_start(1).strftime("%Y-%m"),
				next_period_start(2).strftime("%Y-%m"),
			],
		)
		self.assertEqual(account.estado_cuenta_corriente, "Activo")

		status_response = self.client.get(reverse("estado-cuenta-socio", args=[response.data["socio_id"]]))

		self.assertEqual(status_response.status_code, 200)
		self.assertEqual(status_response.data["cuotas_generadas"], 3)
		self.assertEqual(status_response.data["cuotas_impagas"], 1)
		self.assertEqual(status_response.data["total_adeudado"], cuotas[0].movimiento.monto)

	def test_new_player_with_new_socio_gets_a_current_account(self):
		categoria = Categoria.objects.create(nombre="Infantil", anio_vigente=2026, edad_maxima=12, genero="M")
		payload = {
			"nuevo_socio": self.person_payload("40111223", birth_date="2015-03-01"),
			"categoria": categoria.categoria_id,
			"obra_social": "OSDE",
			"tallaIndumentaria": "M",
			"vinculos_familiares": [{
				"persona": {"dni": "20111222", "nombre": "Ana", "apellido": "Perez", "telefono": "221555"},
				"relacion": "Madre",
				"responsable_legal": True,
			}],
		}

		with self.captureOnCommitCallbacks(execute=True):
			response = self.client.post("/api/padron/jugador/", payload, format="json")

		self.assertEqual(response.status_code, 201, response.data)
		account = CuentaCorriente.objects.get(socio__persona__dni="40111223")
		cuotas = list(Cuota.objects.filter(movimiento__cuenta_corriente=account).order_by("periodo"))
		self.assertEqual(len(cuotas), 3)
		for cuota in cuotas:
			conceptos = set(cuota.items.values_list("concepto", flat=True))
			self.assertEqual(conceptos, {"CuotaSocial", "CuotaDeportiva"})

	def create_player_for_existing_socio(self, socio):
		categoria = Categoria.objects.create(
			nombre=f"Infantil {socio.pk}",
			anio_vigente=2026,
			edad_maxima=12,
			genero="M",
		)
		return self.client.post(
			"/api/padron/jugador/",
			{
				"socio": socio.pk,
				"categoria": categoria.pk,
				"obra_social": "OSDE",
				"tallaIndumentaria": "M",
				"vinculos_familiares": [{
					"persona": {"dni": f"20{socio.persona.dni[-6:]}", "nombre": "Ana", "apellido": "Perez", "telefono": "221555"},
					"relacion": "Madre",
					"responsable_legal": True,
				}],
			},
			format="json",
		)

	def test_new_player_for_existing_socio_gets_current_cuota_when_missing(self):
		persona = Persona.objects.create(
			nombre="Juan",
			apellido="Perez",
			dni="40111226",
			fecha_nacimiento=date(2015, 3, 1),
		)
		socio = Socio.objects.create(persona=persona)

		with self.captureOnCommitCallbacks(execute=True):
			response = self.create_player_for_existing_socio(socio)

		self.assertEqual(response.status_code, 201, response.data)
		account = CuentaCorriente.objects.get(socio=socio)
		cuotas = list(Cuota.objects.filter(movimiento__cuenta_corriente=account).order_by("periodo"))
		self.assertEqual(len(cuotas), 3)
		for cuota in cuotas:
			self.assertEqual(cuota.items.filter(concepto="CuotaDeportiva").count(), 1)
			self.assertEqual(cuota.movimiento.monto, Decimal("2500.00"))

	def test_new_player_adds_sports_charge_to_existing_unpaid_current_cuota(self):
		persona = Persona.objects.create(
			nombre="Juan",
			apellido="Perez",
			dni="40111227",
			fecha_nacimiento=date(2015, 3, 1),
		)
		socio = Socio.objects.create(persona=persona)
		today = timezone.localdate()
		cuota = create_cuota(socio, today.strftime("%Y-%m"), today=today.replace(day=1))

		with self.captureOnCommitCallbacks(execute=True):
			response = self.create_player_for_existing_socio(socio)

		self.assertEqual(response.status_code, 201, response.data)
		cuota.refresh_from_db()
		account = CuentaCorriente.objects.get(socio=socio)
		self.assertEqual(Cuota.objects.filter(movimiento__cuenta_corriente=account).count(), 3)
		self.assertEqual(cuota.items.filter(concepto="CuotaDeportiva").count(), 1)
		self.assertEqual(cuota.movimiento.monto, Decimal("2500.00"))

	def test_new_player_does_not_change_paid_current_cuota(self):
		persona = Persona.objects.create(
			nombre="Juan",
			apellido="Perez",
			dni="40111228",
			fecha_nacimiento=date(2015, 3, 1),
		)
		socio = Socio.objects.create(persona=persona)
		today = timezone.localdate()
		cuota = create_cuota(socio, today.strftime("%Y-%m"), today=today.replace(day=1))
		cuota.estado_cuota = EstadoCuotaChoices.PAGA
		cuota.save(update_fields=["estado_cuota"])

		with self.captureOnCommitCallbacks(execute=True):
			response = self.create_player_for_existing_socio(socio)

		self.assertEqual(response.status_code, 201, response.data)
		cuota.refresh_from_db()
		self.assertFalse(cuota.items.filter(concepto="CuotaDeportiva").exists())
		self.assertEqual(cuota.movimiento.monto, Decimal("1000.00"))

	def test_saving_an_existing_socio_does_not_open_another_account(self):
		socio = crear_socio("40111224")

		socio.save()
		socio.deactivate()

		self.assertEqual(CuentaCorriente.objects.filter(socio=socio).count(), 1)

	def test_accounts_cannot_be_created_manually(self):
		socio = crear_socio("40111225")

		response = self.client.post(reverse("cuenta-corriente-list"), {"socio": socio.pk}, format="json")

		self.assertEqual(response.status_code, 405)


class OpenMissingCurrentAccountsMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0025_refresh_settled_cuotas")]
	migrate_to = [("finanzas", "0026_open_missing_current_accounts")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_opens_an_account_only_for_socios_without_one(self):
		old_apps = self.migrate(self.migrate_from)
		OldPersona = old_apps.get_model("padron", "Persona")
		OldSocio = old_apps.get_model("padron", "Socio")
		OldCuentaCorriente = old_apps.get_model("finanzas", "CuentaCorriente")

		without_account = OldSocio.objects.create(persona=OldPersona.objects.create(nombre="Sin", apellido="Cuenta", dni="94567890"), numero_socio=1)
		with_account = OldSocio.objects.create(persona=OldPersona.objects.create(nombre="Con", apellido="Cuenta", dni="94567891"), numero_socio=2)
		existing = OldCuentaCorriente.objects.create(socio=with_account, saldo=Decimal("-500.00"))

		new_apps = self.migrate(self.migrate_to)
		NewCuentaCorriente = new_apps.get_model("finanzas", "CuentaCorriente")

		self.assertEqual(NewCuentaCorriente.objects.get(socio_id=without_account.pk).saldo, Decimal("0.00"))
		self.assertEqual(NewCuentaCorriente.objects.filter(socio_id=with_account.pk).count(), 1)
		self.assertEqual(NewCuentaCorriente.objects.get(socio_id=with_account.pk).pk, existing.pk)
		self.assertEqual(NewCuentaCorriente.objects.get(pk=existing.pk).saldo, Decimal("-500.00"))


class CurrentAccountStateTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="administrativo"))
		self.socio = crear_socio("40111230")

	def account_state(self):
		return CuentaCorriente.objects.get(socio=self.socio).estado_cuenta_corriente

	def test_inactive_socio_opens_an_inactive_account(self):
		socio = crear_socio("40111231", socio_inactivo=True)
		inactive_socio = Socio.objects.create(
			persona=Persona.objects.create(nombre="Baja", apellido="Directa", dni="40111232"),
			estado_administrativo=socio.estado_administrativo,
		)

		self.assertEqual(CuentaCorriente.objects.get(socio=inactive_socio).estado_cuenta_corriente, "Inactivo")

	def test_account_follows_socio_deactivation_and_reactivation(self):
		self.assertEqual(self.account_state(), "Activo")

		response = self.client.delete(f"/api/padron/socio/{self.socio.pk}/")

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(self.account_state(), "Inactivo")

		active_state = EstadoAdministrativo.objects.get_or_create(nombre="Activo")[0]
		response = self.client.patch(f"/api/padron/socio/{self.socio.pk}/", {"estado_administrativo": active_state.pk}, format="json")

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(self.account_state(), "Activo")

	def test_account_follows_model_methods(self):
		self.socio.deactivate()

		self.assertEqual(self.account_state(), "Inactivo")

		self.socio.activate()

		self.assertEqual(self.account_state(), "Activo")


class SyncCurrentAccountStatesMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0027_concepto_item_labels")]
	migrate_to = [("finanzas", "0028_sync_current_account_states")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_aligns_account_states_with_socio_states(self):
		old_apps = self.migrate(self.migrate_from)
		OldPersona = old_apps.get_model("padron", "Persona")
		OldSocio = old_apps.get_model("padron", "Socio")
		OldEstado = old_apps.get_model("padron", "EstadoAdministrativo")
		OldCuentaCorriente = old_apps.get_model("finanzas", "CuentaCorriente")

		active = OldEstado.objects.get_or_create(nombre="Activo")[0]
		inactive = OldEstado.objects.get_or_create(nombre="Inactivo")[0]

		def account(dni, number, state, account_state):
			socio = OldSocio.objects.create(persona=OldPersona.objects.create(nombre="Socio", apellido="Prueba", dni=dni), numero_socio=number, estado_administrativo=state)
			return OldCuentaCorriente.objects.create(socio=socio, estado_cuenta_corriente=account_state)

		stale_inactive = account("95678901", 1, inactive, "Activo")
		stale_active = account("95678902", 2, active, "Inactivo")
		aligned = account("95678903", 3, active, "Activo")

		new_apps = self.migrate(self.migrate_to)
		NewCuentaCorriente = new_apps.get_model("finanzas", "CuentaCorriente")

		self.assertEqual(NewCuentaCorriente.objects.get(pk=stale_inactive.pk).estado_cuenta_corriente, "Inactivo")
		self.assertEqual(NewCuentaCorriente.objects.get(pk=stale_active.pk).estado_cuenta_corriente, "Activo")
		self.assertEqual(NewCuentaCorriente.objects.get(pk=aligned.pk).estado_cuenta_corriente, "Activo")


class CuotaEstadoVencimientosMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0029_beca_concepto_optional")]
	migrate_to = [("finanzas", "0030_cuota_estado_vencimientos")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_separa_las_vencidas_segun_el_segundo_vencimiento_y_se_puede_revertir(self):
		Cuota = self.migrate(self.migrate_from).get_model("finanzas", "Cuota")
		today = timezone.localdate()

		def cuota(state, second_due_days):
			return Cuota.objects.create(
				estado_cuota=state,
				fecha_venc1=today + timedelta(days=second_due_days - 10),
				fecha_venc2=today + timedelta(days=second_due_days),
				periodo="2026-09",
			).pk

		second_due_passed = cuota("Vencida", -1)
		second_due_today = cuota("Vencida", 0)
		second_due_ahead = cuota("Vencida", 5)
		up_to_date = cuota("EnFecha", 15)
		paid = cuota("Paga", -1)

		Cuota = self.migrate(self.migrate_to).get_model("finanzas", "Cuota")
		states = dict(Cuota.objects.values_list("pk", "estado_cuota"))
		self.assertEqual(states[second_due_passed], "Vencida2")
		self.assertEqual(states[second_due_today], "Vencida1")
		self.assertEqual(states[second_due_ahead], "Vencida1")
		self.assertEqual(states[up_to_date], "EnFecha")
		self.assertEqual(states[paid], "Paga")

		Cuota = self.migrate(self.migrate_from).get_model("finanzas", "Cuota")
		states = dict(Cuota.objects.values_list("pk", "estado_cuota"))
		self.assertEqual(states[second_due_passed], "Vencida")
		self.assertEqual(states[second_due_ahead], "Vencida")
		self.assertEqual(states[paid], "Paga")


class ScholarshipLifecycleTests(APITestCase):
	def setUp(self):
		self.user = get_user_model().objects.create_user(username="tesorero")
		self.client.force_authenticate(user=self.user)
		self.socio = crear_socio("60000050", con_jugador=True)
		self.july, self.august, self.september = (self.generate(period) for period in ("2026-07", "2026-08", "2026-09"))
		response = self.client.post(reverse("socio-beca", args=[self.socio.pk]), {
			"modalidad": "Porcentaje",
			"valor": "10",
			"fecha_aplicacion": "2026-07-01",
			"motivo": "Situación económica",
			"autorizado_por": "Comisión directiva",
		}, format="json")
		self.assertEqual(response.status_code, 201, response.data)
		self.scholarship = Beca.objects.get()

	def generate(self, period):
		response = self.client.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": period}, format="json")
		return Cuota.objects.get(pk=response.data["cuota_id"])

	def scholarship_amounts(self, cuota):
		return list(cuota.items.filter(concepto="Beca").values_list("monto", flat=True))

	def charge(self, cuota):
		return MovimientoCuenta.objects.get(cuota=cuota).monto

	def cancel(self, **data):
		values = {"motivo": "Dejó de cumplir los requisitos", "autorizado_por": "Comisión directiva"}
		values.update(data)
		return self.client.post(reverse("beca-cancelar", args=[self.scholarship.pk]), values, format="json")

	def update(self, **data):
		values = {
			"modalidad": "Porcentaje",
			"valor": "20",
			"fecha_aplicacion": "2026-07-01",
			"fecha_fin": None,
			"motivo": "Situación económica",
			"autorizado_por": "Comisión directiva",
		}
		values.update(data)
		return self.client.put(reverse("beca-detail", args=[self.scholarship.pk]), values, format="json")

	def pay(self, cuota):
		amount = str(self.charge(cuota))
		response = self.client.post(reverse("registrar-pago"), {
			"socio_id": self.socio.pk,
			"cuota_ids": [cuota.pk],
			"monto_total": amount,
			"medios": [{"medio_de_pago": "Efectivo", "monto": amount}],
		}, format="json")
		self.assertEqual(response.status_code, 201, response.data)

	def test_cancel_removes_the_scholarship_from_unpaid_cuotas_and_keeps_the_history(self):
		response = self.cancel()

		self.assertEqual(response.status_code, 200, response.data)
		self.scholarship.refresh_from_db()
		self.assertEqual(self.scholarship.estado, EstadoBecaChoices.CANCELADA)
		self.assertEqual(self.scholarship.motivo_cancelacion, "Dejó de cumplir los requisitos")
		self.assertEqual(self.scholarship.cancelado_por, "Comisión directiva")
		self.assertEqual(self.scholarship.usuario_cancelacion, self.user)
		for cuota in (self.july, self.august, self.september):
			self.assertEqual(self.scholarship_amounts(cuota), [])
			self.assertEqual(self.charge(cuota), Decimal("2500.00"))
			annulled = ItemCuota.all_objects.get(cuota=cuota, concepto="Beca")
			self.assertEqual(annulled.estado, EstadoItemCuotaChoices.ANULADO)
			self.assertTrue(annulled.motivo_anulacion.startswith("Beca cancelada"))

	def test_cancel_leaves_paid_cuotas_untouched(self):
		self.pay(self.july)

		self.cancel()

		self.assertEqual(self.scholarship_amounts(self.july), [Decimal("250.00")])
		self.assertEqual(self.scholarship_amounts(self.august), [])

	def cover_everything(self):
		self.assertEqual(self.update(valor="100").status_code, 200)
		october = self.generate("2026-10")
		self.assertEqual(october.estado_cuota, EstadoCuotaChoices.PAGA)
		return october

	def test_cancel_keeps_past_cuotas_settled_by_the_scholarship(self):
		october = self.cover_everything()

		cancel_scholarship(self.scholarship.pk, "Dejó el club", "Comisión directiva", self.user, today=date(2026, 10, 15))

		self.september.refresh_from_db()
		october.refresh_from_db()
		self.assertEqual(self.scholarship_amounts(self.september), [Decimal("2500.00")])
		self.assertEqual(self.september.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(self.scholarship_amounts(october), [])
		self.assertEqual(self.charge(october), Decimal("2500.00"))
		self.assertNotEqual(october.estado_cuota, EstadoCuotaChoices.PAGA)

	def test_update_recalculates_settled_cuotas_only_from_the_current_period(self):
		october = self.cover_everything()

		update_scholarship(
			self.scholarship.pk, "Porcentaje", Decimal("50"), date(2026, 7, 1), None, "Situación económica",
			"Comisión directiva", self.user, today=date(2026, 10, 15),
		)

		self.assertEqual(self.scholarship_amounts(self.september), [Decimal("2500.00")])
		self.assertEqual(self.scholarship_amounts(october), [Decimal("1250.00")])
		self.assertEqual(self.charge(october), Decimal("1250.00"))

	def test_the_latest_cuota_settled_by_a_cancelled_scholarship_can_be_reverted(self):
		self.cover_everything()
		cancel_scholarship(self.scholarship.pk, "Dejó el club", "Comisión directiva", self.user, today=date(2026, 10, 15))

		response = self.client.post(reverse("cuota-revertir-saldo", args=[self.september.pk]), {
			"motivo": "Se olvidó cancelar la beca", "responsable": "Tesorería",
		}, format="json")

		self.assertEqual(response.status_code, 200, response.data)
		self.september.refresh_from_db()
		self.assertEqual(self.scholarship_amounts(self.september), [])
		self.assertNotEqual(self.september.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertTrue(ExclusionBeca.objects.filter(beca=self.scholarship, periodo="2026-09").exists())
		self.assertEqual(self.scholarship_amounts(self.august), [Decimal("2500.00")])

	def test_cancelled_scholarship_is_not_applied_to_new_cuotas(self):
		self.cancel()

		october = self.generate("2026-10")

		self.assertEqual(self.scholarship_amounts(october), [])

	def test_only_applied_scholarships_can_be_cancelled_or_updated(self):
		self.cancel()

		self.assertEqual(self.cancel().status_code, 400)
		self.assertEqual(self.update().status_code, 400)

	def test_cancel_requires_reason_and_authorizer(self):
		for field in ("motivo", "autorizado_por"):
			with self.subTest(field=field):
				response = self.cancel(**{field: ""})
				self.assertEqual(response.status_code, 400)
				self.assertIn(field, response.data)
		self.scholarship.refresh_from_db()
		self.assertEqual(self.scholarship.estado, EstadoBecaChoices.APLICADA)

	def test_update_recalculates_unpaid_cuotas(self):
		response = self.update()

		self.assertEqual(response.status_code, 200, response.data)
		for cuota in (self.july, self.august, self.september):
			self.assertEqual(self.scholarship_amounts(cuota), [Decimal("500.00")])
			self.assertEqual(self.charge(cuota), Decimal("2000.00"))
		previous = ItemCuota.all_objects.get(cuota=self.july, concepto="Beca", estado=EstadoItemCuotaChoices.ANULADO)
		self.assertEqual(previous.monto, Decimal("250.00"))
		self.assertEqual(previous.motivo_anulacion, "Beca modificada")

	def test_update_without_changes_keeps_the_items(self):
		before = list(ItemCuota.all_objects.filter(concepto="Beca").values_list("pk", flat=True))

		self.update(valor="10")

		self.assertEqual(list(ItemCuota.all_objects.filter(concepto="Beca").values_list("pk", flat=True)), before)

	def test_update_with_a_past_end_date_finishes_the_scholarship(self):
		response = self.update(fecha_fin="2026-08-31")

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["estado"], EstadoBecaChoices.FINALIZADA)
		self.assertEqual(self.scholarship_amounts(self.august), [Decimal("500.00")])
		self.assertEqual(self.scholarship_amounts(self.september), [])

	def test_removing_the_scholarship_from_one_cuota_excludes_only_that_period(self):
		item = self.august.items.get(concepto="Beca")

		response = self.client.post(reverse("item-cuota-anular", args=[item.pk]), {
			"motivo": "No asistió en agosto",
			"autorizado_por": "Tesorería",
		}, format="json")

		self.assertEqual(response.status_code, 200, response.data)
		exclusion = ExclusionBeca.objects.get()
		self.assertEqual((exclusion.beca, exclusion.periodo, exclusion.usuario), (self.scholarship, "2026-08", self.user))
		self.assertEqual(self.scholarship_amounts(self.august), [])
		self.assertEqual(self.charge(self.august), Decimal("2500.00"))

		self.update()

		self.assertEqual(self.scholarship_amounts(self.july), [Decimal("500.00")])
		self.assertEqual(self.scholarship_amounts(self.august), [])
		self.assertEqual(self.scholarship_amounts(self.september), [Decimal("500.00")])
		listed = self.client.get(reverse("beca-list"), {"socio_id": self.socio.pk}).data[0]
		self.assertEqual([row["periodo"] for row in listed["exclusiones"]], ["2026-08"])

	def test_excluded_period_is_skipped_when_the_cuota_is_generated(self):
		ExclusionBeca.objects.create(beca=self.scholarship, periodo="2026-10", motivo="Viaje", autorizado_por="Tesorería")

		october = self.generate("2026-10")

		self.assertEqual(self.scholarship_amounts(october), [])

	def test_scholarship_items_keep_the_scholarship_that_created_them(self):
		october = self.generate("2026-10")

		self.assertEqual(october.items.get(concepto="Beca").beca, self.scholarship)
		self.assertEqual(self.july.items.get(concepto="Beca").beca, self.scholarship)

	def test_expired_scholarships_are_finished(self):
		other = Beca.objects.create(
			socio=self.socio,
			monto=Decimal("100.00"),
			fecha_aplicacion=date(2026, 1, 1),
			fecha_fin=date(2026, 3, 31),
			motivo="Temporada",
		)

		result = finish_expired_scholarships(today=date(2026, 4, 1))

		self.assertEqual(result["becas_finalizadas"], 1)
		other.refresh_from_db()
		self.scholarship.refresh_from_db()
		self.assertEqual(other.estado, EstadoBecaChoices.FINALIZADA)
		self.assertEqual(self.scholarship.estado, EstadoBecaChoices.APLICADA)


class CuotaItemAnnulmentTests(APITestCase):
	def setUp(self):
		self.user = get_user_model().objects.create_user(username="tesorero")
		self.client.force_authenticate(user=self.user)
		self.socio = crear_socio("60000060", con_jugador=True)
		response = self.client.post(reverse("cuota-list"), {"socio_id": self.socio.pk, "periodo": "2026-10"}, format="json")
		self.cuota = Cuota.objects.get(pk=response.data["cuota_id"])

	def annul(self, item, **data):
		values = {"motivo": "Error de carga", "autorizado_por": "Tesorería"}
		values.update(data)
		return self.client.post(reverse("item-cuota-anular", args=[item.pk]), values, format="json")

	def add_item(self, concept, amount, is_discount=False, due_number=None):
		item = ItemCuota.objects.create(
			cuota=self.cuota,
			concepto=concept,
			es_descuento=is_discount,
			fecha_aplicacion=date(2026, 10, 11),
			monto=Decimal(amount),
			vencimiento=due_number,
		)
		sync_cuota_charge(self.cuota)
		return item

	def pay(self, amount):
		response = self.client.post(reverse("registrar-pago"), {
			"socio_id": self.socio.pk,
			"cuota_ids": [self.cuota.pk],
			"monto_total": amount,
			"medios": [{"medio_de_pago": "Efectivo", "monto": amount}],
		}, format="json")
		self.assertEqual(response.status_code, 201, response.data)

	def charge(self):
		return MovimientoCuenta.objects.get(cuota=self.cuota).monto

	def account_cuota(self):
		return self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk])).data["cuotas"][0]

	def test_discount_is_annulled_and_kept_for_the_history(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)

		response = self.annul(discount)

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["estado"], EstadoItemCuotaChoices.ANULADO)
		self.assertEqual(self.charge(), Decimal("2500.00"))
		cuota = self.account_cuota()
		self.assertNotIn(discount.pk, [item["item_cuota_id"] for item in cuota["items"]])
		annulled = cuota["items_anulados"][0]
		self.assertEqual(annulled["item_cuota_id"], discount.pk)
		self.assertEqual(annulled["motivo_anulacion"], "Error de carga")
		self.assertEqual(annulled["anulado_por"], "Tesorería")
		self.assertEqual(annulled["usuario_anulacion"], self.user.pk)

	def test_unpaid_late_fee_is_annulled(self):
		fee = self.add_item("Mora", "300.00", due_number=1)

		response = self.annul(fee)

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(self.charge(), Decimal("2500.00"))
		self.assertFalse(self.cuota.items.filter(concepto="Mora").exists())

	def test_late_fee_of_a_partially_paid_cuota_is_waived_for_what_is_left(self):
		fee = self.add_item("Mora", "300.00", due_number=2)
		self.pay("100.00")

		response = self.annul(fee)

		self.assertEqual(response.status_code, 200, response.data)
		waiver = self.cuota.items.get(concepto="CondonacionMora")
		self.assertEqual((waiver.monto, waiver.vencimiento, waiver.autorizado_por), (Decimal("200.00"), 2, "Tesorería"))
		self.assertEqual(Decimal(str(self.account_cuota()["saldo_pendiente"])), Decimal("2500.00"))
		self.assertEqual(self.annul(fee).status_code, 400)

	def test_benefits_cannot_be_removed_from_cuotas_with_payments(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)
		self.pay("100.00")

		response = self.annul(discount)

		self.assertEqual(response.status_code, 400)
		self.assertEqual(self.charge(), Decimal("2000.00"))

	def test_items_of_a_paid_cuota_cannot_be_removed(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)
		self.pay("2000.00")

		self.assertEqual(self.annul(discount).status_code, 400)

	def test_base_charges_cannot_be_removed(self):
		response = self.annul(self.cuota.items.get(concepto="CuotaSocial"))

		self.assertEqual(response.status_code, 400)
		self.assertEqual(self.charge(), Decimal("2500.00"))

	def test_requires_reason_and_authorizer(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)

		for field in ("motivo", "autorizado_por"):
			with self.subTest(field=field):
				response = self.annul(discount, **{field: ""})
				self.assertEqual(response.status_code, 400)
				self.assertIn(field, response.data)
		self.assertEqual(self.charge(), Decimal("2000.00"))

	def test_annulled_item_cannot_be_annulled_again(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)
		self.annul(discount)

		self.assertEqual(self.annul(discount).status_code, 404)

	def edit_discount(self, item, **data):
		values = {"modalidad": "MontoFijo", "valor": "800.00", "motivo": "Hermanos en el club", "autorizado_por": "Tesorería"}
		values.update(data)
		return self.client.put(reverse("item-cuota-descuento", args=[item.pk]), values, format="json")

	def test_editing_a_discount_replaces_it_and_keeps_the_previous_one(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)

		response = self.edit_discount(discount)

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(Decimal(response.data["monto"]), Decimal("800.00"))
		self.assertEqual(self.charge(), Decimal("1700.00"))
		previous = ItemCuota.all_objects.get(pk=discount.pk)
		self.assertEqual((previous.estado, previous.motivo_anulacion), (EstadoItemCuotaChoices.ANULADO, "Descuento modificado"))

	def test_edited_discount_is_validated_against_the_cuota_without_the_previous_one(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)

		too_much = self.edit_discount(discount, valor="2500.01")
		whole = self.edit_discount(discount, valor="2500.00")

		self.assertEqual(too_much.status_code, 400)
		self.assertEqual(whole.status_code, 200, whole.data)
		self.assertEqual(self.charge(), Decimal("0.00"))

	def test_discount_of_a_cuota_with_payments_cannot_be_edited(self):
		discount = self.add_item("DescuentoUnico", "500.00", is_discount=True)
		self.pay("100.00")

		self.assertEqual(self.edit_discount(discount).status_code, 400)
		self.assertEqual(self.charge(), Decimal("2000.00"))

	def test_only_discounts_can_be_edited(self):
		fee = self.add_item("Mora", "300.00", due_number=1)

		self.assertEqual(self.edit_discount(fee).status_code, 404)

	def test_items_describe_their_origin(self):
		self.add_item("Mora", "300.00", due_number=1)
		self.add_item("Mora", "30.00", due_number=2)

		descriptions = [item["descripcion"] for item in self.account_cuota()["items"]]

		self.assertEqual(descriptions, [
			"Cuota Social",
			"Cuota Deportiva",
			"Recargo por 1° vencimiento",
			"Recargo por 2° vencimiento",
		])


class BecaItemsBackfillMigrationTests(TransactionTestCase):
	migrate_from = [("finanzas", "0033_beca_estados_y_anulacion_items")]
	migrate_to = [("finanzas", "0034_backfill_beca_items")]

	def migrate(self, targets):
		executor = MigrationExecutor(connection)
		executor.loader.build_graph()
		executor.migrate(targets)
		return executor.loader.project_state(targets).apps

	def tearDown(self):
		self.migrate(MigrationExecutor(connection).loader.graph.leaf_nodes())

	def test_links_scholarship_items_numbers_surcharges_and_finishes_expired_scholarships(self):
		apps = self.migrate(self.migrate_from)
		Beca = apps.get_model("finanzas", "Beca")
		Cuota = apps.get_model("finanzas", "Cuota")
		ItemCuota = apps.get_model("finanzas", "ItemCuota")
		MovimientoCuenta = apps.get_model("finanzas", "MovimientoCuenta")
		account_id = historical_account_id(apps, "60000070")
		socio_id = apps.get_model("finanzas", "CuentaCorriente").objects.get(pk=account_id).socio_id

		cuota = Cuota.objects.create(fecha_venc1=date(2026, 8, 10), fecha_venc2=date(2026, 8, 20), periodo="2026-08")
		MovimientoCuenta.objects.create(cuenta_corriente_id=account_id, cuota=cuota, tipo_movimiento="Cargo", fecha=timezone.now(), monto=Decimal("900.00"))
		expired = Beca.objects.create(socio_id=socio_id, monto=Decimal("50.00"), fecha_aplicacion=date(2026, 1, 1), fecha_fin=date(2026, 3, 31), motivo="Temporada")
		current = Beca.objects.create(socio_id=socio_id, monto=Decimal("100.00"), fecha_aplicacion=date(2026, 7, 1), motivo="Hermanos")
		scholarship = ItemCuota.objects.create(cuota=cuota, concepto="Beca", es_descuento=True, fecha_aplicacion=date(2026, 8, 1), monto=Decimal("100.00"), motivo="Hermanos")
		first = ItemCuota.objects.create(cuota=cuota, concepto="Mora", fecha_aplicacion=date(2026, 8, 11), monto=Decimal("10.00"), motivo="Recargo por primer vencimiento (10/08/2026)")
		second = ItemCuota.objects.create(cuota=cuota, concepto="Mora", fecha_aplicacion=date(2026, 8, 21), monto=Decimal("5.00"), motivo="Recargo por segundo vencimiento (20/08/2026)")

		apps = self.migrate(self.migrate_to)
		ItemCuota = apps.get_model("finanzas", "ItemCuota")
		Beca = apps.get_model("finanzas", "Beca")

		self.assertEqual(ItemCuota.objects.get(pk=scholarship.pk).beca_id, current.pk)
		self.assertEqual(ItemCuota.objects.get(pk=first.pk).vencimiento, 1)
		self.assertEqual(ItemCuota.objects.get(pk=second.pk).vencimiento, 2)
		self.assertEqual(Beca.objects.get(pk=expired.pk).estado, "Finalizada")
		self.assertEqual(Beca.objects.get(pk=current.pk).estado, "Aplicada")


class EjecucionTareasCuotaTests(APITestCase):
	def setUp(self):
		ConfiguracionFinanciera.objects.update_or_create(pk=1, defaults={"valor_recargo_1": "200.00", "valor_recargo_2": "300.00"})

	def ejecuciones(self, tipo):
		return list(EjecucionTareaCuota.objects.filter(tipo=tipo).order_by("pk"))

	def cuota_impaga(self, dni):
		return crear_cuota_con_cargo(
			account_for(crear_socio(dni)), "2026-10", "1000.00", venc1=date(2026, 10, 10), venc2=date(2026, 10, 20),
		)

	def test_generacion_registra_la_poblacion_y_las_cuotas_creadas(self):
		crear_socio("70000001")
		crear_socio("70000002", con_jugador=True)
		crear_socio("70000003", con_jugador=True, jugador_inactivo=True)
		crear_socio("70000004", socio_inactivo=True)

		run_cuota_generation(today=date(2026, 10, 1))

		[ejecucion] = self.ejecuciones(TipoTareaCuotaChoices.GENERACION)
		self.assertEqual(ejecucion.periodo, "2026-10")
		self.assertTrue(ejecucion.exitosa)
		self.assertEqual(ejecucion.origen, OrigenEjecucionChoices.AUTOMATICA)
		self.assertEqual(
			ejecucion.resumen,
			"En el sistema existen 1 socio, 1 jugador y 1 jugador de baja parcial. Todos con la cuota correctamente generada.",
		)
		self.assertEqual(ejecucion.metricas["cuotas_creadas"], 9)
		self.assertIn("Período 2026-10: 3 cuotas creadas.", ejecucion.registro)
		self.assertIn("Resultado: todos los socios activos tienen la cuota del período.", ejecucion.registro)
		self.assertIsNotNone(ejecucion.fecha_fin)

	def test_generacion_programada_solo_registra_el_dia_de_generacion(self):
		crear_socio("70000011")
		ConfiguracionFinanciera.objects.filter(pk=1).update(dia_generacion=5)

		generate_scheduled_cuotas(today=date(2026, 10, 4))
		self.assertFalse(EjecucionTareaCuota.objects.exists())

		generate_scheduled_cuotas(today=date(2026, 10, 5))
		self.assertEqual(len(self.ejecuciones(TipoTareaCuotaChoices.GENERACION)), 1)

	def test_recargo_se_ejecuta_el_dia_siguiente_a_cada_vencimiento(self):
		cuota = self.cuota_impaga("70000021")

		apply_scheduled_surcharges(date(2026, 10, 10))
		self.assertFalse(EjecucionTareaCuota.objects.exists())

		apply_scheduled_surcharges(date(2026, 10, 11))
		apply_scheduled_surcharges(date(2026, 10, 12))

		[primero] = self.ejecuciones(TipoTareaCuotaChoices.RECARGO_1)
		self.assertEqual(
			primero.resumen,
			"En este mes, existe 1 cuota impaga, se le aplicó correctamente el recargo por primer vencimiento.",
		)
		self.assertIn("cuota 2026-10 — $ 200,00", primero.registro)
		self.assertEqual(cuota.items.filter(concepto="Mora").count(), 1)
		self.assertEqual(self.ejecuciones(TipoTareaCuotaChoices.RECARGO_2), [])

		apply_scheduled_surcharges(date(2026, 10, 21))

		[segundo] = self.ejecuciones(TipoTareaCuotaChoices.RECARGO_2)
		self.assertTrue(segundo.exitosa)
		self.assertIn("segundo vencimiento", segundo.resumen)
		self.assertEqual(cuota.items.filter(concepto="Mora").count(), 2)

	def test_recargos_atrasados_se_registran_en_la_siguiente_ejecucion(self):
		self.cuota_impaga("70000031")
		self.cuota_impaga("70000032")

		apply_scheduled_surcharges(date(2026, 10, 25))

		[primero] = self.ejecuciones(TipoTareaCuotaChoices.RECARGO_1)
		[segundo] = self.ejecuciones(TipoTareaCuotaChoices.RECARGO_2)
		self.assertEqual(primero.metricas["cuotas_impagas"], 2)
		self.assertEqual(segundo.metricas["recargos_aplicados"], 2)
		self.assertIn("existen 2 cuotas impagas", primero.resumen)

	def test_sin_cuotas_impagas_lo_informa(self):
		apply_scheduled_surcharges(date(2026, 10, 11))

		[ejecucion] = self.ejecuciones(TipoTareaCuotaChoices.RECARGO_1)
		self.assertEqual(
			ejecucion.resumen,
			"En este mes no hay cuotas impagas al primer vencimiento; no correspondió aplicar recargos.",
		)

	def test_ejecucion_manual_registra_origen_y_usuario(self):
		usuario = get_user_model().objects.create_user(username="tesorero")
		crear_socio("70000041")

		run_cuota_generation(today=date(2026, 10, 1), origin=OrigenEjecucionChoices.MANUAL, user=usuario)
		run_manual_surcharges(today=date(2026, 10, 11), user=usuario)

		generacion = EjecucionTareaCuota.objects.get(tipo=TipoTareaCuotaChoices.GENERACION)
		recargo = EjecucionTareaCuota.objects.get(tipo=TipoTareaCuotaChoices.RECARGO_1)
		for ejecucion in (generacion, recargo):
			with self.subTest(tipo=ejecucion.tipo):
				self.assertEqual(ejecucion.origen, OrigenEjecucionChoices.MANUAL)
				self.assertEqual(ejecucion.usuario, usuario)
				self.assertIn("Origen: Manual · Usuario: tesorero", ejecucion.registro)

	def test_endpoint_manual_de_generacion_registra_la_ejecucion(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		crear_socio("70000051")

		response = self.client.post(reverse("generar-cuotas-mensuales"))

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(EjecucionTareaCuota.objects.get().origen, OrigenEjecucionChoices.MANUAL)


class PeriodoCuotasTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		self.socio = crear_socio("71000001")
		self.jugador = crear_socio("71000002", con_jugador=True)
		self.baja_parcial = crear_socio("71000003", con_jugador=True, jugador_inactivo=True)
		self.cuotas = {
			socio.pk: create_cuota(socio, "2026-10", today=date(2026, 10, 1))
			for socio in (self.socio, self.jugador, self.baja_parcial)
		}
		response = self.client.post(reverse("registrar-pago"), {
			"socio_id": self.socio.pk,
			"cuota_ids": [self.cuotas[self.socio.pk].pk],
			"monto_total": "1000.00",
			"medios": [{"medio_de_pago": "Efectivo", "monto": "1000.00"}],
		}, format="json")
		self.assertEqual(response.status_code, 201, response.data)

	def get(self, nombre, **params):
		return self.client.get(reverse(nombre), {"periodo": "2026-10", **params})

	def test_indicadores_por_tipo_de_cuota(self):
		response = self.get("cuota-periodo-resumen")

		self.assertEqual(response.status_code, 200, response.data)
		data = response.data
		self.assertEqual(data["period"], "2026-10")
		self.assertIn("2026-10", data["periods"])
		self.assertEqual(data["members"]["generated"], 1)
		self.assertEqual(data["members"]["collected"], Decimal("1000.00"))
		self.assertEqual(data["members"]["unpaid"], 0)
		self.assertEqual(data["players"]["generated"], 2)
		self.assertEqual(data["players"]["billed"], Decimal("3500.00"))
		self.assertEqual(data["players"]["unpaid_amount"], Decimal("3500.00"))
		self.assertEqual(data["players"]["partial_leave"], {"generated": 1, "unpaid": 1})
		self.assertEqual(data["totals"]["billed"], Decimal("4500.00"))
		self.assertEqual(data["totals"]["collection_rate"], Decimal("22.2"))

	def test_period_cuotas_list(self):
		response = self.get("cuota-periodo-cuotas")

		self.assertEqual(response.status_code, 200, response.data)
		filas = {fila["socio_id"]: fila for fila in response.data["results"]}
		self.assertEqual(set(filas), {self.socio.pk, self.jugador.pk, self.baja_parcial.pk})
		self.assertTrue(filas[self.socio.pk]["paid"])
		self.assertEqual(filas[self.socio.pk]["pending"], Decimal("0.00"))
		self.assertIsNone(filas[self.socio.pk]["categoria"])
		self.assertIsNone(filas[self.socio.pk]["categoria_id"])
		self.assertEqual(filas[self.socio.pk]["categoria_genero"], "")
		self.assertFalse(filas[self.jugador.pk]["paid"])
		self.assertEqual(filas[self.jugador.pk]["categoria"], self.jugador.jugador.categoria.nombre)
		self.assertEqual(filas[self.jugador.pk]["categoria_id"], self.jugador.jugador.categoria_id)
		self.assertEqual(filas[self.jugador.pk]["categoria_genero"], self.jugador.jugador.categoria.genero)
		self.assertEqual(filas[self.jugador.pk]["type"], "Jugador")
		self.assertEqual(filas[self.baja_parcial.pk]["type"], "BajaParcial")
		self.assertEqual(filas[self.jugador.pk]["cuota_amount"], Decimal("2500.00"))
		self.assertEqual(filas[self.jugador.pk]["surcharges"], Decimal("0.00"))
		self.assertEqual(filas[self.jugador.pk]["pending"], Decimal("2500.00"))

	def test_fases_segun_la_fecha_y_las_ejecuciones(self):
		fases = {fase["key"]: fase["status"] for fase in period_summary("2026-10", today=date(2026, 10, 5))["phases"]}
		self.assertEqual(fases, {"generation": "done", "first_due": "pending", "second_due": "pending"})

		fases = {fase["key"]: fase["status"] for fase in period_summary("2026-10", today=date(2026, 10, 15))["phases"]}
		self.assertEqual(fases["first_due"], "missed")

		apply_scheduled_surcharges(date(2026, 10, 15))

		fases = {fase["key"]: fase for fase in period_summary("2026-10", today=date(2026, 10, 15))["phases"]}
		self.assertEqual(fases["first_due"]["status"], "done")
		self.assertEqual(fases["first_due"]["run_date"], date(2026, 10, 11))
		self.assertIsNotNone(fases["first_due"]["executed_at"])
		self.assertEqual(fases["first_due"]["applied_count"], 2)
		self.assertEqual(fases["second_due"]["status"], "pending")
		self.assertEqual(fases["second_due"]["applied_count"], 0)

	def test_ejecuciones_del_periodo_y_su_registro(self):
		apply_scheduled_surcharges(date(2026, 10, 15))

		response = self.get("cuota-ejecucion-list")

		self.assertEqual(response.status_code, 200, response.data)
		[ejecucion] = response.data
		self.assertEqual(ejecucion["tipo"], "Recargo1")
		self.assertIn("existen 2 cuotas impagas", ejecucion["resumen"])
		self.assertNotIn("registro", ejecucion)

		detalle = self.client.get(reverse("cuota-ejecucion-detail", args=[ejecucion["ejecucion_id"]]))

		self.assertEqual(detalle.status_code, 200)
		self.assertIn("Verificación del período 2026-10", detalle.data["registro"])
		self.assertEqual(detalle.data["metricas"]["cuotas_impagas"], 2)

	def test_periodo_invalido(self):
		response = self.get("cuota-periodo-resumen", periodo="octubre")

		self.assertEqual(response.status_code, 400)
		self.assertIn("periodo", response.data)


class FinancialAuditTests(PagoTestBase):
	def entries(self, action):
		return RegistroAuditoria.objects.filter(accion=action)

	def test_payment_is_audited_with_session_user_receipt_and_methods(self):
		response = self.pagar([self.agosto], "1000.00")

		self.assertEqual(response.status_code, 201, response.data)
		entry = self.entries(AccionAuditoriaChoices.PAGO_REGISTRADO).get()
		self.assertEqual(entry.usuario.username, "tesorero")
		self.assertEqual(entry.socio, self.socio)
		self.assertEqual(entry.monto, Decimal("1000.00"))
		self.assertEqual(entry.referencia, f"X {Comprobante.objects.get().numero:08d}")
		self.assertEqual(entry.detalle["medios"], [{"medio_de_pago": "Efectivo", "monto": "1000.00"}])

	def test_late_fee_waiver_keeps_the_responsable_chosen_by_hand(self):
		ItemCuota.objects.create(cuota=self.agosto, concepto="Mora", fecha_aplicacion=date(2026, 9, 11), monto=Decimal("200.00"))
		sync_cuota_charge(self.agosto)

		self.pagar([self.agosto], "1000.00", condonacion_mora={
			"cuota_ids": [self.agosto.pk], "autorizado_por": "Presidente", "motivo": "Socio vitalicio",
		})

		entry = self.entries(AccionAuditoriaChoices.CONDONACION_MORA).get()
		self.assertEqual(entry.responsable, "Presidente")
		self.assertEqual(entry.usuario.username, "tesorero")
		self.assertEqual(entry.monto, Decimal("200.00"))

	def test_failed_operations_leave_no_trace(self):
		self.pagar([self.agosto], "5000.00")

		self.assertFalse(RegistroAuditoria.objects.exists())

	def test_automatic_tasks_are_audited_as_system(self):
		socio = crear_socio("49100001")
		RegistroAuditoria.objects.all().delete()

		generar_cuotas_mensuales(date(2026, 10, 1), today=date(2026, 10, 1), meses=1)

		entry = self.entries(AccionAuditoriaChoices.CUOTA_CREADA).get(socio=socio)
		self.assertIsNone(entry.usuario)
		self.assertEqual(entry.referencia, "Cuota 2026-10")

	def test_scholarship_and_discount_changes_are_audited(self):
		grant_scholarship(self.socio.pk, "Porcentaje", Decimal("50"), date(2026, 8, 1), "Hermanos", "Presidente")

		entry = self.entries(AccionAuditoriaChoices.BECA_OTORGADA).get()
		self.assertEqual(entry.responsable, "Presidente")
		self.assertIn("50%", entry.descripcion)

	def test_audit_endpoint_filters_by_socio_and_action(self):
		self.pagar([self.agosto], "1000.00")
		otro = crear_socio("49100002")
		RegistroAuditoria.objects.create(accion=AccionAuditoriaChoices.CUOTA_CREADA, descripcion="Otra", socio=otro)

		response = self.client.get(reverse("registro-auditoria-list"), {"socio_id": self.socio.pk, "accion": "PagoRegistrado"})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["usuario_nombre"], "tesorero")
		self.assertEqual(response.data[0]["socio"]["socio_id"], self.socio.pk)
