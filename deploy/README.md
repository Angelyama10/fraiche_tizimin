# Despliegue de Fraiche Tizimin en IONOS

Este proyecto necesita un **VPS Linux**. El hosting web tradicional de IONOS y Deploy Now no ejecutan el backend NestJS, PostgreSQL, Redis y MinIO de este repositorio.

## 1. Contratar y crear el servidor

Desde el panel mostrado en la captura:

1. Pulsa **Anadir otro producto**.
2. Entra a **Servidores > VPS**.
3. Elige Linux con **Ubuntu 24.04 LTS**, sin Plesk.
4. Para iniciar con todo el stack en una sola maquina, usa al menos 4 GB de RAM; se recomiendan 8 GB para produccion.
5. Selecciona el centro de datos de Estados Unidos mas cercano a Mexico y activa copias de seguridad del proveedor.
6. Agrega tu llave SSH publica durante la creacion. No uses ni compartas una contrasena root por chat.

La llave se genera con una herramienta incluida en macOS; no instala ningun programa:

```bash
ssh-keygen -t ed25519 -C "fraiche-ionos" -f ~/.ssh/fraiche_ionos
cat ~/.ssh/fraiche_ionos.pub
```

Pega solamente el contenido del archivo `.pub` en IONOS. La llave privada `~/.ssh/fraiche_ionos` nunca se comparte por chat ni se sube a Git.

## 2. Preparar DNS y firewall

Crea estos registros DNS tipo `A`, todos dirigidos a la IPv4 publica del VPS:

| Host | Destino |
| --- | --- |
| `@` | IPv4 del VPS |
| `www` | IPv4 del VPS |
| `api` | IPv4 del VPS |
| `media` | IPv4 del VPS |

En la politica de firewall de IONOS permite entrada TCP `22`, `80` y `443`, y UDP `443`. No publiques `3000`, `4000`, `5432`, `6379`, `9000` ni `9001`.

## 3. Preparar Ubuntu

Desde una terminal ubicada en la carpeta del proyecto en tu Mac, copia solamente el instalador:

```bash
scp -i ~/.ssh/fraiche_ionos deploy/bootstrap-vps.sh root@IP_DEL_SERVIDOR:/root/bootstrap-vps.sh
```

Entra al VPS y ejecutalo una sola vez:

```bash
ssh -i ~/.ssh/fraiche_ionos root@IP_DEL_SERVIDOR
chmod +x /root/bootstrap-vps.sh
/root/bootstrap-vps.sh
```

El script instala Docker desde el repositorio oficial, habilita actualizaciones de seguridad, UFW y Fail2ban, y crea el usuario `fraiche` con acceso por la misma llave SSH.

Sal de la sesion de `root` y abre una nueva con el usuario sin privilegios:

```bash
ssh -i ~/.ssh/fraiche_ionos fraiche@IP_DEL_SERVIDOR
```

## 4. Configurar secretos

Sincroniza el proyecto por primera vez desde tu Mac:

```bash
rsync -az \
  --exclude '.git/' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'node_modules/' \
  --exclude '.next/' \
  -e 'ssh -i ~/.ssh/fraiche_ionos' \
  ./ fraiche@IP_DEL_SERVIDOR:/opt/fraiche/
```

Luego entra como `fraiche` y, dentro de `/opt/fraiche`, crea el archivo privado de produccion:

```bash
cd /opt/fraiche
cp deploy/production.env.example deploy/production.env
nano deploy/production.env
chmod 600 deploy/production.env
```

Reemplaza todos los valores `CHANGE_ME`. Genera contrasenas y secretos independientes con:

```bash
openssl rand -hex 32
```

Comprueba el archivo sin levantar ningun servicio:

```bash
./deploy/deploy.sh --check
```

Necesitas las credenciales de produccion de Mercado Pago, una contrasena de aplicacion de Gmail y el dominio real. `deploy/production.env` esta ignorado por Git y nunca debe subirse al repositorio.

En Mercado Pago registra esta URL de notificaciones:

```text
https://api.TU_DOMINIO/api/v1/payments/mercado-pago/webhook
```

## 5. Primer despliegue

Cuando los cuatro registros DNS ya apunten al VPS:

```bash
./deploy/deploy.sh --seed
```

`--seed` crea los datos iniciales y el usuario administrador. En despliegues posteriores ejecuta solo:

```bash
./deploy/deploy.sh
```

Caddy solicitara y renovara automaticamente los certificados HTTPS. Verifica:

```bash
curl https://api.TU_DOMINIO/api/v1/health
docker compose --env-file deploy/production.env -f compose.production.yml ps
```

## 6. Respaldos

Crea un respaldo manual:

```bash
./deploy/backup-postgres.sh
```

Programa uno diario con `crontab -e`:

```cron
15 3 * * * /opt/fraiche/deploy/backup-postgres.sh >> /opt/fraiche/deploy/backups/backup.log 2>&1
```

Los respaldos locales conservan 14 dias. En produccion tambien deben copiarse cifrados a un destino externo.

## 7. Despliegue desde GitHub Actions

Crea el entorno `production` en GitHub y agrega estos secretos:

| Secreto | Valor |
| --- | --- |
| `IONOS_HOST` | IPv4 o dominio del VPS |
| `IONOS_USER` | `fraiche` |
| `IONOS_DEPLOY_PATH` | `/opt/fraiche` |
| `IONOS_SSH_PRIVATE_KEY` | Contenido de `~/.ssh/fraiche_ionos` |
| `IONOS_KNOWN_HOSTS` | Resultado verificado de `ssh-keyscan -H IP_DEL_SERVIDOR` |

El archivo `deploy/production.env` se configura una sola vez dentro del VPS. Luego abre **Actions > Desplegar en IONOS > Run workflow**. Marca `seed` solamente en el primer despliegue.

## Operacion util

```bash
# Ver servicios
docker compose --env-file deploy/production.env -f compose.production.yml ps

# Ver logs recientes
docker compose --env-file deploy/production.env -f compose.production.yml logs --tail=200 api web caddy

# Restaurar un respaldo (solicita confirmacion)
./deploy/restore-postgres.sh deploy/backups/perfumes-FECHA.dump
```

## Limpiar los datos de prueba

Antes de cargar el catalogo real, este comando crea un respaldo y elimina
productos, inventario, clientes, pedidos, pagos, promociones y solicitudes de
prueba. Conserva el administrador, el contenido visual, las reglas de precio,
las ubicaciones y las instrucciones de pago:

```bash
./deploy/reset-store-data.sh --confirm-reset
```

No ejecutes `deploy.sh --seed` despues de esta limpieza porque volveria a crear
el catalogo de demostracion. Agrega el catalogo real desde `/admin`.
