# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Un único rol: **usuario**. Los roles anteriores (Administrador, Administrativo, Directivo, Tesorero) se unifican. Quien opera el sistema es el personal del Club Universitario de Berisso, principalmente en tareas administrativas: cobrar cuotas, cargar y actualizar legajos, controlar la documentación de docentes, enviar comunicaciones y consultar reportes de morosidad y del padrón.

Hay usuarios poco técnicos, algunos de mayor edad o con poca práctica con la computadora.

Los socios y las familias no entran al sistema. Solo reciben las comunicaciones que se generan desde él.

## Product Purpose

Reemplaza un software de escritorio antiguo, cerrado y sin soporte que obligaba a duplicar tareas en papel y ponía en riesgo los datos históricos del club. Centraliza en una sola base el padrón (socios, jugadores, docentes, categorías y vínculos familiares), las finanzas (cuotas, pagos, caja, becas, devoluciones, estado de cuenta, morosidad), la documentación obligatoria de docentes, las comunicaciones segmentadas y las automatizaciones (generación de deudas, recategorización).

El éxito se mide así: el personal resuelve su trabajo diario sin papel, sin cargar dos veces lo mismo y sin depender de alguien técnico.

## Positioning

Es un sistema hecho a medida para un club concreto, según su operatoria real. Corre en el hardware del propio club y los datos son del club (soberanía de datos, sin hosting externo). Es el Proyecto Final de Ingeniería en Sistemas de Información de la UTN FRLP (2026).

## Operating Context

- Se usa en una sola PC de escritorio, en la secretaría del club, dentro de la red local. No se usa desde celulares ni desde otros equipos.
- El uso diario se reparte entre la atención al público en ventanilla (cobros, consultas de estado de cuenta) y la carga administrativa.
- Los comprobantes y reportes se generan en PDF.
- Los datos históricos se migran desde planillas y papel con scripts ETL ([scripts/](scripts/)).

## Capabilities and Constraints

- Stack: Django y PostgreSQL en el backend; React 19 con Vite, Mantine 6 y Tailwind 4 en el frontend; todo con Docker Compose.
- Módulos: inicio, padrón, finanzas, documental, comunicaciones, automatizaciones, configuración, usuarios y Comet.
- Comet: se analiza la factibilidad de una integración futura con esta plataforma analítica. No está decidido.
- Reglas financieras: un saldo negativo es una deuda; una cuota está vencida desde el primer vencimiento; el socio dado de baja no paga.
- Pendiente: implementar la unificación de los roles en un único rol de usuario.

## Brand Commitments

- El escudo y la identidad del Club Universitario de Berisso son obligatorios. Archivo: [Frontend/SGCUB/src/components/escudo-sin-fondo.png](Frontend/SGCUB/src/components/escudo-sin-fondo.png).
- La interfaz está en español rioplatense.

## Evidence on Hand

- Escudo del club: [Frontend/SGCUB/src/components/escudo-sin-fondo.png](Frontend/SGCUB/src/components/escudo-sin-fondo.png).
- Datos de demostración: [scripts/datos-demo](scripts/datos-demo) y [respaldo/sgcub.dump](respaldo/sgcub.dump).
- No hay testimonios, métricas de uso ni casos documentados. No hay que inventarlos.

## Product Principles

1. **Claridad antes que densidad.** Un usuario poco técnico tiene que entender qué hace cada pantalla y cada botón sin ayuda.
2. **Rápido en la ventanilla.** Las tareas frente al socio (cobrar, consultar deuda) requieren pocos pasos y muestran el estado de un vistazo.
3. **Cargar una sola vez.** Ningún dato se ingresa dos veces. El sistema calcula y automatiza lo que puede.
4. **Los datos son del club.** El sistema se despliega localmente, se puede respaldar y conserva la integridad del historial.
5. **Con la identidad del club.** El sistema se siente propio del Club Universitario de Berisso, no un software genérico.

## Accessibility & Inclusion

Pensado para usuarios mayores o con poca práctica digital: textos legibles con buen contraste, lenguaje simple y sin jerga técnica, botones y áreas de clic generosas, mensajes de error que dicen qué hacer y confirmación antes de las acciones irreversibles.
