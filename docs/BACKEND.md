# Arquitectura del backend

## Limites del dominio

- Catalogo: productos, variantes, categorias, marcas, imagenes y familias aromaticas.
- Precios: politica por linea para precios fijos y precio por variante para catalogo.
- Inventario: existencias por ubicacion, reservas y movimientos auditables.
- Comercio: carritos, ordenes, partidas y promociones aplicadas.
- Pagos: Mercado Pago, efectivo, transferencia, webhooks y comprobantes.
- Atencion: WhatsApp, solicitudes especiales y notificaciones mediante outbox.

## Reglas invariantes

- `available + reserved` nunca puede superar `onHand`.
- Una reserva se crea dentro de la misma transaccion que la orden.
- El servidor recalcula todos los precios; nunca acepta totales enviados por el navegador.
- Una orden conserva snapshots de nombre, SKU, concentracion, presentacion y precio.
- Los webhooks se deduplican antes de modificar pagos o inventario.
- La confirmacion de un pago consume la reserva; la cancelacion o expiracion la libera.

## Escalamiento

La API es stateless y puede ejecutarse en multiples replicas. PostgreSQL resuelve las escrituras consistentes y Redis se reserva para colas, cache, rate limiting y coordinacion. Las imagenes y comprobantes deben almacenarse en un servicio de objetos compatible con S3 y entregarse por CDN.

La capacidad de 1,000 a 10,000 usuarios concurrentes no depende solamente del schema: requiere pruebas de carga, indices medidos, pool de conexiones, replicas, CDN, observabilidad, colas y limites de recursos ajustados en el entorno de produccion.
