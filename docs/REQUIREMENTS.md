# Perfumeria Fraiche Tizimin - Requisitos canonicos

Este documento conserva el alcance funcional acordado para el proyecto.

## Catalogo

- Perfumes Disenador - Linea Fraiche: 60 ml, concentracion clasica y precio de catalogo.
- Perfumes Disenador 37%: 60 ml, concentracion 37% y precio de catalogo.
- Neeche Passion: 60 ml, concentracion normal y precio fijo de $350 MXN.
- Premium: inspirados en aromas nicho y arabes, 60 ml, concentracion 37% y precio fijo de $380 MXN.
- Cuidado personal: cremas corporales, desodorantes, lociones Victoria's Secret, lociones arabes y linea Fraiche.

Cada producto debe soportar imagenes, nombre, descripcion, categorias, familias aromaticas, variantes, precio, inventario y estado de publicacion.

## Venta

- Busqueda y filtros por categoria, linea y tipo de aroma.
- Productos destacados, novedades y promociones.
- Carrito persistente que puede comenzar como invitado y se asocia al iniciar sesion.
- Cuenta obligatoria para checkout, pago, comprobantes e historial de compra.
- Perfil, direcciones guardadas, favoritos y recuperacion segura de acceso.
- Ordenes con reserva de inventario para evitar sobreventa.
- Pago con efectivo, transferencia, tarjeta o link de pago.
- Checkout Pro de Mercado Pago para tarjeta y link de pago.
- Comprobantes de transferencia con revision administrativa.
- Enlaces de WhatsApp con resumen contextual de carrito u orden.
- Pedidos especiales para aromas sin existencia.
- Historial privado con estado del pedido, paqueteria, codigo y enlace de rastreo.

## Administracion de la tienda

- Tablero con ventas diarias/mensuales, ordenes, productos y existencias.
- Alta y edicion de productos, variantes, precios e inventario.
- Ofertas generales, del dia, del mes, relampago y de bienvenida.
- Promociones automaticas o mediante codigo, con vigencia y limites de uso.
- Alertas de poco inventario reconocibles y resueltas al reabastecer.
- Consulta de compras, direccion de entrega, comprobantes y seguimiento del envio.
- Auditoria de cambios realizados por administradores y personal.

## Operacion

- Backend REST versionado con validacion estricta.
- PostgreSQL como fuente de verdad, Prisma ORM y Redis para procesos distribuidos.
- Precios expresados en centavos; nunca usar numeros decimales para dinero.
- Webhooks verificados, idempotentes y auditables.
- Datos de tarjeta procesados solamente por la pasarela de pago.
- Arquitectura preparada para multiples replicas de API y alta concurrencia.
