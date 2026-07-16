import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

function validateProductionEnvironment() {
  if (process.env.NODE_ENV !== 'production') return;

  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'PUBLIC_API_URL',
    'WEB_APP_URL',
    'WHATSAPP_PHONE',
    'MERCADOPAGO_ACCESS_TOKEN',
    'MERCADOPAGO_WEBHOOK_SECRET',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Faltan variables obligatorias de produccion: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET === 'dev-only-change-before-production') {
    throw new Error('JWT_SECRET de desarrollo no puede utilizarse en produccion.');
  }
}

async function bootstrap() {
  validateProductionEnvironment();
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
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
    .setDescription('Catalogo, carrito, ordenes, pagos y atencion al cliente.')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 4000);
}

bootstrap();
