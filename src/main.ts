import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.enableCors({ origin: config.get("CORS_ORIGIN", "http://localhost:3000"), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const port = config.get<number>("PORT", 4000);
  await app.listen(port);
  console.log(`Ajnavi API listening on http://localhost:${port}`);
}
bootstrap();
