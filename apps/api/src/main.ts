import { NestFactory } from "@nestjs/core";
import { ValidationPipe, UnprocessableEntityException } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { apiReference } from "@scalar/nestjs-api-reference";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((s) => s.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // FIX H1: return 422 Unprocessable Entity for validation errors, not 400
      exceptionFactory: (errors) => new UnprocessableEntityException(errors),
    }),
  );

  // -------------------------------------------------------------------------
  // OpenAPI / Swagger spec
  // -------------------------------------------------------------------------
  const config = new DocumentBuilder()
    .setTitle("Whalet API")
    .setDescription(
      "API do sistema de gestão financeira baseado em carteiras. " +
        "Autenticação via email + OTP. " +
        "Endpoints protegidos exigem header: Authorization: Bearer <sessionToken>",
    )
    .setVersion("1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "session-token" },
      "session-token",
    )
    .addTag("auth", "Autenticação via email + OTP")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // -------------------------------------------------------------------------
  // Scalar UI — /docs
  // -------------------------------------------------------------------------
  app.use(
    "/docs",
    apiReference({
      spec: { content: document },
      theme: "default",
      layout: "modern",
    }),
  );

  // Raw OpenAPI JSON — /docs/json (útil para geração de clientes)
  app.use("/docs/json", (_req: any, res: any) => {
    res.json(document);
  });

  app.use("/health", (_req: any, res: any) => {
    res.status(200).json({ status: "ok" });
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`Whalet API running on 0.0.0.0:${port}`);
  console.log(`Docs available at http://0.0.0.0:${port}/docs`);
}

bootstrap();
