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

POST   /api/v1/orders                         Idempotency-Key requerido
GET    /api/v1/orders/:publicToken
POST   /api/v1/orders/:publicToken/cancel

POST   /api/v1/payments/mercado-pago/orders/:orderToken/preference
POST   /api/v1/payments/mercado-pago/webhook
GET    /api/v1/payments/instructions/:method
POST   /api/v1/uploads/transfer-proofs/presign
POST   /api/v1/payments/orders/:orderToken/transfer-proof

GET    /api/v1/contact/whatsapp
POST   /api/v1/special-requests
GET    /api/v1/special-requests/:publicToken
```

## Administracion

Define `ADMIN_EMAIL`, `ADMIN_PASSWORD` y `JWT_SECRET` en `.env`, recrea la API y el seed creara o actualizara el administrador.

```text
POST  /api/v1/auth/login
POST  /api/v1/admin/products
PATCH /api/v1/admin/products/:id
PATCH /api/v1/admin/variants/:id
PATCH /api/v1/admin/inventory/:variantId
PATCH /api/v1/admin/transfer-proofs/:proofId
POST  /api/v1/admin/orders/:orderToken/confirm-cash
PATCH /api/v1/admin/special-requests/:publicToken
GET   /api/v1/admin/orders
```

Todas las rutas `/admin` requieren `Authorization: Bearer <JWT>` y rol `ADMIN` o `STAFF`. La creacion y edicion principal de productos requiere `ADMIN`.

## Integraciones privadas

Crea `.env` a partir de `.env.example` y configura:

- Mercado Pago: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y URLs HTTPS publicas.
- Archivos: bucket compatible con S3 y `STORAGE_*`.
- Correo administrativo: `SMTP_*` y `ADMIN_NOTIFICATION_EMAIL`.
- WhatsApp: `WHATSAPP_PHONE` con codigo de pais, sin signos ni espacios.

Nunca coloques estas credenciales en el frontend o dentro del repositorio.

## Base de datos

En desarrollo, Compose ejecuta `prisma db push` y el seed automaticamente. Para una base nueva de produccion:

```bash
docker compose exec api npm run prisma:deploy
```

La migracion inicial esta versionada en `apps/api/prisma/migrations`.

## Verificacion ejecutada

- Prisma schema valido y migracion aplicada en una base PostgreSQL temporal nueva.
- Compilacion TypeScript del API y build de produccion de Next.js.
- Auditoria npm de produccion sin vulnerabilidades conocidas.
- Catalogo, filtros, precios fijos, carrito, promociones, ordenes, idempotencia, reservas, cancelacion, WhatsApp y pedidos especiales probados por HTTP.
- Login JWT temporal y proteccion administrativa probados; el usuario temporal fue eliminado.

Mercado Pago, S3 y SMTP requieren credenciales reales y endpoints HTTPS antes de ejecutar pruebas de integracion externas.
