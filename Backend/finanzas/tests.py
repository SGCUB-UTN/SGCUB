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
	Beca,
	Comprobante,
	ConfiguracionFinanciera,
	CuentaCorriente,
	Cuota,
	EstadoPagoChoices,
	EstadoCuotaChoices,
	Imputacion,
	ItemCuota,
	ItemPago,
	MedioDePagoChoices,
	MovimientoCuenta,
	Pago,
	SecuenciaComprobante,
)
from .pdf_utils import format_amount
from .services import apply_surcharges, cuota_state, generar_cuotas_mensuales, next_receipt_number, sync_cuota_charge
from .views import _build_financial_report


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


def account_for(socio, balance=None):
	account = CuentaCorriente.objects.get(socio=socio)
	if balance is not None:
		account.saldo = balance
		account.save(update_fields=["saldo"])
	return account


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


class ConfiguracionFinancieraTests(APITestCase):
	def setUp(self):
		self.usuario = get_user_model().objects.create_user(username="tesorero")
		self.client.force_authenticate(user=self.usuario)

	def actualizar(self, **datos):
		return self.client.patch(reverse("configuracion-financiera"), datos, format="json")

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

		generar_cuotas_mensuales(date(2026, 11, 1), today=date(2026, 11, 1))

		cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio)
		self.assertEqual(cuota.fecha_venc1, date(2026, 11, 5))
		self.assertEqual(cuota.fecha_venc2, date(2026, 11, 15))
		self.assertEqual(cuota.movimiento.monto, Decimal("3000.00"))

	def test_registra_quien_actualizo(self):
		self.actualizar(valor_recargo_1="150.00")

		configuracion = ConfiguracionFinanciera.load()
		self.assertEqual(configuracion.usuario_actualizacion, self.usuario)
		self.assertEqual(configuracion.valor_recargo_1, Decimal("150.00"))

	def test_validaciones(self):
		casos = [
			({"dia_vencimiento_1": 20, "dia_vencimiento_2": 10}, "dia_vencimiento_2"),
			({"dia_vencimiento_1": 0}, "dia_vencimiento_1"),
			({"dia_vencimiento_2": 32}, "dia_vencimiento_2"),
			({"monto_cuota_social": "0.00"}, "monto_cuota_social"),
			({"valor_recargo_1": "-1.00"}, "valor_recargo_1"),
			({"tipo_recargo_2": "Porcentaje", "valor_recargo_2": "120.00"}, "valor_recargo_2"),
			({"tipo_recargo_1": "Otro"}, "tipo_recargo_1"),
		]
		for datos, campo in casos:
			with self.subTest(datos=datos):
				response = self.actualizar(**datos)
				self.assertEqual(response.status_code, 400)
				self.assertIn(campo, response.data)

	def test_calculo_de_recargos_fijo_y_porcentual(self):
		self.actualizar(
			tipo_recargo_1="MontoFijo",
			valor_recargo_1="200.00",
			tipo_recargo_2="Porcentaje",
			valor_recargo_2="10.00",
		)
		configuracion = ConfiguracionFinanciera.load()

		self.assertEqual(configuracion.surcharge(1, Decimal("2500.00")), Decimal("200.00"))
		self.assertEqual(configuracion.surcharge(2, Decimal("2500.00")), Decimal("250.00"))
		self.assertEqual(configuracion.surcharge(2, Decimal("1333.33")), Decimal("133.33"))


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

		self.assertEqual(resultado["cuotas_creadas"], 3)
		self.assertEqual(resultado["items_sociales"], 3)
		self.assertEqual(resultado["items_deportivos"], 1)
		esperados = {
			socio_activo: ["CuotaSocial"],
			jugador_de_baja: ["CuotaSocial"],
			jugador_activo: ["CuotaSocial", "CuotaDeportiva"],
		}
		for socio, conceptos in esperados.items():
			cuota = Cuota.objects.get(movimiento__cuenta_corriente__socio=socio, periodo="2026-10")
			self.assertEqual(sorted(cuota.items.values_list("concepto", flat=True)), sorted(conceptos))
		self.assertFalse(Cuota.objects.filter(movimiento__cuenta_corriente__socio=socio_de_baja).exists())

	def test_jugador_activo_generacion_repetida_no_duplica(self):
		socio = crear_socio("10000011", con_jugador=True)

		primer_resultado = generar_cuotas_mensuales(date(2026, 10, 1), today=date(2026, 10, 1))
		segundo_resultado = generar_cuotas_mensuales(date(2026, 10, 31), today=date(2026, 10, 31))

		cuenta = CuentaCorriente.objects.get(socio=socio)
		cuota = Cuota.objects.get(movimiento__cuenta_corriente=cuenta, periodo="2026-10")
		self.assertEqual(primer_resultado["cuotas_creadas"], 1)
		self.assertEqual(primer_resultado["items_deportivos"], 1)
		self.assertEqual(segundo_resultado["cuotas_creadas"], 0)
		self.assertEqual(segundo_resultado["cuotas_existentes"], 1)
		self.assertEqual(cuenta.cuotas.count(), 1)
		self.assertEqual(cuota.items.count(), 2)
		self.assertEqual(cuota.movimiento.tipo_movimiento, "Cargo")
		self.assertEqual(cuota.movimiento.monto, Decimal("2500.00"))
		self.assertEqual(cuenta.saldo, Decimal("-2500.00"))

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
		self.assertEqual(response.data["cuotas_creadas"], 1)
		self.assertEqual(response.data["items_sociales"], 1)


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
		self.assertEqual(CuentaCorriente.objects.get(socio=self.socio).saldo, Decimal("-2500.00"))

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
		self.assertEqual(CuentaCorriente.objects.get(socio=self.socio).saldo, Decimal("0.00"))

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
		self.assertEqual(CuentaCorriente.objects.get(socio=self.socio).saldo, Decimal("-2000.00"))

		item.delete()
		sync_cuota_charge(cuota)

		self.assertEqual(MovimientoCuenta.objects.get(cuota_id=cuota_id).monto, Decimal("2500.00"))
		self.assertEqual(CuentaCorriente.objects.get(socio=self.socio).saldo, Decimal("-2500.00"))

	def test_estado_de_cuenta_lista_cuotas_por_movimientos(self):
		self.crear()

		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["cuotas_generadas"], 1)
		self.assertEqual(response.data["cuotas"][0]["periodo"], "2026-10")


class CorregirPagoTests(APITestCase):
	def setUp(self):
		self.root = get_user_model().objects.create_user(username="tesorero")
		self.client.force_authenticate(user=self.root)

		persona = Persona.objects.create(nombre="Ana", apellido="Perez", dni="12345678")
		socio = Socio.objects.create(persona=persona)
		self.cuenta = account_for(socio, Decimal("100.00"))
		self.cuota_original = crear_cuota_con_cargo(self.cuenta, "Original", "100.00", EstadoCuotaChoices.PAGA)
		self.cuota_corregida = crear_cuota_con_cargo(self.cuenta, "Corregida", "50.00")

		self.pago_original = Pago.objects.create(
			usuario=self.root,
			estado_pago="Acreditado",
			fecha=timezone.make_aware(datetime(2026, 9, 30, 10, 0)),
		)
		ItemPago.objects.create(
			pago=self.pago_original,
			medio_de_pago="Efectivo",
			monto=Decimal("100.00"),
		)
		self.comprobante_original = Comprobante.objects.create(
			pago=self.pago_original,
			fecha_emision=date(2026, 9, 30),
			numero=next_receipt_number(),
			monto_total=Decimal("100.00"),
		)
		self.movimiento_original = MovimientoCuenta.objects.create(
			cuenta_corriente=self.cuenta,
			pago=self.pago_original,
			tipo_movimiento="Abono",
			fecha="2026-09-30T12:00:00Z",
			monto=Decimal("100.00"),
			concepto="Pago de cuotas",
		)

	def test_crea_reemplazo_anula_original_y_conserva_trazabilidad(self):
		response = self.client.post(
			reverse("corregir-pago", args=[self.pago_original.pk]),
			{
				"motivo": "Se registró un monto incorrecto",
				"cuota_ids": [self.cuota_corregida.pk],
				"monto_total": "50.00",
				"medios": [{"medio_de_pago": "Transferencia", "monto": "50.00"}],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.data)
		self.pago_original.refresh_from_db()
		self.cuenta.refresh_from_db()
		self.assertEqual(self.pago_original.estado_pago, "Anulado")
		self.assertEqual(self.pago_original.motivo_anulacion, "Se registró un monto incorrecto")
		self.comprobante_original.refresh_from_db()
		self.assertEqual(self.comprobante_original.estado, "Anulado")
		self.assertEqual(self.comprobante_original.reemplazado_por_id, response.data["comprobante"]["comprobante_id"])
		self.assertEqual(response.data["usuario"], "tesorero")
		detalle = self.client.get(reverse("comprobante-detail", args=[self.comprobante_original.pk])).data
		self.assertEqual(detalle["estado"], "Anulado")
		self.assertEqual(detalle["reemplazado_por_numero"], response.data["comprobante"]["numero"])
		detalle_nuevo = self.client.get(reverse("comprobante-detail", args=[response.data["comprobante"]["comprobante_id"]])).data
		self.assertEqual(detalle_nuevo["reemplaza_a_numero"], self.comprobante_original.numero)
		self.assertIsNone(detalle_nuevo["reemplazado_por_numero"])
		self.assertEqual(self.cuenta.saldo, Decimal("50.00"))
		self.assertTrue(Comprobante.objects.filter(pk=self.comprobante_original.pk).exists())
		self.assertEqual(response.data["pago"]["usuario"], self.root.pk)
		self.assertIn(f"#{self.pago_original.pk}", response.data["pago"]["observacion"])
		reversion = MovimientoCuenta.objects.get(movimiento_revertido=self.movimiento_original)
		self.assertEqual(reversion.tipo_movimiento, "Cargo")
		self.assertIsNone(reversion.pago_id)
		self.assertEqual(
			MovimientoCuenta.objects.get(pago_id=response.data["pago"]["pago_id"]).tipo_movimiento,
			"Abono",
		)
		self.assertEqual(Cuota.objects.get(pk=self.cuota_corregida.pk).estado_cuota, EstadoCuotaChoices.PAGA)
		imputacion = Imputacion.objects.get(movimiento_origen__pago_id=response.data["pago"]["pago_id"])
		self.assertEqual(imputacion.movimiento_destino.cuota_id, self.cuota_corregida.pk)
		self.assertEqual(imputacion.monto_aplicado, Decimal("50.00"))

	def test_no_permite_borrar_pago_ni_comprobante_original(self):
		pago_response = self.client.delete(reverse("pago-detail", args=[self.pago_original.pk]))
		comprobante_response = self.client.delete(reverse("comprobante-detail", args=[self.comprobante_original.pk]))

		self.assertEqual(pago_response.status_code, 405)
		self.assertEqual(comprobante_response.status_code, 405)
		self.assertTrue(Pago.objects.filter(pk=self.pago_original.pk).exists())
		self.assertTrue(Comprobante.objects.filter(pk=self.comprobante_original.pk).exists())


class PagoTestBase(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		persona = Persona.objects.create(nombre="Juan", apellido="Paz", dni="56789012")
		self.socio = Socio.objects.create(persona=persona)
		self.cuenta = account_for(self.socio, Decimal("-2000.00"))
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
		self.assertEqual(self.cuenta.saldo, Decimal("-1600.00"))

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

	def test_correccion_sobre_la_misma_cuota_ignora_el_pago_original(self):
		original = self.pagar([self.agosto], "1000.00")

		response = self.client.post(
			reverse("corregir-pago", args=[original.data["pago"]["pago_id"]]),
			{
				"motivo": "Monto mal cargado",
				"cuota_ids": [self.agosto.pk],
				"monto_total": "800.00",
				"medios": [{"medio_de_pago": "Transferencia", "monto": "800.00"}],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.assertNotEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		activo = Imputacion.objects.filter(
			movimiento_destino__cuota=self.agosto,
			movimiento_origen__reversion__isnull=True,
		)
		self.assertEqual(sum(activo.values_list("monto_aplicado", flat=True)), Decimal("800.00"))


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


class CorreccionPagoTests(PagoTestBase):
	def corregir(self, pago_id, cuotas, monto, motivo="Cuota equivocada"):
		return self.client.post(
			reverse("corregir-pago", args=[pago_id]),
			{
				"motivo": motivo,
				"cuota_ids": [cuota.pk for cuota in cuotas],
				"monto_total": monto,
				"medios": [{"medio_de_pago": "Transferencia", "monto": monto}],
			},
			format="json",
		)

	def pendiente(self, cuota):
		response = self.client.get(reverse("estado-cuenta-socio", args=[self.socio.pk]))
		fila = next(item for item in response.data["cuotas"] if item["cuota_id"] == cuota.pk)
		return Decimal(str(fila["saldo_pendiente"]))

	def test_cuotas_del_pago_original_vuelven_a_estar_pendientes(self):
		original = self.pagar([self.agosto], "1000.00")

		response = self.corregir(original.data["pago"]["pago_id"], [self.septiembre], "1000.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.agosto.refresh_from_db()
		self.septiembre.refresh_from_db()
		self.assertNotEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)
		self.assertEqual(self.pendiente(self.agosto), Decimal("1000.00"))
		self.assertEqual(self.septiembre.estado_cuota, EstadoCuotaChoices.PAGA)
		self.cuenta.refresh_from_db()
		self.assertEqual(self.cuenta.saldo, Decimal("-1000.00"))

	def test_registra_el_usuario_que_corrige(self):
		original = self.pagar([self.agosto], "1000.00")
		directivo = get_user_model().objects.create_user(username="directivo")
		self.client.force_authenticate(user=directivo)

		response = self.corregir(original.data["pago"]["pago_id"], [self.agosto], "900.00")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(Pago.objects.get(pk=response.data["pago"]["pago_id"]).usuario, directivo)
		self.assertEqual(response.data["usuario"], "directivo")

	def test_no_permite_corregir_hacia_una_cuota_saldada_por_otro_pago(self):
		self.pagar([self.agosto], "1000.00")
		segundo = self.pagar([self.septiembre], "500.00")

		response = self.corregir(segundo.data["pago"]["pago_id"], [self.agosto], "500.00")

		self.assertEqual(response.status_code, 400)
		self.assertEqual(Pago.objects.get(pk=segundo.data["pago"]["pago_id"]).estado_pago, "Acreditado")

	def test_no_permite_corregir_un_pago_ya_anulado(self):
		original = self.pagar([self.agosto], "1000.00")
		self.corregir(original.data["pago"]["pago_id"], [self.agosto], "900.00")

		response = self.corregir(original.data["pago"]["pago_id"], [self.agosto], "800.00")

		self.assertEqual(response.status_code, 400)

	def test_conserva_el_motivo_completo_y_la_observacion_original(self):
		original = self.pagar([self.agosto], "1000.00", observacion="Pagó en ventanilla")
		motivo = "Error de carga " * 25

		response = self.corregir(original.data["pago"]["pago_id"], [self.agosto], "900.00", motivo=motivo)

		self.assertEqual(response.status_code, 201, response.data)
		pago_original = Pago.objects.get(pk=original.data["pago"]["pago_id"])
		self.assertEqual(pago_original.motivo_anulacion, motivo.strip())
		self.assertEqual(pago_original.observacion, "Pagó en ventanilla")

	def test_pago_inexistente_devuelve_404(self):
		response = self.corregir(999999, [self.agosto], "100.00")

		self.assertEqual(response.status_code, 404)


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
		}
		valores.update(datos)
		return self.client.post(reverse("cuota-beneficio", args=[self.cuota.pk]), valores, format="json")

	def cargo(self):
		return MovimientoCuenta.objects.get(cuota=self.cuota).monto

	def saldo(self):
		return CuentaCorriente.objects.get(socio=self.socio).saldo

	def test_descuento_fijo_reduce_la_cuota(self):
		response = self.asignar()

		self.assertEqual(response.status_code, 201, response.data)
		self.assertIsNone(response.data["beca"])
		self.assertEqual(response.data["item"]["concepto"], "DescuentoUnico")
		self.assertEqual(response.data["item"]["motivo"], "Hermanos en el club")
		self.assertEqual(self.cargo(), Decimal("2000.00"))
		self.assertEqual(self.saldo(), Decimal("-2000.00"))

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
			({"tipo": "Beca"}, "fecha_fin"),
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
		self.assertEqual(CuentaCorriente.objects.get(socio=self.socio).saldo, Decimal("-1250.00"))

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
				"fecha_aplicacion": "2026-10-01", "fecha_fin": "2026-12-31", "motivo": "Beca deportiva",
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

	def test_correccion_recalcula_el_desglose_sin_el_pago_original(self):
		original = self.pagar("1000.00")
		pago_id = Comprobante.objects.get(numero=original["numero"]).pago_id

		response = self.client.post(
			reverse("corregir-pago", args=[pago_id]),
			{
				"motivo": "Monto mal cargado",
				"cuota_ids": [self.cuota.pk],
				"monto_total": "1200.00",
				"medios": [{"medio_de_pago": "Transferencia", "monto": "1200.00"}],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.data)
		detalle = self.client.get(reverse("comprobante-detail", args=[response.data["comprobante"]["comprobante_id"]])).data
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
		self.assertEqual(CuentaCorriente.objects.get(socio=self.socio).saldo, Decimal("-2500.00"))


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
		self.pagar("2500.00", cuotas=[self.generar("2026-11")])

		response = self.list_by_cuota(self.cuota.pk)

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

	def test_recibo_anulado_indica_su_reemplazo(self):
		original = self.pagar("1000.00")
		pago_id = Comprobante.objects.get(numero=original["numero"]).pago_id
		correccion = self.client.post(
			reverse("corregir-pago", args=[pago_id]),
			{
				"motivo": "Monto mal cargado",
				"cuota_ids": [self.cuota.pk],
				"monto_total": "1200.00",
				"medios": [{"medio_de_pago": "Transferencia", "monto": "1200.00"}],
			},
			format="json",
		)

		contenido = self.descargar(original["numero"]).content

		self.assertIn(b"ANULADO", contenido)
		self.assertIn(f"X {correccion.data['comprobante']['numero']:08d}".encode(), contenido)

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
		self.assertEqual(self.cuenta.saldo, Decimal("-1600.00"))
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

	def reporte(self):
		response = self.client.get(reverse("reporte-morosidad"))
		self.assertEqual(response.status_code, 200)
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


class ResumenFinancieroTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		today = timezone.localdate()
		socio = crear_socio("78901237")
		cuenta = account_for(socio)
		crear_cuota_con_cargo(
			cuenta,
			"2026-08",
			"1000.00",
			EstadoCuotaChoices.VENCIDA_1,
			venc1=today - timedelta(days=5),
			venc2=today + timedelta(days=5),
		)

	def test_resumen_saldo_vencido_y_cobros_por_medio_solo_acreditados(self):
		pago = Pago.objects.create(estado_pago=EstadoPagoChoices.ACREDITADO)
		ItemPago.objects.bulk_create([
			ItemPago(pago=pago, medio_de_pago=MedioDePagoChoices.TRANSFERENCIA, monto=Decimal("1200.00")),
			ItemPago(pago=pago, medio_de_pago=MedioDePagoChoices.BILLETERA_VIRTUAL, monto=Decimal("350.00")),
			ItemPago(pago=pago, medio_de_pago=MedioDePagoChoices.EFECTIVO, monto=Decimal("150.00")),
		])
		pago_anulado = Pago.objects.create(estado_pago=EstadoPagoChoices.ANULADO)
		ItemPago.objects.create(
			pago=pago_anulado,
			medio_de_pago=MedioDePagoChoices.TRANSFERENCIA,
			monto=Decimal("999.00"),
		)

		response = self.client.get(reverse("resumen-financiero"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data, {
			"socios_en_mora": 1,
			"monto_adeudado_total": Decimal("1000.00"),
			"cuotas_vencidas": 1,
			"cuotas_vencidas_1": 1,
			"cuotas_vencidas_2": 0,
			"transferencia_bancaria": Decimal("1200.00"),
			"billetera_virtual": Decimal("350.00"),
			"pago_efectivo": Decimal("150.00"),
		})


class ResumenFinancieroPdfTests(APITestCase):
	def setUp(self):
		self.client.force_authenticate(user=get_user_model().objects.create_user(username="tesorero"))
		today = timezone.localdate()
		cuenta = account_for(Socio.objects.create(persona=Persona.objects.create(nombre="Rosa", apellido="Mora", dni="78901250")))
		crear_cuota_con_cargo(
			cuenta, "2026-07", "700.00", EstadoCuotaChoices.VENCIDA_2,
			venc1=today - timedelta(days=20), venc2=today - timedelta(days=10),
		)
		crear_cuota_con_cargo(
			cuenta, "2026-08", "800.00", EstadoCuotaChoices.VENCIDA_1,
			venc1=today - timedelta(days=5), venc2=today + timedelta(days=5),
		)
		crear_cuota_con_cargo(
			cuenta, "2026-09", "900.00",
			venc1=today + timedelta(days=5), venc2=today + timedelta(days=15),
		)

	def test_separa_deuda_en_fecha_y_vencidas_por_vencimiento(self):
		report = _build_financial_report(date(2026, 9, 1))

		self.assertEqual(report["cuotas_vencidas"], 2)
		self.assertEqual(report["cuotas_vencidas_1"], 1)
		self.assertEqual(report["cuotas_vencidas_2"], 1)
		self.assertEqual(len(report["deudores"]), 1)
		deudor = report["deudores"][0]
		self.assertEqual(deudor["deuda_en_fecha"], Decimal("900.00"))
		self.assertEqual(deudor["cuotas_vencidas_1"], 1)
		self.assertEqual(deudor["cuotas_vencidas_2"], 1)
		self.assertEqual(deudor["deuda_vencida"], Decimal("1500.00"))

	def test_descarga_pdf(self):
		response = self.client.get(reverse("resumen-financiero-pdf"), {"periodo": "2026-09"})

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response["Content-Type"], "application/pdf")
		self.assertIn(b"Mora, Rosa", response.content)


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
		response = self.download(alcance="socio", socio_id=self.up_to_date.pk)

		self.assertEqual(response.status_code, 200)
		self.assertNotIn(b"Mora, Rosa", response.content)
		self.assertIn(b"No hay socios con deuda vencida", response.content)

		response = self.download(alcance="manual", socio_ids=f"{self.debtor.pk},{self.up_to_date.pk}")

		self.assertIn(b"Mora, Rosa", response.content)
		self.assertIn(rb"Alcance: Selecci\363n manual", response.content)

	def test_rejects_invalid_parameters(self):
		for params in ({"alcance": "todos"}, {"alcance": "manual"}, {"alcance": "socio", "socio_id": "x"}):
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
		self.cuenta = account_for(self.socio, Decimal("-1000.00"))
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
		self.assertIn("Recargo por primer vencimiento", recargos[0].motivo)
		self.assertIn(cuota.fecha_venc1.strftime("%d/%m/%Y"), recargos[0].motivo)
		self.assertIn("Recargo por segundo vencimiento", recargos[1].motivo)
		cuota.refresh_from_db()
		self.assertEqual(cuota.estado_cuota, EstadoCuotaChoices.VENCIDA_2)
		self.assertEqual(cuota.recargos_aplicados, 2)
		self.assertEqual(MovimientoCuenta.objects.get(cuota=cuota).monto, Decimal("1300.00"))
		self.cuenta.refresh_from_db()
		self.assertEqual(self.cuenta.saldo, Decimal("-1300.00"))
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

	def test_corregir_pago_devuelve_la_cuota_a_vencida_en_segunda_fecha(self):
		original = self.pagar([self.agosto], "1000.00")
		self.agosto.refresh_from_db()
		self.assertEqual(self.agosto.estado_cuota, EstadoCuotaChoices.PAGA)

		response = self.client.post(
			reverse("corregir-pago", args=[original.data["pago"]["pago_id"]]),
			{
				"motivo": "Cuota equivocada",
				"cuota_ids": [self.septiembre.pk],
				"monto_total": "1000.00",
				"medios": [{"medio_de_pago": "Transferencia", "monto": "1000.00"}],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.data)
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
		self.assertEqual(CuentaCorriente.objects.get(socio=self.socio).saldo, -Decimal(amount))

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
			self.migracion.MONTHLY_GENERATION: ("finanzas.services.generar_cuotas_mensuales", Schedule.MONTHLY, 1, 1),
			self.migracion.DAILY_SURCHARGES: ("finanzas.services.apply_surcharges", Schedule.DAILY, None, 2),
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

		for tarea in Schedule.objects.filter(name__in=[self.migracion.MONTHLY_GENERATION, self.migracion.DAILY_SURCHARGES]):
			with self.subTest(tarea=tarea.name):
				id_tarea = async_task(tarea.func, sync=True)
				resultado = fetch(id_tarea)
				self.assertTrue(resultado.success, resultado.result)

		self.assertEqual(Cuota.objects.filter(movimiento__cuenta_corriente__socio__persona__dni="90000001").count(), 1)

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
		SecuenciaComprobante.objects.update_or_create(pk=1, defaults={"ultimo_numero": 41})

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
			SecuenciaComprobante.objects.get(pk=1).ultimo_numero,
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
		cuenta = account_for(Socio.objects.create(persona=persona))
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

		persona = Persona.objects.create(nombre="Ana", apellido="Sur", dni="91234567")
		cuenta = account_for(Socio.objects.create(persona=persona))
		cuota = OldCuota.objects.create(fecha_venc1=date(2026, 10, 10), fecha_venc2=date(2026, 10, 20), periodo="2026-10")
		for concepto, monto in (("CuotaSocial", "1000.00"), ("CuotaDeportiva", "1500.00"), ("Mora", "200.00")):
			OldItemCuota.objects.create(cuota=cuota, concepto=concepto, fecha_aplicacion=date(2026, 10, 1), monto=Decimal(monto))
		cargo = OldMovimiento.objects.create(cuenta_corriente_id=cuenta.pk, cuota=cuota, tipo_movimiento="Cargo", fecha="2026-10-01T12:00:00Z", monto=Decimal("2700.00"))
		imputaciones = []
		for dia, monto in ((5, "400.00"), (6, "1000.00")):
			pago = OldPago.objects.create(fecha=date(2026, 10, dia))
			abono = OldMovimiento.objects.create(cuenta_corriente_id=cuenta.pk, pago=pago, tipo_movimiento="Abono", fecha=f"2026-10-0{dia}T12:00:00Z", monto=Decimal(monto))
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

		persona = Persona.objects.create(nombre="Ana", apellido="Este", dni="92345678")
		cuenta = account_for(Socio.objects.create(persona=persona))
		con_movimiento = OldPago.objects.create(fecha=date(2026, 10, 5))
		OldMovimiento.objects.create(cuenta_corriente_id=cuenta.pk, pago=con_movimiento, tipo_movimiento="Abono", fecha="2026-10-05T14:30:00Z", monto=Decimal("100.00"))
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

		persona = Persona.objects.create(nombre="Eva", apellido="Norte", dni="93456789")
		account_id = account_for(Socio.objects.create(persona=persona)).pk

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

	def test_new_socio_gets_an_empty_current_account(self):
		response = self.client.post("/api/padron/socio/", self.person_payload("40111222"), format="json")

		self.assertEqual(response.status_code, 201, response.data)
		account = CuentaCorriente.objects.get(socio_id=response.data["socio_id"])
		self.assertEqual(account.saldo, Decimal("0.00"))
		self.assertEqual(account.estado_cuenta_corriente, "Activo")

		status_response = self.client.get(reverse("estado-cuenta-socio", args=[response.data["socio_id"]]))

		self.assertEqual(status_response.status_code, 200)
		self.assertEqual(status_response.data["cuotas_generadas"], 0)
		self.assertEqual(status_response.data["total_adeudado"], Decimal("0.00"))

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

		response = self.client.post("/api/padron/jugador/", payload, format="json")

		self.assertEqual(response.status_code, 201, response.data)
		self.assertTrue(CuentaCorriente.objects.filter(socio__persona__dni="40111223").exists())

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
