# Perfumeria Fraiche Tizimin

Monorepo Docker con frontend Next.js, API NestJS, PostgreSQL, Prisma ORM y Redis.

Los requisitos funcionales permanentes estan en [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md) y las decisiones de arquitectura en [docs/BACKEND.md](docs/BACKEND.md).

## Desarrollo local

Solo se requiere Docker Desktop:

```bash
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000/api/v1
- Swagger: http://localhost:4000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Endpoints publicos

```text
GET    /api/v1/health
GET    /api/v1/products
GET    /api/v1/products/search/suggestions
GET    /api/v1/products/:slug
GET    /api/v1/categories
GET    /api/v1/scent-families
GET    /api/v1/promotions

POST   /api/v1/carts
GET    /api/v1/carts/:publicToken
POST   /api/v1/carts/:publicToken/items
PATCH  /api/v1/carts/:publicToken/items/:itemId
DELETE /api/v1/carts/:publicToken/items/:itemId

POST   /api/v1/payments/mercado-pago/webhook
GET    /api/v1/payments/instructions/:method

GET    /api/v1/contact/whatsapp
POST   /api/v1/special-requests
GET    /api/v1/special-requests/:publicToken
```

## Cuenta y compra

```text
POST   /api/v1/customer-auth/register
POST   /api/v1/customer-auth/login
POST   /api/v1/customer-auth/refresh
POST   /api/v1/customer-auth/logout
POST   /api/v1/customer-auth/logout-all
POST   /api/v1/customer-auth/forgot-password
POST   /api/v1/customer-auth/reset-password
POST   /api/v1/customer-auth/verify-email
POST   /api/v1/customer-auth/resend-verification

GET    /api/v1/customers/me
PATCH  /api/v1/customers/me
GET    /api/v1/customers/me/addresses
POST   /api/v1/customers/me/addresses
PATCH  /api/v1/customers/me/addresses/:addressId
DELETE /api/v1/customers/me/addresses/:addressId
GET    /api/v1/customers/me/wishlist
POST   /api/v1/customers/me/wishlist/:productId
DELETE /api/v1/customers/me/wishlist/:productId

POST   /api/v1/orders                         Idempotency-Key requerido
GET    /api/v1/orders
GET    /api/v1/orders/:publicToken
POST   /api/v1/orders/:publicToken/cancel
POST   /api/v1/payments/mercado-pago/orders/:orderToken/preference
POST   /api/v1/uploads/transfer-proofs/presign
POST   /api/v1/payments/orders/:orderToken/transfer-proof
```

Las rutas de cuenta, ordenes, inicio de pago y comprobantes requieren el JWT de cliente. El refresh token no se entrega a JavaScript: se rota mediante una cookie `HttpOnly`.

## Administracion

Define `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `JWT_SECRET` en `.env`, recrea la API y el seed creara o actualizara el administrador.

```text
POST  /api/v1/auth/login
GET   /api/v1/admin/dashboard
GET   /api/v1/admin/products
GET   /api/v1/admin/inventory
POST  /api/v1/admin/products
PATCH /api/v1/admin/products/:id
PATCH /api/v1/admin/variants/:id
PATCH /api/v1/admin/inventory/:variantId
PATCH /api/v1/admin/transfer-proofs/:proofId
POST  /api/v1/admin/orders/:orderToken/confirm-cash
PATCH /api/v1/admin/special-requests/:publicToken
GET   /api/v1/admin/orders
GET   /api/v1/admin/orders/:publicToken
PATCH /api/v1/admin/orders/:publicToken/status
POST  /api/v1/admin/orders/:publicToken/shipments
PATCH /api/v1/admin/shipments/:shipmentId
GET   /api/v1/admin/promotions
POST  /api/v1/admin/promotions
PATCH /api/v1/admin/promotions/:id
PATCH /api/v1/admin/pricing-policies/:line
PATCH /api/v1/admin/prices/bulk
GET   /api/v1/admin/inventory-alerts
POST  /api/v1/admin/inventory-alerts/scan
POST  /api/v1/admin/inventory-alerts/:alertId/acknowledge
```

Todas las rutas `/admin` requieren `Authorization: Bearer <JWT>` y rol `ADMIN` o `STAFF`. La creacion y edicion principal de productos requiere `ADMIN`.

## Integraciones privadas

Crea `.env` a partir de `.env.example` y configura:

- Mercado Pago: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y URLs HTTPS publicas.
- Archivos: bucket compatible con S3 y `STORAGE_*`.
- Correo transaccional y administrativo: `SMTP_*` y `ADMIN_NOTIFICATION_EMAIL`.
- Seguridad: secretos distintos en `JWT_SECRET` y `CUSTOMER_JWT_SECRET`.
- Verificacion: `REQUIRE_EMAIL_VERIFICATION=true` en produccion.
- WhatsApp: `WHATSAPP_PHONE` con codigo de pais, sin signos ni espacios.

Nunca coloques estas credenciales en el frontend o dentro del repositorio.

## Base de datos

En desarrollo, Compose ejecuta `prisma migrate deploy` y el seed automaticamente. Para produccion:

```bash
docker compose exec api npm run prisma:deploy
```

La migracion inicial esta versionada en `apps/api/prisma/migrations`.

## Verificacion ejecutada

- Prisma schema valido, tres migraciones aplicadas y estado sincronizado con PostgreSQL.
- Compilacion TypeScript y cinco pruebas automatizadas de reglas de comercio aprobadas.
- Auditoria npm sin vulnerabilidades conocidas.
- Flujo HTTP completo aprobado: registro, refresh, direccion, carrito, orden, pago, envio, entrega, historial y tablero.
- Promocion automatica, alerta de poco stock, reconocimiento y resolucion por reabasto aprobados.
- Separacion de roles aprobada: sin cuenta se recibe `401` y un JWT de cliente no entra a `/admin`.

Mercado Pago, S3 y SMTP requieren credenciales reales y endpoints HTTPS antes de ejecutar pruebas de integracion externas.
