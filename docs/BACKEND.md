# Arquitectura del backend

## Limites del dominio

- Catalogo: productos, variantes, categorias, marcas, imagenes y familias aromaticas.
- Precios: politica por linea para precios fijos y precio por variante para catalogo.
- Inventario: existencias por ubicacion, reservas y movimientos auditables.
- Comercio: carritos, ordenes, partidas y promociones aplicadas.
- Identidad: cuentas de clientes, sesiones revocables, direcciones y recuperacion de acceso.
- Pagos: Mercado Pago, efectivo, transferencia, webhooks y comprobantes.
- Postventa: historial privado, preparacion, guias, eventos de rastreo y entrega.
- Operacion: tablero, precios, campanas, alertas de inventario y auditoria de acciones.
- Atencion: WhatsApp, solicitudes especiales y notificaciones mediante outbox.

## Reglas invariantes

- `available + reserved` nunca puede superar `onHand`.
- Una reserva se crea dentro de la misma transaccion que la orden.
- El servidor recalcula todos los precios; nunca acepta totales enviados por el navegador.
- Una orden conserva snapshots de nombre, SKU, concentracion, presentacion y precio.
- Los webhooks se deduplican antes de modificar pagos o inventario.
- La confirmacion de un pago consume la reserva; la cancelacion o expiracion la libera.
- El carrito puede ser anonimo, pero solo su propietario autenticado puede convertirlo en orden.
- Direcciones, nombres, precios y productos se copian a la orden como snapshots historicos.
- Los JWT de clientes y personal tienen secretos y audiencias distintos.
- Los refresh tokens se rotan, solo se guardan como hash y viajan en cookie `HttpOnly`.
- Por defecto se aplica la mejor promocion automatica; solo se combinan campanas marcadas explicitamente como acumulables y el total nunca supera el subtotal.
- Los estados de orden y envio avanzan mediante transiciones controladas.

## Flujo de cliente

1. Registro o inicio de sesion.
2. Verificacion de correo cuando `REQUIRE_EMAIL_VERIFICATION=true`.
3. Carrito anonimo o asociado a la cuenta.
4. Checkout autenticado con direccion guardada o snapshot capturado.
5. Reserva atomica de inventario y creacion idempotente de orden.
6. Pago delegado a Mercado Pago o confirmacion administrativa de efectivo/transferencia.
7. Historial privado con eventos de preparacion, guia y entrega.

## Flujo de la dueña

- Tablero con productos, existencias, ordenes, ingresos diarios/mensuales y pendientes.
- Alta y edicion de productos, variantes, precios de catalogo y precios fijos por linea.
- Campanas `DAILY`, `MONTHLY`, `FLASH`, `WELCOME` o generales, automaticas o con codigo.
- Lista de ordenes paginada, detalle de envio y direcciones, cambios de estado auditados.
- Guias con paqueteria, codigo, URL HTTPS, estimado y bitacora de eventos.
- Alertas persistentes de poco inventario con recordatorio diario hasta reconocer o reabastecer.

## Escalamiento

La API es stateless y puede ejecutarse en multiples replicas. PostgreSQL resuelve las escrituras consistentes y Redis se reserva para colas, cache, rate limiting distribuido y coordinacion. Las imagenes y comprobantes deben almacenarse en un servicio de objetos compatible con S3 y entregarse por CDN.

La capacidad de 1,000 a 10,000 usuarios concurrentes no depende solamente del schema: requiere pruebas de carga, indices medidos, pool de conexiones, replicas, CDN, observabilidad, colas y limites de recursos ajustados en el entorno de produccion.
