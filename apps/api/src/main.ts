import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser = require('cookie-parser');
import helmet from 'helmet';
import { AppModule } from './app.module';

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'CUSTOMER_JWT_SECRET',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD',
    'PUBLIC_API_URL',
    'WEB_APP_URL',
    'WHATSAPP_PHONE',
    'MERCADOPAGO_ACCESS_TOKEN',
    'MERCADOPAGO_WEBHOOK_SECRET',
    'CORS_ORIGIN',
    'SMTP_HOST',
    'SMTP_FROM',
    'ADMIN_NOTIFICATION_EMAIL',
    'STORAGE_BUCKET',
    'STORAGE_ACCESS_KEY',
    'STORAGE_SECRET_KEY',
    'STORAGE_PUBLIC_URL',
    'REQUIRE_EMAIL_VERIFICATION',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Faltan variables obligatorias de produccion: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET === 'dev-only-change-before-production') {
    throw new Error('JWT_SECRET de desarrollo no puede utilizarse en produccion.');
  }
  if (process.env.CUSTOMER_JWT_SECRET === 'dev-customer-only-change-before-production') {
    throw new Error('CUSTOMER_JWT_SECRET de desarrollo no puede utilizarse en produccion.');
  }
  if (process.env.CUSTOMER_JWT_SECRET === process.env.JWT_SECRET) {
    throw new Error('Los secretos JWT de clientes y personal deben ser diferentes.');
  }
  if ((process.env.JWT_SECRET?.length ?? 0) < 32 || (process.env.CUSTOMER_JWT_SECRET?.length ?? 0) < 32) {
    throw new Error('Los secretos JWT de produccion deben tener al menos 32 caracteres.');
  }
  if (process.env.REQUIRE_EMAIL_VERIFICATION !== 'true') {
    throw new Error('La verificacion de correo debe estar activa en produccion.');
  }
}

async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Fraiche Tizimin API')
    .setDescription('Catalogo, clientes, carrito, ordenes, pagos, envios y operacion administrativa.')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
