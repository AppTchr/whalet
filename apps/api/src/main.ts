import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // -------------------------------------------------------------------------
  // OpenAPI / Swagger spec
  // -------------------------------------------------------------------------
  const config = new DocumentBuilder()
    .setTitle('Ledger API')
    .setDescription(
      'API do sistema de gestão financeira baseado em carteiras. ' +
        'Autenticação via email + OTP. ' +
        'Endpoints protegidos exigem header: Authorization: Bearer <sessionToken>',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'session-token' },
      'session-token',
    )
    .addTag('auth', 'Autenticação via email + OTP')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // -------------------------------------------------------------------------
  // Scalar UI — /docs
  // -------------------------------------------------------------------------
  app.use(
    '/docs',
    apiReference({
      spec: { content: document },
      theme: 'default',
      layout: 'modern',
    }),
  );

  // Raw OpenAPI JSON — /docs/json (útil para geração de clientes)
  app.use('/docs/json', (_req: any, res: any) => {
    res.json(document);
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Ledger API running on port ${port}`);
  console.log(`Docs available at http://localhost:${port}/docs`);
}

bootstrap();
